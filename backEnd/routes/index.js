import express from 'express';
import authRoutes from './auth.routes.js';
import analysisRoutes from './analysis.routes.js';
import jobRoutes from './job.routes.js';
import candidateRoutes from './candidate.routes.js';
import employerRoutes from './employer.routes.js';
import notificationRoutes from './notification.routes.js';
import { analyze } from '../controllers/analysis.controllers.js';
import { requireAuth } from '../middlewares/auth.middlewares.js';
import { uploadMiddleware } from '../middlewares/upload.middlewares.js';
import { aiLimiter } from '../config/security.config.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/analyses', analysisRoutes);
// Kept for the existing frontend, which posts to /api/analyze.
router.post('/analyze', requireAuth, aiLimiter, uploadMiddleware.single('resume'), analyze);

router.use('/me', candidateRoutes);
router.use('/employer', employerRoutes);
router.use('/notifications', notificationRoutes);
router.use('/', jobRoutes);

export default router;
