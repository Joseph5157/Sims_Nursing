const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { sendMessageSchema } = require('../schemas/messages.schema');
const ctrl = require('../controllers/messages.controller');

const router = Router();

router.use(authenticate);

// Named routes BEFORE /:id

// GET /messages/inbox — All Auth
router.get('/inbox', asyncHandler(ctrl.getInbox));

// GET /messages/sent — All Auth
router.get('/sent', asyncHandler(ctrl.getSent));

// POST /messages — All Auth
router.post('/', validate(sendMessageSchema), asyncHandler(ctrl.sendMessage));

// GET /messages/:id — All Auth (also auto-marks as read for receiver)
router.get('/:id', asyncHandler(ctrl.getMessage));

// PATCH /messages/:id/read — Receiver only
router.patch('/:id/read', asyncHandler(ctrl.markAsRead));

// DELETE /messages/:id — All Auth
router.delete('/:id', asyncHandler(ctrl.deleteMessage));

module.exports = router;
