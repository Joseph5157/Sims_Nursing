const { z } = require('zod');

// Query params arrive as strings — z.coerce.number() handles the conversion.

const yearMonthQuery = z.object({
  year:  z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const studentViolationQuery = yearMonthQuery.extend({
  student_id:        z.string().uuid('Invalid student ID.').optional(),
  course:             z.enum(['b_pharm', 'pharm_d', 'm_pharm']).optional(),
  student_year:       z.coerce.number().int().min(1).max(6).optional(),
  violation_type_id:  z.string().uuid('Invalid violation type ID.').optional(),
  faculty_id:         z.string().uuid('Invalid faculty ID.').optional(),
});

const dailyViolationQuery = z.object({
  course:             z.enum(['b_pharm', 'pharm_d', 'm_pharm']).optional(),
  student_year:       z.coerce.number().int().min(1).max(6).optional(),
  violation_type_id:  z.string().uuid('Invalid violation type ID.').optional(),
  faculty_id:         z.string().uuid('Invalid faculty ID.').optional(),
});

const weeklyViolationQuery = z.object({
  from_date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from_date must be in YYYY-MM-DD format.'),
  to_date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to_date must be in YYYY-MM-DD format.'),
  course:             z.enum(['b_pharm', 'pharm_d', 'm_pharm']).optional(),
  student_year:       z.coerce.number().int().min(1).max(6).optional(),
  violation_type_id:  z.string().uuid('Invalid violation type ID.').optional(),
  faculty_id:         z.string().uuid('Invalid faculty ID.').optional(),
});

const facultyActivityQuery = yearMonthQuery.extend({
  faculty_id: z.string().uuid('Invalid faculty ID.').optional(),
});

const activeStudentsQuery = z.object({
  course:           z.string().max(50).optional(),
  semester_or_year: z.string().max(20).optional(),
});

module.exports = {
  yearMonthQuery,
  studentViolationQuery,
  dailyViolationQuery,
  weeklyViolationQuery,
  facultyActivityQuery,
  activeStudentsQuery,
};
