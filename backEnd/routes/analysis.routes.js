import express from 'express';
import { analyze, getAnalyses, getAnalysisById } from '../controllers/analysis.controllers.js';
import { requireAuth } from '../middlewares/auth.middlewares.js';
import { uploadMiddleware } from '../middlewares/upload.middlewares.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getAnalyses);
router.get('/:id', getAnalysisById);
router.post('/analyze', uploadMiddleware.single('resume'), analyze);

export default router;
