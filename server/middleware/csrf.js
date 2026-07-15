const crypto = require('crypto');

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

module.exports = function csrf(req, res, next) {
  if (!UNSAFE.has(req.method)) return next();

  // Unauthenticated credential endpoints are exempt from CSRF:
  // - /auth/login: authenticates by credentials, not by cookie
  // - /auth/otp/request and /auth/otp/verify: credential-based OTP login (024-telegram-otp-login)
  // A stale sims_token left in the browser must never be able to block fresh login with a 403
  // the client can't recover from. See specs/024-telegram-otp-login/contracts/otp-login-endpoints.md
  if (req.path === '/auth/login' || req.path === '/auth/otp/request' || req.path === '/auth/otp/verify') {
    return next();
  }

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
