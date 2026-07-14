const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const ctrl = require('../controllers/duty-reassignment-requests.controller');
const { createRequestSchema, respondRequestSchema } = require('../schemas/duty-reassignment-requests.schema');

const router = Router();
router.use(authenticate, authorize('faculty'));

// GET /duty-reassignment-requests/eligible-faculty/:dutySlotId — dropdown data source
router.get('/eligible-faculty/:dutySlotId', asyncHandler(ctrl.getEligibleFaculty));

// GET /duty-reassignment-requests/sent — requests I sent, any status
router.get('/sent', asyncHandler(ctrl.listSentRequests));

// POST /duty-reassignment-requests — Faculty initiates request
router.post('/', validate(createRequestSchema), asyncHandler(ctrl.createRequest));

// GET /duty-reassignment-requests — pending requests sent to me
router.get('/', asyncHandler(ctrl.listPendingRequests));

// PATCH /duty-reassignment-requests/:id — Faculty responds (approve/decline)
router.patch('/:id', validate(respondRequestSchema), asyncHandler(ctrl.respondToRequest));

// PATCH /duty-reassignment-requests/:id/cancel — requester withdraws their own pending request
router.patch('/:id/cancel', asyncHandler(ctrl.cancelRequest));

module.exports = router;
