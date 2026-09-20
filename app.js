require('dotenv').config();

const express = require('express');
const path = require('path');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');

const connectDB = require('./config/db');
const User = require('./models/User');
const helpers = require('./utils/helpers');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const readerRoutes = require('./routes/readerRoutes');
const consumerRoutes = require('./routes/consumerRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.engine('ejs', ejsMate); // gives us layout() support in EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method')); // lets forms send PUT/DELETE using ?_method=
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1); // needed for secure cookies on Render

app.use(session({
  name: 'ubs.sid',
  secret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24
  }
}));
app.use(flash());

// load the logged-in user (if any) and make some stuff available to every view
app.use(async (req, res, next) => {
  res.locals.appName = process.env.APP_NAME || 'Utility Billing System';
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  res.locals.h = helpers;
  res.locals.currentUser = null;

  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      if (user && user.isActive) {
        req.user = user;
        res.locals.currentUser = user;
      } else {
        req.session.destroy(() => {});
      }
    } catch (err) {
      return next(err);
    }
  }
  next();
});

app.get('/', (req, res) => res.render('home', { title: 'Home' }));
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/reader', readerRoutes);
app.use('/consumer', consumerRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
