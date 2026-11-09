import jwt from 'jsonwebtoken';
import User from '../models/user.models.js';
import Company from '../models/company.models.js';

/**
 * A member's role in their company. Accounts created before roles existed
 * have no companyRole: the company owner counts as owner, anyone else as recruiter.
 */
export function companyRoleOf(user, company) {
  if (user.companyRole) return user.companyRole;
  return company && String(company.owner) === String(user._id) ? 'owner' : 'recruiter';
}

function readToken(req) {
  const header = req.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/**
 * Authentication Middleware
 * Validates incoming Bearer JWT tokens.
 */
export function requireAuth(req, res, next) {
  const token = readToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

/**
 * Attaches req.auth when a valid token is present, but never rejects the request.
 * Used by public job pages that show extra info to signed-in candidates.
 */
export function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.auth = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      req.auth = undefined;
    }
  }
  next();
}

/**
 * Loads the employer and their company from the database (never trusts the token's role alone)
 * and exposes req.employer = { userId, name, email, companyId, company, role }.
 */
export async function requireEmployer(req, res, next) {
  try {
    const user = await User.findById(req.auth.sub).select('name email role company companyRole active');
    if (!user || user.active === false) {
      return res.status(401).json({ error: 'Your access was removed. Contact your company admin.' });
    }
    if (user.role !== 'employer' || !user.company) {
      return res.status(403).json({ error: 'This area is for employer accounts.' });
    }
    const company = await Company.findById(user.company);
    if (!company) return res.status(403).json({ error: 'Your company no longer exists.' });
    req.employer = {
      userId: user._id,
      name: user.name,
      email: user.email,
      companyId: company._id,
      company,
      role: companyRoleOf(user, company)
    };
    next();
  } catch (error) {
    next(error);
  }
}

/** Team, billing and company profile changes: owners and admins only. Use after requireEmployer. */
export function requireCompanyAdmin(req, res, next) {
  if (req.employer?.role === 'owner' || req.employer?.role === 'admin') return next();
  return res.status(403).json({ error: 'Only company owners and admins can do this. Ask an admin on your team.' });
}

export async function requireCandidate(req, res, next) {
  try {
    const user = await User.findById(req.auth.sub).select('role');
    if (!user || user.role !== 'candidate') {
      return res.status(403).json({ error: 'Only candidate accounts can do this. Sign in with a job seeker account.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Job board features need MongoDB. Fail fast when it isn't configured at all.
 * During a brief reconnect Mongoose buffers queries itself, so connection state isn't checked here.
 */
export function requireDatabase(req, res, next) {
  if (!process.env.MONGO_URI) {
    return res.status(503).json({ error: 'The database is not connected. Check MONGO_URI and restart the server.' });
  }
  next();
}
