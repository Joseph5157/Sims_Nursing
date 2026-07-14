const ExcelJS = require('exceljs');
const prisma = require('../lib/prisma');
const { logAction } = require('../services/audit.service');
const logger = require('../lib/logger');

const VALID_COURSES = ['b_pharm', 'pharm_d', 'm_pharm'];

// Expected Excel column headers (case-insensitive, trimmed)
const COLUMN_MAP = {
  'registration number': 'registration_number',
  'registration_number': 'registration_number',
  'student name':        'student_name',
  'student_name':        'student_name',
  'name':                'student_name',
  'course':              'course',
  'year':                'year',
  'semester':            'semester',
  'batch year':          'batch_year',
  'batch_year':          'batch_year',
  'gender':              'gender',
  'phone':               'phone',
  'academic year':       'academic_year',
  'academic_year':       'academic_year',
};

const REQUIRED_FIELDS = ['registration_number', 'student_name', 'course', 'year', 'semester', 'academic_year', 'batch_year'];

// Parses the uploaded workbook into validated rows and a list of row errors.
function parseWorkbook(workbook) {
  const sheet = workbook.worksheets[0];
  if (!sheet) return { sheet: null };

  const headerRow = sheet.getRow(1);
  const colIndexMap = {};
  headerRow.eachCell((cell, colNumber) => {
    const key = String(cell.value ?? '').trim().toLowerCase();
    if (COLUMN_MAP[key]) colIndexMap[COLUMN_MAP[key]] = colNumber;
  });

  const missingHeaders = REQUIRED_FIELDS.filter((f) => !colIndexMap[f]);
  if (missingHeaders.length > 0) return { missingHeaders };

  const validRows = [];
  const errors    = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const get = (field) => {
      const col = colIndexMap[field];
      if (!col) return '';
      const val = row.getCell(col).value;
      return val !== null && val !== undefined ? String(val).trim() : '';
    };

    const reg          = get('registration_number');
    const name         = get('student_name');
    const course       = get('course').toLowerCase();
    const yearRaw      = get('year');
    const semesterRaw  = get('semester');
    const acYear       = get('academic_year');
    const batchYearRaw = get('batch_year');
    const gender       = get('gender')  || null;
    const phone        = get('phone')   || null;

    const year       = parseInt(yearRaw, 10);
    const semester   = parseInt(semesterRaw, 10);
    const batch_year = parseInt(batchYearRaw, 10);

    const rowErrors = [];
    if (!reg)                                rowErrors.push('registration_number is empty');
    if (!name)                               rowErrors.push('student_name is empty');
    if (!VALID_COURSES.includes(course))     rowErrors.push(`course must be one of: ${VALID_COURSES.join(', ')}`);
    if (!yearRaw || isNaN(year) || year < 1 || year > 6)
                                             rowErrors.push('year must be a number 1–6');
    if (!semesterRaw || isNaN(semester) || semester < 1 || semester > 12)
                                             rowErrors.push('semester must be a number 1–12');
    if (!acYear)                             rowErrors.push('academic_year is empty');
    if (!batchYearRaw || isNaN(batch_year) || batch_year < 2000 || batch_year > 2100)
                                             rowErrors.push('batch_year must be a valid year e.g. 2023');

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, registration_number: reg || null, reasons: rowErrors });
      return;
    }

    validRows.push({
      registration_number: reg,
      student_name:        name,
      course,
      year,
      semester,
      semester_or_year:    `Year ${year} Sem ${semester}`,
      batch_year,
      gender,
      phone,
      academic_year:       acYear,
    });
  });

  // Deduplicate within the file — keep last occurrence
  const rowMap = new Map();
  for (const r of validRows) rowMap.set(r.registration_number, r);
  const uniqueRows = Array.from(rowMap.values());

  // Build scoped deactivation conditions from every course+year+academic_year combination
  const scopeKeys = new Map();
  for (const r of uniqueRows) {
    const key = `${r.course}|${r.year}|${r.academic_year}`;
    if (!scopeKeys.has(key)) {
      scopeKeys.set(key, { course: r.course, year: r.year, academic_year: r.academic_year });
    }
  }
  const scopeConditions = Array.from(scopeKeys.values());

  return { uniqueRows, errors, scopeConditions };
}

// ─── POST /students/upload ─────────────────────────────────────────────────────

