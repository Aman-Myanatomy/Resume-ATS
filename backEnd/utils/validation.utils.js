export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function validateCredentials({ name, email, password }, isSignup = false) {
  if (isSignup && (!name || typeof name !== 'string' || !name.trim())) {
    return 'Name is required.';
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return 'A valid email address is required.';
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }

  return null;
}

