const crypto = require('crypto');

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

module.exports = function csrf(req, res, next) {
  if (!UNSAFE.has(req.method)) return next();

  // Login authenticates by credentials, not by cookie — a stale sims_token
  // left in the browser (expired/revoked session) must never be able to
  // block a fresh login with a 403 the client can't recover from.
  if (req.path === '/auth/login') return next();

  // Only enforce CSRF for authenticated sessions; unauthenticated requests
  // will be rejected by the authenticate middleware downstream.
  if (!req.cookies?.sims_token) return next();

  const cookieToken = req.cookies?.sims_csrf;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: true, code: 'CSRF_MISSING', message: 'CSRF token missing.' });
  }

  let valid = false;
  try {
    const a = Buffer.from(cookieToken);
    const b = Buffer.from(headerToken);
    valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    valid = false;
  }

  if (!valid) {
    return res.status(403).json({ error: true, code: 'CSRF_INVALID', message: 'CSRF token invalid.' });
  }

  next();
};
