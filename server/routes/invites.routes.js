const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { createInviteSchema } = require('../schemas/invites.schema');
const ctrl = require('../controllers/invites.controller');

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /invites — create new invite
router.post(
  '/',
  authorize('admin', 'super_admin'),
  validate(createInviteSchema),
  asyncHandler(ctrl.createInvite)
);

// GET /invites — list pending invites
router.get(
  '/',
  authorize('admin', 'super_admin'),
  asyncHandler(ctrl.listInvites)
);

// POST /invites/:id/regenerate — regenerate invite link
router.post(
  '/:id/regenerate',
  authorize('admin', 'super_admin'),
  asyncHandler(ctrl.regenerateInvite)
);

// DELETE /invites/:id — cancel invite
router.delete(
  '/:id',
  authorize('admin', 'super_admin'),
  asyncHandler(ctrl.cancelInvite)
);

module.exports = router;
