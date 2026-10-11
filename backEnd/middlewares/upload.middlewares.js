import multer from 'multer';

/**
 * File Upload Middleware using Multer (Memory Storage)
 */
const allowedMimeTypes = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, callback) => {
    callback(null, allowedMimeTypes.includes(file.mimetype));
  }
});

