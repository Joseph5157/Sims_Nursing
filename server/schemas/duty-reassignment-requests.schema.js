const { z } = require('zod');

const createRequestSchema = z.object({
  duty_slot_id:  z.string().uuid('Invalid duty slot ID.'),
  to_faculty_id: z.string().uuid('Invalid faculty ID.'),
  reason:        z.string().min(1).max(500).optional(),
});

const respondRequestSchema = z.object({
  status: z.enum(['approved', 'declined']),
});

module.exports = { createRequestSchema, respondRequestSchema };
