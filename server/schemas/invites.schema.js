const { z } = require('zod');

const createInviteSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(20).optional().nullable(),
  role: z.enum(['admin', 'faculty']),
  department: z.string().trim().max(100).optional().nullable(),
  designation: z.string().trim().max(100).optional().nullable(),
  title: z.string().trim().max(20).optional().nullable(),
});

module.exports = { createInviteSchema };
