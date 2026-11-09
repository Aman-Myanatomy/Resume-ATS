import crypto from 'crypto';
import mongoose from 'mongoose';

/** Creates an Error carrying an HTTP status for the central error handler. */
export function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function assertObjectId(id, label = 'Resource') {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, `${label} not found.`);
}

export function hashText(text) {
  return crypto.createHash('sha256').update(String(text).trim()).digest('hex');
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'company';
}

/** Parses a JSON field that may arrive as a string inside multipart form data. */
export function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw httpError(400, 'Some form data was malformed. Refresh the page and try again.');
  }
}
