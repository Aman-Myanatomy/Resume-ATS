import express from 'express';
import { signup, login, me } from '../controllers/auth.controllers.js';
import { authLimiter } from '../config/security.config.js';
import { requireAuth, requireDatabase } from '../middlewares/auth.middlewares.js';

const router = express.Router();

router.use(requireDatabase);

router.post('/signup', authLimiter, signup);
router.post(['/login', '/signin'], authLimiter, login);
router.get('/me', requireAuth, me);

export default router;
