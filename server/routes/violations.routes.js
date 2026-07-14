const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const {
  createViolationSchema,
  editViolationSchema,
  flagViolationSchema,
  resolveFlagSchema,
  deleteViolationSchema,
} = require('../schemas/violations.schema');
const ctrl = require('../controllers/violations.controller');

const router = Router();

router.use(authenticate);

// POST /violations — Faculty (on-duty) or Admin (ad-hoc, no duty slot); role-branched in controller
router.post('/', authorize('faculty', 'admin', 'super_admin'), validate(createViolationSchema), asyncHandler(ctrl.createViolation));

// GET /violations — Admin & Faculty (faculty see only their own due to authorization in controller)
router.get('/', authorize('faculty', 'admin', 'super_admin'), asyncHandler(ctrl.listViolations));

// GET /violations/my — Faculty (MUST be before /:id)
router.get('/my', authorize('faculty'), asyncHandler(ctrl.myViolations));

// GET /violations/my/pdf — Faculty (own violations PDF export, filtered by duty_slot_id)
router.get('/my/pdf', authorize('faculty'), asyncHandler(ctrl.myViolationsPdfExport));

// GET /violations/:id — All Auth
router.get('/:id', asyncHandler(ctrl.getViolation));

// PATCH /violations/:id — Faculty edit
router.patch('/:id', authorize('faculty'), validate(editViolationSchema), asyncHandler(ctrl.editViolation));

// DELETE /violations/:id — Admin (any) / Faculty (own only, checked in controller)
router.delete('/:id', authorize('faculty', 'admin', 'super_admin'), validate(deleteViolationSchema), asyncHandler(ctrl.deleteViolation));

// PATCH /violations/:id/flag — Faculty
router.patch('/:id/flag', authorize('faculty'), validate(flagViolationSchema), asyncHandler(ctrl.flagViolation));

// PATCH /violations/:id/resolve-flag — Admin
router.patch('/:id/resolve-flag', authorize('admin', 'super_admin'), validate(resolveFlagSchema), asyncHandler(ctrl.resolveFlag));

// GET /violations/:id/photo — Foundation placeholder
router.get('/:id/photo', authorize('admin', 'super_admin'), asyncHandler(ctrl.getPhoto));

module.exports = router;
