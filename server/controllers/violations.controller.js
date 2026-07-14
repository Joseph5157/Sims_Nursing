const prisma = require('../lib/prisma');
const { isSlotToday } = require('../lib/time');
const { logAction } = require('../services/audit.service');
const { buildReportPdf, sendPdf } = require('../lib/pdf');

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Immutable audit entry for every violation change
async function auditViolation({ violationId, changedBy, changeType, oldData, newData, reason }) {
  await prisma.violationAuditLog.create({
    data: {
      violation_id: violationId,
      changed_by:   changedBy,
      change_type:  changeType,
      old_data:     oldData  ?? null,
      new_data:     newData  ?? null,
      reason:       reason   ?? null,
    },
  });
}

// Shared include for rich violation responses
const VIOLATION_INCLUDE = {
  student:       { select: { id: true, registration_number: true, student_name: true, course: true, semester_or_year: true } },
  faculty:       { select: { id: true, name: true, email: true, department: true, role: true } },
  dutySlot:      { select: { id: true, duty_date: true, session_type: true } },
  violationType: { select: { id: true, name: true, default_fine: true } },
};

function snapshotViolation(v) {
  return {
    custom_violation: v.custom_violation,
    fine_amount:      v.fine_amount?.toString(),
    is_warning_only:  v.is_warning_only,
    remarks:          v.remarks,
    record_status:    v.record_status,
    is_flagged:       v.is_flagged,
    flag_note:        v.flag_note,
  };
}

// ─── POST /violations ─────────────────────────────────────────────────────────

async function createViolation(req, res) {
  const { student_id, duty_slot_id, violation_type_id, custom_violation, fine_amount, is_warning_only, remarks } = req.body;

  // Admins have unrestricted recording authority: they oversee discipline at all
  // times, so they may record with no duty slot, on any date, without checking in.
  // Faculty remain gated to their own active duty session.
  const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

  // Resolve the duty slot when one is supplied (required for faculty, optional for
  // admin). For admin ad-hoc records `resolvedDutySlotId` stays null.
  let resolvedDutySlotId = null;
  if (duty_slot_id) {
    const slot = await prisma.dutySlot.findUnique({ where: { id: duty_slot_id } });
    if (!slot) {
      return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Duty slot not found.' });
    }
    if (!isAdmin) {
      // Verify the requesting faculty is the current owner of this slot (after any
      // admin reassignment, faculty_id is the new owner).
      if (slot.faculty_id !== req.user.id) {
        return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'You can only record student violations for your own duty slots.' });
      }
      // Reject unless faculty is actively on duty: slot must be today and the faculty
      // must be checked in (in_time set) but not yet checked out (out_time null).
      if (!isSlotToday(slot.duty_date)) {
        return res.status(409).json({ error: true, code: 'NOT_ON_DUTY', message: 'Student violations can only be recorded during an active duty session.' });
      }
      const activeAttendance = await prisma.dutyAttendance.findUnique({ where: { duty_slot_id: slot.id } });
      if (!activeAttendance?.in_time || activeAttendance.out_time !== null) {
        return res.status(409).json({ error: true, code: 'NOT_ON_DUTY', message: 'Student violations can only be recorded during an active duty session.' });
      }
    }
    resolvedDutySlotId = slot.id;
  } else if (!isAdmin) {
    // Faculty must always record against one of their duty slots.
    return res.status(422).json({ error: true, code: 'VALIDATION_ERROR', message: 'A duty slot is required to record a student violation.' });
  }

  // Verify student exists and is active
  const student = await prisma.student.findUnique({ where: { id: student_id } });
  if (!student || student.deleted_at || student.status !== 'active') {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student not found or inactive.' });
  }

  // Verify violation type exists and is active
  const violationType = await prisma.violationType.findUnique({ where: { id: violation_type_id } });
  if (!violationType || !violationType.is_active) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student violation type not found or inactive.' });
  }

  // custom_violation required when type name is 'Others' or is_system + no standard name
  if (violationType.name.toLowerCase() === 'others' && !custom_violation) {
    return res.status(422).json({ error: true, code: 'VALIDATION_ERROR', message: 'custom_violation is required for the "Others" student violation type.' });
  }

  // Determine final fine amount
  let resolvedFine;
  if (is_warning_only) {
    resolvedFine = 0;
  } else if (fine_amount !== undefined) {
    resolvedFine = fine_amount;
  } else {
    resolvedFine = Number(violationType.default_fine);
  }

  const violation = await prisma.violation.create({
    data: {
      student_id,
      faculty_id:        req.user.id,
      duty_slot_id:      resolvedDutySlotId,
      violation_type_id,
      custom_violation:  custom_violation ?? null,
      fine_amount:       resolvedFine,
      is_warning_only:   is_warning_only ?? false,
      remarks:           remarks ?? null,
    },
    include: VIOLATION_INCLUDE,
  });

  await auditViolation({
    violationId: violation.id,
    changedBy:   req.user.id,
    changeType:  'created',
    newData:     snapshotViolation(violation),
  });

  res.status(201).json(violation);
}

