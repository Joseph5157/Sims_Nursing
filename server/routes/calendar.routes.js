const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { blockedDatesSchema, workingDaysSchema, sessionsPerFacultySchema, assignSlotsSchema } = require('../schemas/calendar.schema');
const ctrl = require('../controllers/calendar.controller');

const router = Router();

router.use(authenticate);

// GET /calendar/:year/:month — All Auth
router.get('/:year/:month', asyncHandler(ctrl.getConfig));

// POST /calendar/:year/:month/open — Admin
router.post('/:year/:month/open', authorize('admin', 'super_admin'), asyncHandler(ctrl.openWindow));

// POST /calendar/:year/:month/close — Admin
router.post('/:year/:month/close', authorize('admin', 'super_admin'), asyncHandler(ctrl.closeWindow));

// PATCH /calendar/:year/:month/blocked-dates — Admin
router.patch('/:year/:month/blocked-dates', authorize('admin', 'super_admin'), validate(blockedDatesSchema), asyncHandler(ctrl.updateBlockedDates));

// PATCH /calendar/:year/:month/working-days — Admin
router.patch('/:year/:month/working-days', authorize('admin', 'super_admin'), validate(workingDaysSchema), asyncHandler(ctrl.updateWorkingDays));

// PATCH /calendar/:year/:month/sessions-per-faculty — Admin
router.patch('/:year/:month/sessions-per-faculty', authorize('admin', 'super_admin'), validate(sessionsPerFacultySchema), asyncHandler(ctrl.updateSessionsPerFaculty));

// GET /calendar/:year/:month/unassigned-faculty — Admin
router.get('/:year/:month/unassigned-faculty', authorize('admin', 'super_admin'), asyncHandler(ctrl.getUnassignedFaculty));

// POST /calendar/:year/:month/assign/:facultyId — Admin
router.post('/:year/:month/assign/:facultyId', authorize('admin', 'super_admin'), validate(assignSlotsSchema), asyncHandler(ctrl.assignSlots));

module.exports = router;
