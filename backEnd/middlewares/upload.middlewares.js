import multer from 'multer';
import { httpError } from '../utils/http.utils.js';

/**
 * File Upload Middleware using Multer (Memory Storage)
 */
const allowedMimeTypes = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

/** Company logos: small images only (the browser resizes before upload). Type is re-checked from bytes. */
export const logoUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      return callback(httpError(400, 'Logo must be a PNG, JPG or WebP image.'));
    }
    callback(null, true);
  }
});

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, callback) => {
    // Reject loudly: silently dropping the file would make the server fall back to an old saved resume.
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(httpError(400, 'Upload your resume as a PDF, DOCX or TXT file.'));
    }
    callback(null, true);
  }
});
