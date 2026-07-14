const { Router } = require('express');
const multer = require('multer');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { promoteSchema, bulkPromoteSchema, bulkDeleteSchema } = require('../schemas/students.schema');
const ctrl = require('../controllers/students.controller');

const router = Router();

// Memory storage — file never touches disk, processed directly from buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(req, file, cb) {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error('Only .xlsx and .xls files are accepted.'), { code: 'INVALID_MIME' }));
  },
});

function handleUploadError(err, req, res, next) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: true, code: 'FILE_TOO_LARGE', message: 'File must be under 5 MB.' });
  }
  if (err?.code === 'INVALID_MIME') {
    return res.status(415).json({ error: true, code: 'INVALID_FILE_TYPE', message: err.message });
  }
  next(err);
}

router.use(authenticate);

// POST /students/upload — Admin only
router.post(
  '/upload',
  authorize('admin', 'super_admin'),
  upload.single('file'),
  handleUploadError,
  asyncHandler(ctrl.uploadStudents),
);

// GET /students/upload-template — Admin only (returns .xlsx sample file)
router.get('/upload-template', authorize('admin', 'super_admin'), asyncHandler(ctrl.downloadTemplate));

// GET /students/upload-logs — Admin only
router.get('/upload-logs', authorize('admin', 'super_admin'), asyncHandler(ctrl.getUploadLogs));

// GET /students/search — All Auth (autocomplete for violation form)
router.get('/search', asyncHandler(ctrl.searchStudents));

// GET /students — Admin only
router.get('/', authorize('admin', 'super_admin'), asyncHandler(ctrl.listStudents));

// GET /students/:id — Admin only (MUST be after literal /upload-*, /search routes above)
router.get('/:id', authorize('admin', 'super_admin'), asyncHandler(ctrl.getStudent));

// PATCH /students/bulk/promote — Admin only (MUST be before /:id/promote — see note above)
router.patch('/bulk/promote', authorize('admin', 'super_admin'), validate(bulkPromoteSchema), asyncHandler(ctrl.bulkPromoteStudents));

// DELETE /students/bulk — Super Admin only (hard delete)
router.delete('/bulk', authorize('super_admin'), validate(bulkDeleteSchema), asyncHandler(ctrl.bulkDeleteStudents));

// PATCH /students/:id/promote — Admin only
router.patch('/:id/promote', authorize('admin', 'super_admin'), validate(promoteSchema), asyncHandler(ctrl.promoteStudent));

// DELETE /students/:id — Super Admin only (hard delete)
router.delete('/:id', authorize('super_admin'), asyncHandler(ctrl.deleteStudent));

module.exports = router;
