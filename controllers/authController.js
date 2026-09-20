const User = require('../models/User');
const { catchAsync } = require('../middleware/errorHandler');
const { homePathForRole } = require('../utils/helpers');

// generates ids like CON-1001, CON-1002...
async function generateConsumerId() {
  const count = await User.countDocuments({ role: 'consumer' });
  let n = 1001 + count;
  while (await User.exists({ consumerId: `CON-${n}` })) {
    n++;
  }
  return `CON-${n}`;
}

exports.getRegister = (req, res) => {
  res.render('auth/register', { title: 'Register', form: {} });
};

exports.postRegister = catchAsync(async (req, res) => {
  const { name, email, password, confirmPassword, address, connectionType } = req.body;
  const form = { name, email, address, connectionType };

  const fail = (msg) => {
    req.flash('error', msg);
    return res.status(400).render('auth/register', { title: 'Register', form });
  };

  if (!name || !email || !password) return fail('Name, email and password are required.');
  if (password.length < 6) return fail('Password must be at least 6 characters.');
  if (password !== confirmPassword) return fail('Passwords do not match.');
  if (!['Domestic', 'Commercial'].includes(connectionType)) return fail('Please choose a valid connection type.');

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) return fail('An account with that email already exists.');

  // role is always "consumer" here - never trust req.body.role
  const user = await User.create({
    name, email, password,
    role: 'consumer',
    consumerId: await generateConsumerId(),
    address, connectionType
  });

  req.session.userId = user._id;
  req.flash('success', `Welcome, ${user.name}! Your consumer ID is ${user.consumerId}.`);
  res.redirect('/consumer/dashboard');
});

exports.getLogin = (req, res) => {
  res.render('auth/login', { title: 'Login' });
};

exports.postLogin = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  // password field has select:false in the schema, so ask for it explicitly
  const user = await User.findOne({ email: (email || '').toLowerCase().trim() }).select('+password');

  // same error message either way - don't tell people if the email exists or not
  if (!user || !(await user.comparePassword(password || ''))) {
    req.flash('error', 'Invalid email or password.');
    return res.status(401).render('auth/login', { title: 'Login' });
  }
  if (!user.isActive) {
    req.flash('error', 'This account has been deactivated. Contact the administrator.');
    return res.status(403).render('auth/login', { title: 'Login' });
  }

  const returnTo = req.session.returnTo;

  // regenerate the session on login so old session ids can't be reused
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.userId = user._id;
    req.flash('success', `Welcome back, ${user.name}.`);
    res.redirect(returnTo || homePathForRole(user.role));
  });
});

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('ubs.sid');
    res.redirect('/login');
  });
};
