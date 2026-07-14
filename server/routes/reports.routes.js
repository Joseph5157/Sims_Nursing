const { Router }       = require('express');
const authenticate     = require('../middleware/authenticate');
const authorize        = require('../middleware/authorize');
const validateQuery    = require('../middleware/validateQuery');
const asyncHandler     = require('../middleware/asyncHandler');
const ctrl             = require('../controllers/reports.controller');
const {
  yearMonthQuery,
  studentViolationQuery,
  dailyViolationQuery,
  weeklyViolationQuery,
  facultyActivityQuery,
  activeStudentsQuery,
} = require('../schemas/reports.schema');

const router = Router();
router.use(authenticate, authorize('admin', 'super_admin'));

router.get('/monthly-attendance',   validateQuery(yearMonthQuery),          asyncHandler(ctrl.monthlyAttendanceSummary));
router.get('/late-arrivals',        validateQuery(yearMonthQuery),          asyncHandler(ctrl.lateArrivalReport));
router.get('/absent-faculty',       validateQuery(yearMonthQuery),          asyncHandler(ctrl.absentFacultyReport));
router.get('/auto-clockout',        validateQuery(yearMonthQuery),          asyncHandler(ctrl.autoClockOutReport));
router.get('/attendance-overrides', validateQuery(yearMonthQuery),          asyncHandler(ctrl.attendanceOverrideLog));
router.get('/student-violations/daily/:date/export', validateQuery(dailyViolationQuery),  asyncHandler(ctrl.dailyViolationReportExport));
router.get('/student-violations/daily/:date/pdf',    validateQuery(dailyViolationQuery),  asyncHandler(ctrl.dailyViolationReportPdfExport));
router.get('/student-violations/daily/:date',        validateQuery(dailyViolationQuery),  asyncHandler(ctrl.dailyViolationReport));
router.get('/student-violations/weekly/export',      validateQuery(weeklyViolationQuery), asyncHandler(ctrl.weeklyViolationReportExport));
router.get('/student-violations/weekly/pdf',         validateQuery(weeklyViolationQuery), asyncHandler(ctrl.weeklyViolationReportPdfExport));
router.get('/student-violations/weekly',             validateQuery(weeklyViolationQuery), asyncHandler(ctrl.weeklyViolationReport));
router.get('/student-violations/pdf',    validateQuery(studentViolationQuery), asyncHandler(ctrl.studentViolationReportPdfExport));
router.get('/student-violations/export', validateQuery(studentViolationQuery), asyncHandler(ctrl.studentViolationHistoryExport));
router.get('/student-violations',   validateQuery(studentViolationQuery),   asyncHandler(ctrl.studentViolationHistory));
router.get('/faculty-activity',     validateQuery(facultyActivityQuery),    asyncHandler(ctrl.facultyViolationActivity));
router.get('/violation-types',      validateQuery(yearMonthQuery),          asyncHandler(ctrl.violationTypeBreakdown));
router.get('/pending-fines',        asyncHandler(ctrl.pendingFinesSummary));
router.get('/flagged-violations',   asyncHandler(ctrl.flaggedViolationsReport));
router.get('/duty-coverage',        validateQuery(yearMonthQuery),          asyncHandler(ctrl.monthlyDutyCoverage));
router.get('/unassigned-faculty',   validateQuery(yearMonthQuery),          asyncHandler(ctrl.unassignedFacultyReport));
router.get('/duty-reassignments',   validateQuery(yearMonthQuery),          asyncHandler(ctrl.dutyReassignmentReport));
router.get('/completion-rate',      asyncHandler(ctrl.sessionCompletionRate));
router.get('/upload-history',       asyncHandler(ctrl.studentUploadHistory));
router.get('/active-students',      validateQuery(activeStudentsQuery),     asyncHandler(ctrl.activeStudentRoster));

module.exports = router;
