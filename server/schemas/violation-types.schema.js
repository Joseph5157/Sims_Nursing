const { z } = require('zod');

const createViolationTypeSchema = z.object({
  name:         z.string().min(1).max(150),
  default_fine: z.number().nonnegative('Default fine must be 0 or greater.'),
});

const updateViolationTypeSchema = z
  .object({
    name:         z.string().min(1).max(150).optional(),
    default_fine: z.number().nonnegative().optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.default_fine !== undefined,
    { message: 'At least one field must be provided.' },
  );

module.exports = { createViolationTypeSchema, updateViolationTypeSchema };