// ─── GET /violations — Admin & Faculty ────────────────────────────────────────
// Faculty can only see their own violations; Admin can see all or filter by faculty

async function listViolations(req, res) {
  const { student_id, faculty_id, recorded_by, date, violation_type_id, record_status, is_flagged, page = '1', limit = '20' } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const where = { deleted_at: null };
  if (student_id)       where.student_id       = student_id;
  if (violation_type_id) where.violation_type_id = violation_type_id;
  if (record_status)    where.record_status     = record_status;
  if (is_flagged !== undefined) where.is_flagged = is_flagged === 'true';
  if (date) {
    const d = new Date(date);
    where.dutySlot = { duty_date: { gte: d, lte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) } };
  }

  // Authorization + recorder filter. Faculty only ever see their own records.
  // Admins may filter by a specific recorder (faculty_id) or by the "Admin"
  // bucket (recorded_by=admin) = every violation recorded directly by an admin.
  if (req.user.role === 'faculty') {
    where.faculty_id = req.user.id;
  } else if (recorded_by === 'admin') {
    where.faculty = { role: { in: ['admin', 'super_admin'] } };
  } else if (faculty_id) {
    where.faculty_id = faculty_id;
  }

  const [total, violations] = await Promise.all([
    prisma.violation.count({ where }),
    prisma.violation.findMany({
      where,
      include: VIOLATION_INCLUDE,
      orderBy: { created_at: 'desc' },
      skip:  (pageNum - 1) * pageSize,
      take:  pageSize,
    }),
  ]);

  res.json({ data: violations, meta: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) } });
}

// ─── GET /violations/my — Faculty ─────────────────────────────────────────────

async function myViolations(req, res) {
  const { record_status, is_flagged, duty_slot_id, page = '1', limit = '20' } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const where = { faculty_id: req.user.id, deleted_at: null };
  if (record_status)    where.record_status = record_status;
  if (is_flagged !== undefined) where.is_flagged = is_flagged === 'true';
  if (duty_slot_id)     where.duty_slot_id = duty_slot_id;

  const [total, violations] = await Promise.all([
    prisma.violation.count({ where }),
    prisma.violation.findMany({
      where,
      include: VIOLATION_INCLUDE,
      orderBy: { created_at: 'desc' },
      skip:  (pageNum - 1) * pageSize,
      take:  pageSize,
    }),
  ]);

  res.json({ data: violations, meta: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) } });
}

// ─── GET /violations/my/pdf — Faculty ─────────────────────────────────────────
// Duty-date-scoped PDF export of the requesting faculty's own violations.
// Mirrors the admin Student Violation Report PDF (reports.controller.js) but
// scoped to one duty_slot_id and dropping the redundant "Faculty" column
// (excludes fine_amount, same as every other student violation export).

const MY_VIOLATION_PDF_COLUMNS = [
  { header: 'S.No',                   key: 'sno',        width: 26 },
  { header: 'Registration Number',    key: 'reg_no',     width: 95 },
  { header: 'Student Name',           key: 'name',       width: 100 },
  { header: 'Course',                 key: 'course',     width: 55 },
  { header: 'Student Violation Type', key: 'type',       width: 100 },
  { header: 'Status',                 key: 'status',     width: 55 },
  { header: 'Duty Date',              key: 'duty_date',  width: 65 },
  { header: 'Recorded At',            key: 'created_at', width: 70 },
];

