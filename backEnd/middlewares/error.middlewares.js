/**
 * Global Express Error Handling Middleware
 */
export function errorHandlerMiddleware(error, req, res, next) {
  console.error(`${req.method} ${req.path}:`, error.message);
  
  if (res.headersSent) {
    return next(error);
  }

  const status = error.statusCode || error.status || 500;
  const isClientOrServiceError = status < 500 || status === 502 || status === 503 || status === 504;
  const message = isClientOrServiceError && error.message
    ? error.message
    : 'Something went wrong. Please try again.';

  res.status(status).json({ error: message });
}

