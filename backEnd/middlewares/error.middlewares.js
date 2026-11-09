import multer from 'multer';

/**
 * Global Express Error Handling Middleware
 */
export function errorHandlerMiddleware(error, req, res, next) {
  console.error(`${req.method} ${req.path}:`, error.message);

  if (res.headersSent) {
    return next(error);
  }

  // Translate common library errors into clear client errors.
  if (error.name === 'CastError') {
    return res.status(404).json({ error: 'Not found.' });
  }
  if (error.name === 'ValidationError') {
    const first = Object.values(error.errors || {})[0];
    return res.status(400).json({ error: first?.message || 'Some fields are invalid.' });
  }
  if (error instanceof multer.MulterError) {
    const tooBig = req.path.endsWith('/logo') ? 'Logo images must be 300 KB or smaller.' : 'Resume files must be 5 MB or smaller.';
    const message = error.code === 'LIMIT_FILE_SIZE' ? tooBig : error.message;
    return res.status(400).json({ error: message });
  }

  const status = error.statusCode || error.status || 500;
  const isClientOrServiceError = status < 500 || status === 502 || status === 503 || status === 504;
  const message = isClientOrServiceError && error.message
    ? error.message
    : 'Something went wrong. Please try again.';

  res.status(status).json({ error: message });
}
