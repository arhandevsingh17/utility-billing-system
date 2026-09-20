class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// wraps an async controller so errors go to next() instead of crashing the app
function catchAsync(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function notFound(req, res, next) {
  next(new AppError('Page not found', 404));
}

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  } else if (err.code === 11000) {
    statusCode = 400;
    message = `Duplicate value for: ${Object.keys(err.keyValue || {}).join(', ')}`;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID';
  }

  if (statusCode >= 500) console.error(err);

  res.status(statusCode).render('error', { title: `Error ${statusCode}`, statusCode, message });
}

module.exports = { AppError, catchAsync, notFound, errorHandler };
