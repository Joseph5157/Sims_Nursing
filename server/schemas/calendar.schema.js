const { z } = require('zod');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.');

const blockedDatesSchema = z.object({
  blocked_dates: z.array(isoDate).min(0),
});

const sessionsPerFacultySchema = z.object({
  sessions_per_faculty: z.number().int().min(1).max(31),
});

const workingDaysSchema = z.object({
  working_days: z.array(isoDate).min(0),
});

const assignSlotsSchema = z.object({
  slots: z
    .array(
      z.object({
        duty_date: isoDate,
        session_type: z.enum(['morning', 'afternoon']),
      }),
    )
    .min(1, 'At least one slot is required.'),
});

module.exports = { blockedDatesSchema, workingDaysSchema, sessionsPerFacultySchema, assignSlotsSchema };
