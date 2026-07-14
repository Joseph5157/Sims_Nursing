const { z } = require('zod');

const sendMessageSchema = z.object({
  to_user_id: z.string().uuid('Invalid recipient ID.'),
  subject:    z.string().min(1).max(255),
  body:       z.string().min(1, 'Message body cannot be empty.'),
});

module.exports = { sendMessageSchema };
