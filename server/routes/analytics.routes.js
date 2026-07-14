const { Router }    = require('express');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');
const validateQuery = require('../middleware/validateQuery');
const asyncHandler  = require('../middleware/asyncHandler');
const ctrl          = require('../controllers/analytics.controller');
const { analyticsQuery, trendQuery } = require('../schemas/analytics.schema');

const router = Router();
router.use(authenticate, authorize('admin', 'super_admin'));

router.get('/summary',         validateQuery(analyticsQuery), asyncHandler(ctrl.summary));
router.get('/trend',           validateQuery(trendQuery),     asyncHandler(ctrl.trend));
router.get('/violation-types', validateQuery(analyticsQuery), asyncHandler(ctrl.violationTypeAnalysis));
router.get('/repeat-violators',validateQuery(analyticsQuery), asyncHandler(ctrl.repeatViolators));
router.get('/course-analysis', validateQuery(analyticsQuery), asyncHandler(ctrl.courseAnalysis));
router.get('/year-analysis',   validateQuery(analyticsQuery), asyncHandler(ctrl.yearAnalysis));
router.get('/faculty-analysis',validateQuery(analyticsQuery), asyncHandler(ctrl.facultyAnalysis));
router.get('/heatmap',         validateQuery(analyticsQuery), asyncHandler(ctrl.heatmap));
router.get('/export/counselling', validateQuery(analyticsQuery), asyncHandler(ctrl.exportCounselling));
router.get('/filter-options',  asyncHandler(ctrl.filterOptions));

module.exports = router;