async function uploadStudents(req, res) {
  const dryRun            = req.query.dry_run            === 'true';
  const deactivateMissing = req.query.deactivate_missing === 'true';

  if (!req.file) {
    return res.status(400).json({ error: true, code: 'BAD_REQUEST', message: 'Excel file is required.' });
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(req.file.buffer);
  } catch {
    return res.status(422).json({ error: true, code: 'INVALID_FILE', message: 'Could not parse the uploaded file. Ensure it is a valid .xlsx file.' });
  }

  const parsed = parseWorkbook(workbook);

  if (parsed.sheet === null) {
    return res.status(422).json({ error: true, code: 'EMPTY_FILE', message: 'The uploaded file has no worksheets.' });
  }
  if (parsed.missingHeaders) {
    return res.status(422).json({
      error: true, code: 'MISSING_COLUMNS',
      message: `Missing required columns: ${parsed.missingHeaders.join(', ')}`,
    });
  }

  const { uniqueRows, errors, scopeConditions } = parsed;
  const uploadedRegNums = uniqueRows.map((r) => r.registration_number);

  if (uniqueRows.length === 0 && deactivateMissing) {
    return res.status(422).json({
      error: true, code: 'NO_VALID_ROWS',
      message: 'No valid rows were found in the file. Deactivation is blocked to prevent accidental mass-deactivation.',
      valid_rows: 0, invalid_rows: errors.length, errors,
    });
  }

  const deactivateWhere =
    deactivateMissing && scopeConditions.length > 0
      ? {
          status: 'active', deleted_at: null,
          registration_number: { notIn: uploadedRegNums },
          OR: scopeConditions,
        }
      : null;

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (dryRun) {
    try {
      const existingInFile = await prisma.student.findMany({
        where:  { registration_number: { in: uploadedRegNums } },
        select: { registration_number: true },
      });
      const existingSet     = new Set(existingInFile.map((s) => s.registration_number));
      const wouldAdd        = uniqueRows.filter((r) => !existingSet.has(r.registration_number)).length;
      const wouldUpdate     = uniqueRows.filter((r) =>  existingSet.has(r.registration_number)).length;
      const wouldDeactivate = deactivateWhere ? await prisma.student.count({ where: deactivateWhere }) : 0;

      return res.json({
        dry_run: true, valid_rows: uniqueRows.length, invalid_rows: errors.length,
        would_add: wouldAdd, would_update: wouldUpdate, would_deactivate: wouldDeactivate,
        deactivate_missing: deactivateMissing, scope: scopeConditions, errors,
      });
    } catch (err) {
      logger.error(`uploadStudents dry_run error: ${err.message}`);
      return res.status(500).json({ error: true, code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' });
    }
  }

  // ── Actual import ──────────────────────────────────────────────────────────
  let added_count = 0, updated_count = 0, deactivated_count = 0, log;

  try {
    await prisma.$transaction(async (tx) => {
      // Same "fetch existing registration numbers into a Set" pattern as the
      // dry-run above — one query instead of one findUnique per row.
      const existingInFile = await tx.student.findMany({
        where:  { registration_number: { in: uploadedRegNums } },
        select: { registration_number: true },
      });
      const existingSet = new Set(existingInFile.map((s) => s.registration_number));

      const toCreate = uniqueRows.filter((r) => !existingSet.has(r.registration_number));
      const toUpdate = uniqueRows.filter((r) =>  existingSet.has(r.registration_number));

      if (toCreate.length > 0) {
        await tx.student.createMany({
          data: toCreate.map((row) => ({ ...row, status: 'active' })),
        });
        added_count = toCreate.length;
      }

      // createMany can't set per-row data, so updates (each row differs) still
      // need one call per row — but only for rows that actually exist, with no
      // findUnique first.
      for (const row of toUpdate) {
        await tx.student.update({
          where: { registration_number: row.registration_number },
          data:  { ...row, status: 'active', deleted_at: null },
        });
      }
      updated_count = toUpdate.length;

      if (deactivateWhere) {
        const result = await tx.student.updateMany({ where: deactivateWhere, data: { status: 'inactive' } });
        deactivated_count = result.count;
      }

      log = await tx.studentUploadLog.create({
        data: {
          uploaded_by: req.user.id, filename: req.file.originalname,
          added_count, updated_count, deactivated_count, errors,
        },
      });
    });
  } catch (err) {
    logger.error(`uploadStudents transaction error: ${err.message}`);
    return res.status(500).json({ error: true, code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' });
  }

  logAction({
    actorId: req.user.id, action: 'STUDENT_UPLOAD', targetId: log.id, targetType: 'student_upload_log',
    metadata: {
      filename: req.file.originalname, added_count, updated_count,
      deactivated_count, error_count: errors.length, deactivate_missing: deactivateMissing,
    },
  }).catch((err) => logger.error('Failed to log STUDENT_UPLOAD action', err));

  res.status(200).json({
    log_id: log.id, filename: req.file.originalname,
    valid_rows: uniqueRows.length, invalid_rows: errors.length,
    added_count, updated_count, deactivated_count,
    error_count: errors.length, deactivate_missing: deactivateMissing,
    scope: scopeConditions, errors,
  });
}

// ─── GET /students/upload-logs ─────────────────────────────────────────────────

async function getUploadLogs(req, res) {
  const { page = '1', limit = '20' } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [total, logs] = await Promise.all([
    prisma.studentUploadLog.count(),
    prisma.studentUploadLog.findMany({
      orderBy: { uploaded_at: 'desc' },
      skip:    (pageNum - 1) * pageSize,
      take:    pageSize,
      include: { uploader: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  res.json({ data: logs, meta: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) } });
}

// ─── GET /students ─────────────────────────────────────────────────────────────

async function listStudents(req, res) {
  const { course, year, status, search, page = '1', limit = '20' } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const where = { deleted_at: null };
  if (course)  where.course  = course;
  if (year)    where.year    = parseInt(year, 10);
  if (status)  where.status  = status;
  if (search) {
    where.OR = [
      { student_name:        { contains: search, mode: 'insensitive' } },
      { registration_number: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: [{ year: 'asc' }, { semester: 'asc' }, { student_name: 'asc' }],
      skip:    (pageNum - 1) * pageSize,
      take:    pageSize,
    }),
  ]);

  res.json({ data: students, meta: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) } });
}

// ─── GET /students/:id ──────────────────────────────────────────────────────────

async function getStudent(req, res) {
  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!student || student.deleted_at) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student not found.' });
  }
  res.json(student);
}

// ─── GET /students/search ──────────────────────────────────────────────────────

async function searchStudents(req, res) {
  const { q } = req.query;
  if (!q || String(q).trim().length < 2) {
    return res.status(400).json({ error: true, code: 'BAD_REQUEST', message: 'Query must be at least 2 characters.' });
  }

  const students = await prisma.student.findMany({
    where: {
      deleted_at: null, status: 'active',
      OR: [
        { student_name:        { contains: q, mode: 'insensitive' } },
        { registration_number: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true, registration_number: true, student_name: true,
      course: true, year: true, semester: true,
      batch_year: true, academic_year: true, gender: true,
    },
    orderBy: { student_name: 'asc' },
    take: 20,
  });

  res.json({ data: students });
}

// ─── PATCH /students/:id/promote ──────────────────────────────────────────────

async function promoteStudent(req, res) {
  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!student || student.deleted_at) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student not found.' });
  }

  const data = {
    year:             req.body.year,
    semester:         req.body.semester,
    semester_or_year: `Year ${req.body.year} Sem ${req.body.semester}`,
  };
  if (req.body.academic_year) data.academic_year = req.body.academic_year;

  const updated = await prisma.student.update({ where: { id: req.params.id }, data });

  await logAction({
    actorId: req.user.id, action: 'PROMOTE_STUDENT', targetId: student.id, targetType: 'student',
    metadata: {
      from: { year: student.year, semester: student.semester, academic_year: student.academic_year },
      to:   { year: data.year,    semester: data.semester,    academic_year: data.academic_year ?? student.academic_year },
    },
  });

  res.json(updated);
}

// ─── DELETE /students/:id ─────────────────────────────────────────────────────
// Permanent (hard) delete. Students with recorded disciplinary violations are
// blocked — their violation history (and its audit/photo-access logs) must be
// preserved, so the admin is told to keep the record instead of destroying it.

async function deleteStudent(req, res) {
  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!student) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student not found.' });
  }

  const violationCount = await prisma.violation.count({ where: { student_id: student.id, deleted_at: null } });
  if (violationCount > 0) {
    return res.status(409).json({
      error: true, code: 'HAS_VIOLATIONS',
      message: `Cannot delete ${student.student_name}: they have ${violationCount} disciplinary record${violationCount === 1 ? '' : 's'} that must be preserved.`,
    });
  }

  await prisma.student.delete({ where: { id: student.id } });

  await logAction({
    actorId: req.user.id, action: 'DELETE_STUDENT', targetId: student.id, targetType: 'student',
    metadata: { registration_number: student.registration_number, student_name: student.student_name },
  });

  res.json({ deleted: true });
}

