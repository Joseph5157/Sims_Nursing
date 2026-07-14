const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { updateDutyTimingSettingsSchema } = require('../schemas/duty-timing-settings.schema');
const ctrl = require('../controllers/duty-timing-settings.controller');

const router = Router();

router.use(authenticate);

// GET /duty-timing-settings — any authenticated role (Faculty needs the
// session start times to display accurate labels on their own pages)
router.get('/', authorize('faculty', 'admin', 'super_admin'), asyncHandler(ctrl.getDutyTimingSettings));

// PATCH /duty-timing-settings — Admin, Super Admin
router.patch('/', authorize('admin', 'super_admin'), validate(updateDutyTimingSettingsSchema), asyncHandler(ctrl.updateDutyTimingSettings));

module.exports = router;
