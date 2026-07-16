const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../middleware/asyncHandler');
const { loginSchema, changePasswordSchema, telegramLoginTokenParamSchema, otpRequestSchema, otpVerifySchema } = require('../schemas/auth.schema');
const ctrl = require('../controllers/auth.controller');

const router = Router();

// Rate limit for login endpoint — allows for shared college Wi-Fi (50 requests per 15 minutes per IP)
// Relaxed from 5 to accommodate many faculty on same public IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, code: 'RATE_LIMITED', message: 'Too many login requests. Please try again later.' },
});

// Separate limiter for the Telegram magic-link claim route — defense in depth
// against brute-force token guessing, even though tokens are 32-byte-random
// and not realistically guessable (022-telegram-magic-link-login).
const telegramLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' },
});

// Separate limiter for OTP code request (024-telegram-otp-login) — per-IP, not per-account.
// Per-account throttle is enforced in the controller (60s between requests for same user).
// This IP-level throttle defends against bulk enumeration attempts.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, code: 'RATE_LIMITED', message: 'Too many code requests. Please try again later.' },
});

// Separate limiter for OTP code verification (024-telegram-otp-login) — per-IP defense
// against brute-force guessing. Per-account attempt counter is enforced in the controller.
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, code: 'RATE_LIMITED', message: 'Too many code verification attempts. Please try again later.' },
});

// POST /auth/login — Public (username/password)
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(ctrl.login));

// GET /auth/telegram/:token — Public (Telegram magic-link login)
router.get(
  '/telegram/:token',
  telegramLoginLimiter,
  validate(telegramLoginTokenParamSchema, 'params'),
  asyncHandler(ctrl.telegramLogin),
);

// POST /auth/otp/request — Public (Telegram OTP code request, 024-telegram-otp-login)
router.post('/otp/request', otpRequestLimiter, validate(otpRequestSchema), asyncHandler(ctrl.requestOtp));

// POST /auth/otp/verify — Public (Telegram OTP code verification, 024-telegram-otp-login)
router.post('/otp/verify', otpVerifyLimiter, validate(otpVerifySchema), asyncHandler(ctrl.verifyOtp));

// POST /auth/change-password — All Auth
router.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(ctrl.changePassword));

// POST /auth/logout — All Auth
router.post('/logout', authenticate, asyncHandler(ctrl.logout));

module.exports = router;
