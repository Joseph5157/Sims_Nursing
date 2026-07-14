const { z } = require('zod');

// Shared filter set for every analytics endpoint — date range preset (or custom
// from/to), plus the dynamic student/violation-type filters from the P24 spec.
const analyticsQuery = z.object({
  range:             z.enum(['this_week', 'this_month', 'last_month', 'custom']).optional(),
  from_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD.').optional(),
  to_date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD.').optional(),
  course:            z.string().max(20).optional(),
  year:              z.coerce.number().int().min(1).max(12).optional(),
  academic_year:     z.string().max(10).optional(),
  violation_type_id: z.string().uuid('Invalid violation type ID.').optional(),
  threshold:         z.coerce.number().int().min(1).optional(),
});

const trendQuery = analyticsQuery.extend({
  months: z.coerce.number().int().min(1).max(24).optional(),
});

module.exports = { analyticsQuery, trendQuery };
