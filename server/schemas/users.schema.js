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

module.exports = { updateProfileSchema, AVATAR_OPTIONS };
