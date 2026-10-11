import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.models.js';
import { normalizeEmail, validateCredentials } from '../utils/validation.utils.js';

export function createAccessToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

export function sanitizeUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

export async function registerUser({ name, email, password }) {
  const validationError = validateCredentials({ name, email, password }, true);
  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    const error = new Error('An account with this email already exists.');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash
  });

  const token = createAccessToken(user);
  return { user: sanitizeUser(user), token };
}

export async function authenticateUser({ email, password }) {
  const validationError = validateCredentials({ email, password }, false);
  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email: normalizeEmail(email) }).select('+passwordHash');
  const isValidPassword = user && (await bcrypt.compare(password, user.passwordHash));

  if (!isValidPassword) {
    const error = new Error('Email or password is incorrect.');
    error.statusCode = 401;
    throw error;
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = createAccessToken(user);
  return { user: sanitizeUser(user), token };
}

