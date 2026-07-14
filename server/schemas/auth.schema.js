const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('A valid email address is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(8, 'Current password must be at least 8 characters.'),
  new_password: z.string().min(8, 'New password must be at least 8 characters.'),
});

module.exports = { loginSchema, changePasswordSchema };