function mapMyViolationPdfRow(v, i) {
  return {
    sno:        i + 1,
    reg_no:     v.student?.registration_number,
    name:       v.student?.student_name,
    course:     v.student?.course,
    type:       v.violationType?.name,
    status:     v.is_warning_only ? 'Warning only' : (v.is_flagged ? 'Flagged' : 'Recorded'),
    duty_date:  v.dutySlot?.duty_date ? new Date(v.dutySlot.duty_date).toLocaleDateString('en-IN') : '',
    created_at: new Date(v.created_at).toLocaleString('en-IN'),
  };
}

async function myViolationsPdfExport(req, res) {
  const { duty_slot_id } = req.query;
  if (!duty_slot_id) {
    return res.status(422).json({ error: true, code: 'VALIDATION_ERROR', message: 'duty_slot_id is required.' });
  }

  const slot = await prisma.dutySlot.findUnique({
    where: { id: duty_slot_id },
    include: { faculty: { select: { name: true, title: true } } },
  });
  if (!slot || slot.faculty_id !== req.user.id) {
    return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'You can only download your own duty violation reports.' });
  }

  const violations = await prisma.violation.findMany({
    where: { faculty_id: req.user.id, deleted_at: null, duty_slot_id },
    include: VIOLATION_INCLUDE,
    orderBy: { created_at: 'desc' },
  });

  const dutyDateStr  = new Date(slot.duty_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const sessionLabel = slot.session_type === 'morning' ? 'Morning' : 'Afternoon';
  const facultyName  = `${slot.faculty.title ? slot.faculty.title + ' ' : ''}${slot.faculty.name}`;

  const buffer = await buildReportPdf({
    title:    'Student Violation Report',
    subtitle: `Faculty: ${facultyName}\nDuty Date: ${dutyDateStr}\nSession: ${sessionLabel}`,
    columns:  MY_VIOLATION_PDF_COLUMNS,
    rows:     violations.map(mapMyViolationPdfRow),
  });
  sendPdf(res, buffer, `student-violations-${slot.duty_date.toISOString().split('T')[0]}-${sessionLabel.toLowerCase()}.pdf`);
}

// ─── GET /violations/:id — All Auth ───────────────────────────────────────────

async function getViolation(req, res) {
  const violation = await prisma.violation.findUnique({
    where: { id: req.params.id },
    include: VIOLATION_INCLUDE,
  });

  if (!violation || violation.deleted_at) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student violation not found.' });
  }

  // Faculty can only view their own
  if (req.user.role === 'faculty' && violation.faculty_id !== req.user.id) {
    return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'Access denied.' });
  }

  res.json(violation);
}

// ─── PATCH /violations/:id — Faculty edit ─────────────────────────────────────

async function editViolation(req, res) {
  const violation = await prisma.violation.findUnique({ where: { id: req.params.id } });

  if (!violation || violation.deleted_at) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student violation not found.' });
  }
  if (violation.faculty_id !== req.user.id) {
    return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'You can only edit your own student violations.' });
  }
  if (violation.is_flagged) {
    return res.status(409).json({ error: true, code: 'ALREADY_FLAGGED', message: 'You cannot edit a student violation after it has been flagged for review.' });
  }

  const oldSnapshot = snapshotViolation(violation);
  const { custom_violation, fine_amount, is_warning_only, remarks } = req.body;

  const data = {};
  if (custom_violation !== undefined) data.custom_violation = custom_violation;
  if (fine_amount       !== undefined) data.fine_amount      = fine_amount;
  if (is_warning_only   !== undefined) {
    data.is_warning_only = is_warning_only;
    if (is_warning_only) data.fine_amount = 0;
  }
  if (remarks !== undefined) data.remarks = remarks;

  const updated = await prisma.violation.update({
    where: { id: req.params.id },
    data,
    include: VIOLATION_INCLUDE,
  });

  await auditViolation({
    violationId: violation.id,
    changedBy:   req.user.id,
    changeType:  'edited',
    oldData:     oldSnapshot,
    newData:     snapshotViolation(updated),
  });

  res.json(updated);
}

