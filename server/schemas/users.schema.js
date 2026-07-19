const { z } = require('zod');

const AVATAR_OPTIONS = ['male_professor', 'female_professor', 'admin', 'super_admin'];

const updateProfileSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  department: z.string().max(100).optional(),
  designation: z.string().max(100).optional(),
  title: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  avatar: z.enum(AVATAR_OPTIONS).nullable().optional(),
});

// Unset UI filters arrive as empty strings (the Audit Logs page sends
// ?action=&from=&to=&page=1&limit=50). Treat blank as "absent" so a normal,
// unfiltered page load isn't rejected.
const blankToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

// YYYY-MM-DD only, and must parse to a real instant — this is the fix for the
// 500 that `new Date('2026-99-99')` (→ Invalid Date → Prisma error) would cause
// in getAuditLogs.
const isoDate = z.preprocess(
  blankToUndef,
  z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.')
    .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00`).getTime()), 'Not a valid calendar date.')
    .optional(),
);

// GET /admin/audit-logs query validation.
const auditLogsQuery = z.object({
  actor:  z.preprocess(blankToUndef, z.string().uuid('Invalid actor id.').optional()),
  action: z.preprocess(blankToUndef, z.string().max(50).optional()),
  from:   isoDate,
  to:     isoDate,
  // Controller still clamps page/limit; this only rejects non-numeric garbage.
  page:   z.preprocess(blankToUndef, z.coerce.number().int().min(1).optional()),
  limit:  z.preprocess(blankToUndef, z.coerce.number().int().min(1).optional()),
});

module.exports = { updateProfileSchema, AVATAR_OPTIONS, auditLogsQuery };
