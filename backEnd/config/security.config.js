import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

/**
 * Helmet Security Headers Configuration
 */
export const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
});

/**
 * Counts signed-in users per account and visitors per IP, so a whole office behind one
 * IP address doesn't share a single limit. Only a validly signed token counts as an account.
 */
function rateLimitKey(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ') && process.env.JWT_SECRET) {
    try {
      return `user:${jwt.verify(header.slice(7), process.env.JWT_SECRET).sub}`;
    } catch {
      // fall through to IP
    }
  }
  return `ip:${req.ip}`;
}

/**
 * Global API Rate Limiter
 * 600 requests per 15 minutes per user (or per IP when signed out). The employer pipeline
 * and notification bell poll in the background, so this is higher than a typical API.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: Number(process.env.API_RATE_LIMIT) || 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  // Logo images are cached forever by browsers and a board page shows many; don't count them.
  skip: req => req.method === 'GET' && /^\/companies\/[^/]+\/logo$/.test(req.path),
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

/**
 * Limits calls that trigger a paid AI model call (analyze, fit check, apply), per signed-in user.
 * Runs after requireAuth, so req.auth.sub is always set.
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: Number(process.env.AI_RATE_LIMIT) || 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: req => `user:${req.auth?.sub}`,
  message: { error: 'You have reached the hourly limit for AI resume checks. Try again in a little while.' }
});
