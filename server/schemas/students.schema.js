const { z } = require('zod');

const promoteSchema = z.object({
  year:          z.number().int().min(1).max(6),
  semester:      z.number().int().min(1).max(12),
  academic_year: z.string().regex(/^\d{4}-\d{2,4}$/, 'Format must be e.g. 2024-25').optional(),
});

const bulkPromoteSchema = promoteSchema.extend({
  ids: z.array(z.string()).min(1),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1),
});

module.exports = { promoteSchema, bulkPromoteSchema, bulkDeleteSchema };
