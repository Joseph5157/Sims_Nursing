const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const telegram = require('../lib/telegram');
const { logAction } = require('../services/audit.service');
const { formatDateIST } = require('../lib/time');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseYearMonth(req, res) {
  const year = parseInt(req.params.year, 10);
  const month = parseInt(req.params.month, 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    res.status(400).json({ error: true, code: 'BAD_REQUEST', message: 'Invalid year.' });
    return null;
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    res.status(400).json({ error: true, code: 'BAD_REQUEST', message: 'Month must be between 1 and 12.' });
    return null;
  }
  return { year, month };
}

function monthDateRange(year, month) {
  return {
    gte: new Date(year, month - 1, 1),
    lte: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

// Latest reassignment carried on each slot so the UI can label an active slot
// as "reassigned to you" / "originally assigned to …". History rows never change
// once written, so the most recent one describes the current owner.
const LATEST_REASSIGNMENT_SELECT = {
  orderBy: { created_at: 'desc' },
  take: 1,
  select: {
    id: true,
    from_faculty_id: true,
    to_faculty_id: true,
    reason: true,
    created_at: true,
    fromFaculty: { select: { id: true, name: true } },
    toFaculty: { select: { id: true, name: true } },
    reassignedBy: { select: { id: true, name: true } },
  },
};

const SLOT_SELECT = {
  id: true,
  faculty_id: true,
  duty_date: true,
  session_type: true,
  status: true,
  created_by: true,
  created_at: true,
  updated_at: true,
  faculty: { select: { id: true, name: true, email: true, department: true, designation: true } },
  attendance: { select: { in_time: true, out_time: true } },
  reassignments: LATEST_REASSIGNMENT_SELECT,
};

// ─── GET /duty-slots/:year/:month ─────────────────────────────────────────────

async function getMonthSlots(req, res) {
  const params = parseYearMonth(req, res);
  if (!params) return;
  const { year, month } = params;

  const where = { duty_date: monthDateRange(year, month) };

  if (req.user.role === 'faculty') {
    where.faculty_id = req.user.id;
  }

  const slots = await prisma.dutySlot.findMany({
    where,
    select: SLOT_SELECT,
    orderBy: [{ duty_date: 'asc' }, { session_type: 'asc' }],
  });

  res.json({ data: slots, total: slots.length });
}

// ─── GET /duty-slots/all/:year/:month — All Auth ──────────────────────────────
// Every booked duty slot for the month, across ALL faculty (read-only). Powers
// the faculty "All Faculty Duties" page so members can see who is on duty when
// and plan reassignments. Unlike getMonthSlots this never scopes to the caller.

async function getAllFacultyDuties(req, res) {
  const params = parseYearMonth(req, res);
  if (!params) return;
  const { year, month } = params;

  const slots = await prisma.dutySlot.findMany({
    where: { duty_date: monthDateRange(year, month) },
    select: SLOT_SELECT,
    orderBy: [{ duty_date: 'asc' }, { session_type: 'asc' }],
  });

  res.json({ data: slots, total: slots.length });
}

// ─── GET /duty-slots/mine/dates — Faculty ─────────────────────────────────────
// Past/completed duty slots assigned to the requesting faculty member, for
// populating a duty-date filter (e.g. faculty Student Violations page).
// Future-dated slots are excluded — they can't have violations recorded yet.

async function getMyDutyDates(req, res) {
  const today = new Date();
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  const slots = await prisma.dutySlot.findMany({
    where: { faculty_id: req.user.id, duty_date: { lte: endOfToday } },
    select: { id: true, duty_date: true, session_type: true },
    orderBy: [{ duty_date: 'desc' }, { session_type: 'asc' }],
  });

  res.json({ data: slots });
}

// ─── GET /duty-slots/available/:year/:month ───────────────────────────────────

async function getAvailableSlots(req, res) {
  const params = parseYearMonth(req, res);
  if (!params) return;
  const { year, month } = params;

  const config = await prisma.calendarConfig.findUnique({
    where: { config_month_config_year: { config_month: month, config_year: year } },
  });

  if (!config || !config.is_window_open) {
    return res.status(409).json({
      error: true,
      code: 'WINDOW_CLOSED',
      message: 'The scheduling window is not open for this month.',
    });
  }

  const workingDays = Array.isArray(config.working_days) ? config.working_days : [];

  if (workingDays.length === 0) {
    return res.json({
      data: [],
      total: 0,
      sessions_per_faculty: config.sessions_per_faculty,
      slots_picked: 0,
      slots_remaining: config.sessions_per_faculty,
    });
  }

  const takenSlots = await prisma.dutySlot.findMany({
    where: { duty_date: { in: workingDays.map((d) => new Date(d)) } },
    select: { duty_date: true, session_type: true },
  });

  const takenSet = new Set(
    takenSlots.map((s) => `${s.duty_date.toISOString().slice(0, 10)}|${s.session_type}`),
  );

  const available = [];
  for (const dateStr of workingDays) {
    for (const session of ['morning', 'afternoon']) {
      if (!takenSet.has(`${dateStr}|${session}`)) {
        available.push({ duty_date: dateStr, session_type: session });
      }
    }
  }

  const pickedCount = await prisma.dutySlot.count({
    where: { faculty_id: req.user.id, duty_date: monthDateRange(year, month) },
  });

  res.json({
    data: available,
    total: available.length,
    sessions_per_faculty: config.sessions_per_faculty,
    slots_picked: pickedCount,
    slots_remaining: Math.max(0, config.sessions_per_faculty - pickedCount),
  });
}

// ─── POST /duty-slots/pick ────────────────────────────────────────────────────
// Session limit check and slot creation run inside a single transaction so
// concurrent picks from the same faculty cannot exceed the monthly limit, and
// the DB unique constraint on (duty_date, session_type) is the final guard
// against two faculty racing for the same slot.

async function pickSlot(req, res) {
  const { duty_date, session_type } = req.body;

  const date = new Date(duty_date);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  // Read-only checks outside the transaction
  const config = await prisma.calendarConfig.findUnique({
    where: { config_month_config_year: { config_month: month, config_year: year } },
  });

  if (!config || !config.is_window_open) {
    return res.status(409).json({
      error: true,
      code: 'WINDOW_CLOSED',
      message: 'The scheduling window is not currently open.',
    });
  }

  const workingDays = Array.isArray(config.working_days) ? config.working_days : [];
  if (!workingDays.includes(duty_date)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_DATE',
      message: 'That date is not a scheduled working day.',
    });
  }

  try {
    const slot = await prisma.$transaction(async (tx) => {
      // Count inside the transaction so a concurrent pick from the same account
      // cannot bypass the session limit between our check and our insert.
      const pickedCount = await tx.dutySlot.count({
        where: { faculty_id: req.user.id, duty_date: monthDateRange(year, month) },
      });

      if (pickedCount >= config.sessions_per_faculty) {
        const err = new Error('Session limit reached.');
        err.code = 'LIMIT_REACHED';
        throw err;
      }

      // The DB unique constraint on (duty_date, session_type) raises P2002 if
      // another faculty member created this slot concurrently.
      return tx.dutySlot.create({
        data: {
          faculty_id: req.user.id,
          duty_date: date,
          session_type,
          created_by: req.user.id,
        },
        select: SLOT_SELECT,
      });
    });

    return res.status(201).json(slot);
  } catch (err) {
    if (err.code === 'LIMIT_REACHED') {
      return res.status(409).json({
        error: true,
        code: 'LIMIT_REACHED',
        message: `You have already picked ${config.sessions_per_faculty} slot(s) for this month.`,
      });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: true,
        code: 'SLOT_TAKEN',
        message: 'This slot is already taken.',
      });
    }
    logger.error(`pickSlot error: ${err.message}`);
    return res.status(500).json({ error: true, code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' });
  }
}

