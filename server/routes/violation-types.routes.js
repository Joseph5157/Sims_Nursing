const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { createViolationTypeSchema, updateViolationTypeSchema } = require('../schemas/violation-types.schema');
const ctrl = require('../controllers/violation-types.controller');

const router = Router();

router.use(authenticate);

// GET /violation-types — All Auth
router.get('/', asyncHandler(ctrl.listViolationTypes));

// POST /violation-types — Admin
router.post('/', authorize('admin', 'super_admin'), validate(createViolationTypeSchema), asyncHandler(ctrl.createViolationType));

// PATCH /violation-types/:id/deactivate — Admin
router.patch('/:id/deactivate', authorize('admin', 'super_admin'), asyncHandler(ctrl.deactivateViolationType));

// PATCH /violation-types/:id/reactivate — Admin
router.patch('/:id/reactivate', authorize('admin', 'super_admin'), asyncHandler(ctrl.reactivateViolationType));

// PATCH /violation-types/:id — Admin
router.patch('/:id', authorize('admin', 'super_admin'), validate(updateViolationTypeSchema), asyncHandler(ctrl.updateViolationType));

// DELETE /violation-types/:id — Admin
router.delete('/:id', authorize('admin', 'super_admin'), asyncHandler(ctrl.deleteViolationType));

module.exports = router;