// ─── PATCH /students/bulk/promote ─────────────────────────────────────────────

async function bulkPromoteStudents(req, res) {
  const { ids, year, semester, academic_year } = req.body;

  const data = {
    year,
    semester,
    semester_or_year: `Year ${year} Sem ${semester}`,
    ...(academic_year && { academic_year }),
  };

  const skipped = [];
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const id of ids) {
      const student = await tx.student.findUnique({ where: { id } });
      if (!student || student.deleted_at) {
        skipped.push({ id, reason: 'not found' });
        continue;
      }
      await tx.student.update({ where: { id }, data });
      updated++;
    }
  });

  await logAction({
    actorId: req.user.id, action: 'BULK_PROMOTE_STUDENTS', targetType: 'student',
    metadata: { count: updated, student_ids: ids, to: { year, semester, academic_year } },
  });

  res.json({ updated, skipped });
}

// ─── DELETE /students/bulk ────────────────────────────────────────────────────
// Permanent (hard) bulk delete. Any selected student that has disciplinary
// violations is skipped (their history is preserved); the rest are deleted.

async function bulkDeleteStudents(req, res) {
  const { ids } = req.body;

  const skipped = [];
  let deleted = 0;
  const deletedIds = [];

  await prisma.$transaction(async (tx) => {
    for (const id of ids) {
      const student = await tx.student.findUnique({ where: { id } });
      if (!student) {
        skipped.push({ id, reason: 'not found' });
        continue;
      }
      const violationCount = await tx.violation.count({ where: { student_id: id } });
      if (violationCount > 0) {
        skipped.push({ id, reason: 'has disciplinary records' });
        continue;
      }
      await tx.student.delete({ where: { id } });
      deleted++;
      deletedIds.push(id);
    }
  });

  await logAction({
    actorId: req.user.id, action: 'BULK_DELETE_STUDENTS', targetType: 'student',
    metadata: { count: deleted, student_ids: deletedIds },
  });

  res.json({ deleted, skipped });
}

