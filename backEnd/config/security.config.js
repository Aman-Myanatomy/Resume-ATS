import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/**
 * Helmet Security Headers Configuration
 */
export const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
});

/**
 * Global API Rate Limiter
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' }
});

/**
 * Authentication Route Specific Rate Limiter
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === 'production' ? 10 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again later.' }
});