// ─── POST /duty-slots/admin-assign ───────────────────────────────────────────
// Uses the DB unique constraint on (duty_date, session_type) as the definitive
// guard and wraps the existence check + insert in a transaction.

async function adminAssign(req, res) {
  const { faculty_id, duty_date, session_type } = req.body;

  const faculty = await prisma.user.findUnique({ where: { id: faculty_id } });
  if (!faculty || faculty.deleted_at || faculty.role !== 'faculty') {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Faculty member not found.' });
  }

  const date = new Date(duty_date);

  try {
    const slot = await prisma.$transaction(async (tx) => {
      const existing = await tx.dutySlot.findUnique({
        where: { duty_date_session_type: { duty_date: date, session_type } },
      });
      if (existing) {
        const err = new Error('Slot already taken.');
        err.code = 'SLOT_TAKEN';
        throw err;
      }
      return tx.dutySlot.create({
        data: { faculty_id, duty_date: date, session_type, created_by: req.user.id },
        select: SLOT_SELECT,
      });
    });

    logAction({
      actorId: req.user.id,
      action: 'ADMIN_ASSIGN_SLOT',
      targetId: slot.id,
      targetType: 'duty_slot',
      metadata: { faculty_id, duty_date, session_type },
    }).catch((err) => logger.error('Failed to log ADMIN_ASSIGN_SLOT:', err));

    return res.status(201).json(slot);
  } catch (err) {
    if (err.code === 'SLOT_TAKEN' || err.code === 'P2002') {
      return res.status(409).json({
        error: true,
        code: 'SLOT_TAKEN',
        message: 'This slot is already taken.',
      });
    }
    logger.error(`adminAssign error: ${err.message}`);
    return res.status(500).json({ error: true, code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' });
  }
}

// ─── GET /duty-slots/:id ──────────────────────────────────────────────────────

async function getSlot(req, res) {
  const slot = await prisma.dutySlot.findUnique({
    where: { id: req.params.id },
    select: {
      ...SLOT_SELECT,
      attendance: true,
      reassignments: {
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          from_faculty_id: true,
          to_faculty_id: true,
          reason: true,
          created_at: true,
          fromFaculty: { select: { id: true, name: true } },
          toFaculty: { select: { id: true, name: true } },
          reassignedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!slot) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Duty slot not found.' });
  }

  if (req.user.role === 'faculty' && slot.faculty_id !== req.user.id) {
    return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'Access denied.' });
  }

  res.json(slot);
}

// ─── POST /duty-slots/:id/reassign — Admin ────────────────────────────────────
// Admin-controlled duty reassignment. Moves an upcoming, un-attended duty from
// its current faculty to another faculty member. The slot's faculty_id is
// updated in place and a duty_reassignments history row is written; attendance,
// duty counts and My Slots then all follow the new owner automatically.

async function reassignSlot(req, res) {
  const { to_faculty_id, reason } = req.body;

  const slot = await prisma.dutySlot.findUnique({
    where: { id: req.params.id },
    include: {
      attendance: true,
      faculty: { select: { id: true, name: true, telegram_id: true } },
    },
  });

  if (!slot) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Duty slot not found.' });
  }

  // Only still-scheduled duties can be reassigned — completed/absent slots are
  // history and must not be rewritten.
  if (slot.status !== 'scheduled') {
    return res.status(409).json({
      error: true,
      code: 'SLOT_NOT_REASSIGNABLE',
      message: `This duty cannot be reassigned because its status is '${slot.status}'.`,
    });
  }

  // Never reassign a past duty.
  if (formatDateIST(slot.duty_date) < formatDateIST(new Date())) {
    return res.status(409).json({
      error: true,
      code: 'PAST_DUTY',
      message: 'This duty date has already passed and cannot be reassigned.',
    });
  }

  // Attendance already recorded means the duty is in progress/done.
  if (slot.attendance) {
    return res.status(409).json({
      error: true,
      code: 'ATTENDANCE_EXISTS',
      message: 'Attendance has already been recorded for this duty and it cannot be reassigned.',
    });
  }

  if (to_faculty_id === slot.faculty_id) {
    return res.status(409).json({
      error: true,
      code: 'SAME_FACULTY',
      message: 'The duty is already assigned to this faculty member.',
    });
  }

  const toFaculty = await prisma.user.findUnique({ where: { id: to_faculty_id } });
  if (!toFaculty || toFaculty.deleted_at || toFaculty.role !== 'faculty' || toFaculty.status !== 'active') {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Target faculty member not found or inactive.' });
  }

  const fromFacultyId = slot.faculty_id;

  const [updatedSlot, reassignment] = await prisma.$transaction([
    prisma.dutySlot.update({
      where: { id: slot.id },
      data:  { faculty_id: to_faculty_id },
      select: SLOT_SELECT,
    }),
    prisma.dutyReassignment.create({
      data: {
        duty_slot_id:    slot.id,
        from_faculty_id: fromFacultyId,
        to_faculty_id,
        duty_date:       slot.duty_date,
        session_type:    slot.session_type,
        reason:          reason ?? null,
        reassigned_by:   req.user.id,
      },
    }),
  ]);

  await logAction({
    actorId:    req.user.id,
    action:     'REASSIGN_DUTY',
    targetId:   slot.id,
    targetType: 'duty_slot',
    metadata:   { from_faculty_id: fromFacultyId, to_faculty_id, duty_date: formatDateIST(slot.duty_date), session_type: slot.session_type, reason: reason ?? null },
  });

  res.json({ slot: updatedSlot, reassignment });

  // Fire-and-forget Telegram notifications to both faculty — never block/fail the response.
  const dutyDate = formatDateIST(slot.duty_date);
  const sessionLabel = slot.session_type === 'morning' ? 'Morning' : 'Afternoon';
  const appUrl = process.env.APP_URL || 'https://sims-dms.railway.app';
  if (slot.faculty.telegram_id) {
    telegram.sendMessage(slot.faculty.telegram_id,
      `🔄 <b>Duty Reassigned Away</b>\n\nYour duty on <b>${dutyDate}</b> (${sessionLabel}) has been reassigned to <b>${toFaculty.name}</b> by the admin.` +
      (reason ? `\nReason: ${reason}` : '') +
      `\n\nView your schedule: ${appUrl}/faculty/slots`
    ).catch((err) => logger.warn(`[reassign-notify] from-faculty notify failed: ${err.message}`));
  }
  if (toFaculty.telegram_id) {
    telegram.sendMessage(toFaculty.telegram_id,
      `🔄 <b>Duty Reassigned to You</b>\n\nYou have been assigned a duty on <b>${dutyDate}</b> (${sessionLabel}) by the admin (originally assigned to ${slot.faculty.name}).\n\nView your schedule: ${appUrl}/faculty/slots`
    ).catch((err) => logger.warn(`[reassign-notify] to-faculty notify failed: ${err.message}`));
  }
}

// ─── GET /duty-slots/reassigned-away/:year/:month — Faculty ───────────────────
// Duties this faculty member had that were reassigned away from them. These no
// longer appear in their active slots (the slot's faculty_id moved), so they are
// surfaced separately from the reassignment history.

async function getReassignedAway(req, res) {
  const params = parseYearMonth(req, res);
  if (!params) return;
  const { year, month } = params;

  const rows = await prisma.dutyReassignment.findMany({
    where: {
      from_faculty_id: req.user.id,
      duty_date: monthDateRange(year, month),
    },
    orderBy: [{ duty_date: 'asc' }],
    select: {
      id: true,
      duty_date: true,
      session_type: true,
      reason: true,
      created_at: true,
      toFaculty:    { select: { id: true, name: true } },
      reassignedBy: { select: { id: true, name: true } },
    },
  });

  res.json({ data: rows, total: rows.length });
}

module.exports = {
  getMonthSlots,
  getAllFacultyDuties,
  getMyDutyDates,
  getAvailableSlots,
  pickSlot,
  adminAssign,
  getSlot,
  reassignSlot,
  getReassignedAway,
};
