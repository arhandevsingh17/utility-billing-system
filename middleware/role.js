const { AppError } = require('./errorHandler');

// usage: router.use(isLoggedIn, hasRole('admin'))
function hasRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('403 - You do not have permission to access this page', 403));
    }
    next();
  };
}

module.exports = { hasRole };
