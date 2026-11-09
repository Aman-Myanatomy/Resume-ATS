import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { USER_ROLES } from '../models/user.models.js';
import { createCompany } from './company.services.js';
import { normalizeEmail, validateCredentials } from '../utils/validation.utils.js';
import { httpError } from '../utils/http.utils.js';
import { companyRoleOf } from '../middlewares/auth.middlewares.js';

export function createAccessToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role || 'candidate' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

export function sanitizeUser(user) {
  const populated = user.company && typeof user.company === 'object' && user.company.name;
  const company = populated
    ? { id: user.company._id, name: user.company.name, slug: user.company.slug }
    : null;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || 'candidate',
    company,
    // owner | admin | recruiter (employers only)
    companyRole: user.role === 'employer' && populated ? companyRoleOf(user, user.company) : null
  };
}

const REMOVED_MESSAGE = 'Your access to this company was removed. Contact your company admin.';

export async function registerUser({ name, email, password, role = 'candidate', companyName }) {
  const validationError = validateCredentials({ name, email, password }, true);
  if (validationError) throw httpError(400, validationError);

  if (!USER_ROLES.includes(role)) throw httpError(400, 'Choose whether you are hiring or looking for a job.');
  if (role === 'employer' && (!companyName || !String(companyName).trim())) {
    throw httpError(400, 'Company name is required for employer accounts.');
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) throw httpError(409, 'An account with this email already exists.');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    companyRole: role === 'employer' ? 'owner' : undefined
  });

  if (role === 'employer') {
    try {
      const company = await createCompany({ name: companyName, ownerId: user._id });
      user.company = company._id;
      await user.save();
      user.company = company;
    } catch (error) {
      // Don't leave an employer account without a company behind.
      await User.deleteOne({ _id: user._id });
      throw error;
    }
  }

  const token = createAccessToken(user);
  return { user: sanitizeUser(user), token };
}

export async function authenticateUser({ email, password }) {
  const validationError = validateCredentials({ email, password }, false);
  if (validationError) throw httpError(400, validationError);

  const user = await User.findOne({ email: normalizeEmail(email) })
    .select('+passwordHash')
    .populate('company', 'name slug owner');
  const isValidPassword = user && (await bcrypt.compare(password, user.passwordHash));

  if (!isValidPassword) throw httpError(401, 'Email or password is incorrect.');
  if (user.active === false) throw httpError(403, REMOVED_MESSAGE);

  user.lastLoginAt = new Date();
  await user.save();

  const token = createAccessToken(user);
  return { user: sanitizeUser(user), token };
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId).populate('company', 'name slug owner');
  if (!user) throw httpError(401, 'Your account no longer exists. Please sign up again.');
  if (user.active === false) throw httpError(401, REMOVED_MESSAGE);
  return { user: sanitizeUser(user), token: createAccessToken(user) };
}
