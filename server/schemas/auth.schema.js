const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('A valid email address is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(8, 'Current password must be at least 8 characters.'),
  new_password: z.string().min(8, 'New password must be at least 8 characters.'),
});

// Telegram magic-link login token — a 32-byte crypto.randomBytes hex string is 64 hex chars,
// but bound generously to stay compatible if the generation scheme changes.
const telegramLoginTokenParamSchema = z.object({
  token: z.string().min(16).max(100).regex(/^[a-f0-9]+$/i, 'Invalid token format.'),
});

module.exports = { loginSchema, changePasswordSchema, telegramLoginTokenParamSchema };