// ─── PATCH /violations/:id/flag — Faculty ─────────────────────────────────────

async function flagViolation(req, res) {
  const violation = await prisma.violation.findUnique({ where: { id: req.params.id } });

  if (!violation || violation.deleted_at) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student violation not found.' });
  }
  if (violation.faculty_id !== req.user.id) {
    return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'You can only flag your own student violations.' });
  }
  if (violation.is_flagged) {
    return res.status(409).json({ error: true, code: 'ALREADY_FLAGGED', message: 'This student violation is already flagged for review.' });
  }

  const updated = await prisma.violation.update({
    where: { id: req.params.id },
    data:  { is_flagged: true, flag_note: req.body.flag_note },
    include: VIOLATION_INCLUDE,
  });

  await auditViolation({
    violationId: violation.id,
    changedBy:   req.user.id,
    changeType:  'flagged',
    newData:     { flag_note: req.body.flag_note },
  });

  res.json(updated);
}

// ─── PATCH /violations/:id/resolve-flag — Admin ───────────────────────────────

async function resolveFlag(req, res) {
  const violation = await prisma.violation.findUnique({ where: { id: req.params.id } });

  if (!violation || violation.deleted_at) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student violation not found.' });
  }
  if (!violation.is_flagged) {
    return res.status(409).json({ error: true, code: 'NOT_FLAGGED', message: 'This student violation is not flagged for review.' });
  }
  if (violation.flag_resolved_at) {
    return res.status(409).json({ error: true, code: 'ALREADY_RESOLVED', message: 'This flag has already been resolved.' });
  }

  const updated = await prisma.violation.update({
    where: { id: req.params.id },
    data: {
      is_flagged:        false,
      flag_resolved_by:  req.user.id,
      flag_resolved_at:  new Date(),
    },
    include: VIOLATION_INCLUDE,
  });

  await auditViolation({
    violationId: violation.id,
    changedBy:   req.user.id,
    changeType:  'flag_resolved',
    oldData:     { flag_note: violation.flag_note },
    newData:     { resolved_by: req.user.id },
    reason:      req.body.reason,
  });

  res.json(updated);
}

// ─── DELETE /violations/:id — Admin (any) / Faculty (own only) ────────────────
// Soft delete: sets deleted_at, excluding the record from every read path
// (lists, counts, dashboards, reports, analytics) while keeping the row —
// only Super Admin can hard-delete, per the constitution. Tracked in
// admin_audit_log only; the per-violation audit log has no UI surface left
// after the Hide/Log removal.

async function deleteViolation(req, res) {
  const violation = await prisma.violation.findUnique({
    where: { id: req.params.id },
    include: {
      student:       { select: { student_name: true } },
      violationType: { select: { name: true } },
    },
  });

  if (!violation || violation.deleted_at) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student violation not found.' });
  }
  if (req.user.role === 'faculty' && violation.faculty_id !== req.user.id) {
    return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'You can only delete your own student violations.' });
  }

  await prisma.violation.update({
    where: { id: req.params.id },
    data:  { deleted_at: new Date() },
  });

  await logAction({
    actorId:    req.user.id,
    action:     'DELETE_VIOLATION',
    targetId:   violation.id,
    targetType: 'violation',
    metadata: {
      student_name:   violation.student?.student_name,
      violation_type: violation.violationType?.name,
      reason:         req.body?.reason,
    },
  });

  res.json({ success: true });
}

// ─── GET /violations/:id/photo — Foundation placeholder ───────────────────────

async function getPhoto(req, res) {
  res.status(501).json({ error: true, code: 'NOT_IMPLEMENTED', message: 'Photo access is not available in Phase 1.' });
}

module.exports = {
  createViolation,
  listViolations,
  myViolations,
  myViolationsPdfExport,
  getViolation,
  editViolation,
  deleteViolation,
  flagViolation,
  resolveFlag,
  getPhoto,
};
