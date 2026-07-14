const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { overrideSchema } = require('../schemas/attendance.schema');
const ctrl = require('../controllers/attendance.controller');

const router = Router();

router.use(authenticate);

// GET /attendance/live — Admin (before /:dutySlotId to avoid param conflict)
router.get('/live', authorize('admin', 'super_admin'), asyncHandler(ctrl.getLive));

// GET /attendance/mine/summary — Faculty's own personalized attendance dashboard
router.get('/mine/summary', authorize('faculty'), asyncHandler(ctrl.getMySummary));

// POST /attendance/:dutySlotId/check-in — Faculty
router.post('/:dutySlotId/check-in', authorize('faculty'), asyncHandler(ctrl.checkIn));

// POST /attendance/:dutySlotId/check-out — Faculty
router.post('/:dutySlotId/check-out', authorize('faculty'), asyncHandler(ctrl.checkOut));

// GET /attendance/:dutySlotId — All Auth
router.get('/:dutySlotId', asyncHandler(ctrl.getAttendance));

// PATCH /attendance/:dutySlotId/override — Admin
router.patch('/:dutySlotId/override', authorize('admin', 'super_admin'), validate(overrideSchema), asyncHandler(ctrl.overrideAttendance));

module.exports = router;