// ─── GET /students/upload-template ────────────────────────────────────────────

async function downloadTemplate(req, res) {
  const workbook = new ExcelJS.Workbook();
  const sheet    = workbook.addWorksheet('Students');

  // Header row
  sheet.columns = [
    { header: 'Registration Number', key: 'registration_number', width: 22 },
    { header: 'Student Name',        key: 'student_name',        width: 24 },
    { header: 'Course',              key: 'course',              width: 12 },
    { header: 'Year',                key: 'year',                width: 8  },
    { header: 'Semester',            key: 'semester',            width: 10 },
    { header: 'Batch Year',          key: 'batch_year',          width: 12 },
    { header: 'Academic Year',       key: 'academic_year',       width: 14 },
  ];

  // Style header row
  sheet.getRow(1).eachCell((cell) => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border    = {
      bottom: { style: 'thin', color: { argb: 'FF1D4ED8' } },
    };
  });
  sheet.getRow(1).height = 22;

  // Sample rows
  sheet.addRow({ registration_number: 'BP2023001', student_name: 'Anjali Sharma',   course: 'b_pharm', year: 1, semester: 1, batch_year: 2023, academic_year: '2025-26' });
  sheet.addRow({ registration_number: 'PD2022001', student_name: 'Rahul Verma',     course: 'pharm_d', year: 2, semester: 3, batch_year: 2022, academic_year: '2025-26' });
  sheet.addRow({ registration_number: 'MP2024001', student_name: 'Priya Nair',      course: 'm_pharm', year: 1, semester: 2, batch_year: 2024, academic_year: '2025-26' });

  // Light stripe on sample rows
  [2, 3, 4].forEach((n) => {
    sheet.getRow(n).eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: n % 2 === 0 ? 'FFDBEAFE' : 'FFEFF6FF' } };
    });
  });

  // Notes row
  const notesRow = sheet.addRow(['↑ Replace sample rows above. Keep headers exactly as shown.']);
  notesRow.getCell(1).font      = { italic: true, color: { argb: 'FF64748B' }, size: 9 };
  notesRow.getCell(1).alignment = { horizontal: 'left' };
  sheet.mergeCells(`A${notesRow.number}:G${notesRow.number}`);

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="students-upload-template.xlsx"');
  res.send(buffer);
}

module.exports = {
  uploadStudents, getUploadLogs, listStudents, getStudent, searchStudents,
  promoteStudent, deleteStudent, bulkPromoteStudents, bulkDeleteStudents,
  downloadTemplate,
};
