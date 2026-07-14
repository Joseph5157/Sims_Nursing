const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../middleware/asyncHandler');
const { loginSchema, changePasswordSchema } = require('../schemas/auth.schema');
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

// POST /auth/login — Public (username/password)
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(ctrl.login));

// POST /auth/change-password — All Auth
router.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(ctrl.changePassword));

// POST /auth/logout — All Auth
router.post('/logout', authenticate, asyncHandler(ctrl.logout));

module.exports = router;
