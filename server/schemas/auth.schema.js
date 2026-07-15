const { z } = require('zod');

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(200).optional(),
  // Kept for backward compatibility with older clients during rollout.
  email: z.string().trim().email('A valid email address is required.').max(200).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
}).refine((value) => Boolean(value.identifier || value.email), {
  message: 'SIMS ID or email is required.',
  path: ['identifier'],
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
