const { homePathForRole } = require('../utils/helpers');

function isLoggedIn(req, res, next) {
  if (!req.user) {
    req.flash('error', 'Please log in to continue.');
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

function isGuest(req, res, next) {
  if (req.user) return res.redirect(homePathForRole(req.user.role));
  next();
}

module.exports = { isLoggedIn, isGuest };
