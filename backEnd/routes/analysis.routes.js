import express from 'express';
import { analyze, getAnalyses, getAnalysisById } from '../controllers/analysis.controllers.js';
import { requireAuth } from '../middlewares/auth.middlewares.js';
import { uploadMiddleware } from '../middlewares/upload.middlewares.js';
import { aiLimiter } from '../config/security.config.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getAnalyses);
router.post('/analyze', aiLimiter, uploadMiddleware.single('resume'), analyze);
router.get('/:id', getAnalysisById);

export default router;
