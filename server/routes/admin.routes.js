const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const validateQuery = require('../middleware/validateQuery');
const asyncHandler = require('../middleware/asyncHandler');
const ctrl = require('../controllers/users.controller');
const { auditLogsQuery } = require('../schemas/users.schema');
// Reuses duty-timing-settings' schema rather than the deleted settings.schema.js:
// that old schema (removed in 555b263) still validated a single shared
// `auto_checkout_hour`/`auto_checkout_min` pair, which stopped being real
// SystemConfig columns once ae5a603 split auto-checkout per session — it was
// already stale before this route was dropped. Every field on SystemConfig
// today is one of these 12 timing fields, so this is the correct current shape.
const { updateDutyTimingSettingsSchema } = require('../schemas/duty-timing-settings.schema');

const router = Router();

// All /admin routes require authentication + Super Admin role
router.use(authenticate, authorize('super_admin'));

// GET /admin/audit-logs
router.get('/audit-logs', validateQuery(auditLogsQuery), asyncHandler(ctrl.getAuditLogs));

// POST /admin/users/:id/reset-login
router.post('/users/:id/reset-login', asyncHandler(ctrl.resetUserLogin));

// DELETE /admin/hard-delete/:resource/:id
router.delete('/hard-delete/:resource/:id', asyncHandler(ctrl.hardDelete));

// GET /admin/settings
router.get('/settings', asyncHandler(ctrl.getSettings));

// PATCH /admin/settings
router.patch('/settings', validate(updateDutyTimingSettingsSchema), asyncHandler(ctrl.updateSettings));

module.exports = router;
