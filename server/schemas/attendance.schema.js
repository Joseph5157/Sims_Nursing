const { z } = require('zod');

const overrideSchema = z
  .object({
    in_time: z.string().datetime({ offset: true }).optional(),
    out_time: z.string().datetime({ offset: true }).optional(),
    in_status: z.enum(['normal', 'late', 'absent']).optional(),
    out_status: z.enum(['normal', 'auto']).optional(),
    override_reason: z.string().min(1, 'Override reason is required.').max(500),
  })
  .refine(
    (d) => d.in_time || d.out_time || d.in_status !== undefined || d.out_status !== undefined,
    { message: 'At least one attendance field must be provided.' },
  );

module.exports = { overrideSchema };
