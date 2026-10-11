import { registerUser, authenticateUser } from '../services/auth.services.js';

/**
 * Auth Controller Layer
 * Handles incoming HTTP Requests, delegates logic to auth.services, and returns HTTP Responses.
 */

export async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body || {};
    const result = await registerUser({ name, email, password });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const result = await authenticateUser({ email, password });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

