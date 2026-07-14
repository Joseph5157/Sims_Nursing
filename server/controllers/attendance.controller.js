const prisma = require('../lib/prisma');
const settingsService = require('../services/settings.service');
const { logAction } = require('../services/audit.service');
const { nowInIST, istDayRangeUTC, isSlotToday, formatDateIST } = require('../lib/time');

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Calculates in_status ('normal' or 'late') by comparing current IST hour/minute
// directly against the configured threshold — no server TZ dependency.
// Accepts cfg so the caller can share one settings fetch across window + late checks.
function resolveInStatus(sessionType, cfg) {
  const thresholdHour = sessionType === 'morning'
    ? cfg.late_threshold_morning_hour
    : cfg.late_threshold_afternoon_hour;
  const thresholdMin  = sessionType === 'morning'
    ? cfg.late_threshold_morning_min
    : cfg.late_threshold_afternoon_min;
  const ist = nowInIST();
  return ist.hour * 60 + ist.minute > thresholdHour * 60 + thresholdMin ? 'late' : 'normal';
}

// Same month-range convention as duty-slots.controller.js's monthDateRange —
// duty_date is a @db.Date column (no time component), stored as UTC midnight.
function monthDateRange(year, month) {
  return {
    gte: new Date(year, month - 1, 1),
    lte: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

// Fetches the duty slot and verifies the requesting faculty is its current
// owner. After an admin reassignment the slot's faculty_id is the new faculty,
// so ownership is always a single faculty_id check.
async function resolveSlotForFaculty(slotId, facultyId, res) {
  const slot = await prisma.dutySlot.findUnique({ where: { id: slotId } });
  if (!slot) {
    res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Duty slot not found.' });
    return null;
  }
  if (slot.faculty_id !== facultyId) {
    res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'This is not your duty slot.' });
    return null;
  }
  return slot;
}

// ─── POST /attendance/:dutySlotId/check-in ────────────────────────────────────

async function checkIn(req, res) {
  const slot = await resolveSlotForFaculty(req.params.dutySlotId, req.user.id, res);
  if (!slot) return;

  if (!isSlotToday(slot.duty_date)) {
    return res.status(409).json({
      error: true,
      code: 'WRONG_DATE',
      message: 'You can only check in on your scheduled duty date.',
    });
  }

  // Session-window enforcement: reject check-in before the configured session
  // start time, or after the configured auto-checkout time. No early grace
  // period — faculty must wait until the session actually starts.
  const cfg = await settingsService.getSettings();
  const ist = nowInIST();
  const nowMins = ist.hour * 60 + ist.minute;
  const startHour = slot.session_type === 'morning'
    ? cfg.session_start_morning_hour
    : cfg.session_start_afternoon_hour;
  const startMin  = slot.session_type === 'morning'
    ? cfg.session_start_morning_min
    : cfg.session_start_afternoon_min;
  const autoCheckoutHour = slot.session_type === 'morning'
    ? cfg.auto_checkout_morning_hour
    : cfg.auto_checkout_afternoon_hour;
  const autoCheckoutMin  = slot.session_type === 'morning'
    ? cfg.auto_checkout_morning_min
    : cfg.auto_checkout_afternoon_min;
  const windowOpenMins  = startHour * 60 + startMin;
  const windowCloseMins = autoCheckoutHour * 60 + autoCheckoutMin;

  if (nowMins < windowOpenMins) {
    return res.status(409).json({
      error: true,
      code: 'BEFORE_SESSION_START',
      message: 'Check-in is allowed only after the session start time.',
    });
  }

  if (nowMins > windowCloseMins) {
    return res.status(409).json({
      error: true,
      code: 'OUTSIDE_SESSION_WINDOW',
      message: 'Check-in is not allowed outside your duty session window.',
    });
  }

  const existing = await prisma.dutyAttendance.findUnique({ where: { duty_slot_id: slot.id } });

  if (existing?.in_time) {
    return res.status(409).json({
      error: true,
      code: 'ALREADY_CHECKED_IN',
      message: 'You have already checked in for this duty slot.',
    });
  }

  const in_status = resolveInStatus(slot.session_type, cfg);

  // faculty_id is the slot's current owner (the actual performer).
  let attendance;
  if (existing) {
    attendance = await prisma.dutyAttendance.update({
      where: { id: existing.id },
      data:  { in_time: new Date(), in_status },
    });
  } else {
    attendance = await prisma.dutyAttendance.create({
      data: {
        duty_slot_id: slot.id,
        faculty_id:   req.user.id,
        in_time:      new Date(),
        in_status,
      },
    });
  }

  res.status(201).json(attendance);
}

// ─── POST /attendance/:dutySlotId/check-out ───────────────────────────────────

async function checkOut(req, res) {
  const slot = await resolveSlotForFaculty(req.params.dutySlotId, req.user.id, res);
  if (!slot) return;

  const attendance = await prisma.dutyAttendance.findUnique({ where: { duty_slot_id: slot.id } });

  if (!attendance?.in_time) {
    return res.status(409).json({
      error: true,
      code: 'NOT_CHECKED_IN',
      message: 'You must check in before checking out.',
    });
  }

  if (attendance.out_time) {
    return res.status(409).json({
      error: true,
      code: 'ALREADY_CHECKED_OUT',
      message: 'You have already checked out for this duty slot.',
    });
  }

  const updated = await prisma.dutyAttendance.update({
    where: { id: attendance.id },
    data:  { out_time: new Date(), out_status: 'normal' },
  });

  await prisma.dutySlot.update({
    where: { id: slot.id },
    data:  { status: 'completed' },
  });

  res.json(updated);
}

// ─── GET /attendance/live ─────────────────────────────────────────────────────
// Live admin dashboard for the current duty day.
// performed_by_id is the attendance record's faculty (the slot's current owner,
// including any admin reassignment).

async function getLive(req, res) {
  const ist       = nowInIST();
  const todayRange = istDayRangeUTC(ist.year, ist.month, ist.day);
  const nowMins    = ist.hour * 60 + ist.minute;

  const cfg = await settingsService.getSettings();

  const slots = await prisma.dutySlot.findMany({
    where: { duty_date: todayRange },
    include: {
      faculty:    { select: { id: true, name: true, email: true, department: true } },
      attendance: true,
    },
    orderBy: [{ session_type: 'asc' }, { faculty: { name: 'asc' } }],
  });

  // A no-show-yet slot is "upcoming" until its session actually starts, then
  // "not_checked_in" for the rest of the session — no separate time-gated
  // cutoff stage (P26: not-checked-in cutoff removed).
  function resolveNoAttendanceStatus(sessionType) {
    const startHour = sessionType === 'morning'
      ? cfg.session_start_morning_hour
      : cfg.session_start_afternoon_hour;
    const startMin  = sessionType === 'morning'
      ? cfg.session_start_morning_min
      : cfg.session_start_afternoon_min;
    return nowMins < startHour * 60 + startMin ? 'upcoming' : 'not_checked_in';
  }

  const result = slots.map((s) => ({
    slot_id:          s.id,
    faculty:          s.faculty,
    // ID of the person whose check-in was recorded (the actual duty performer).
    performed_by_id:  s.attendance?.faculty_id ?? null,
    duty_date:        s.duty_date,
    session_type:     s.session_type,
    slot_status:      s.status,
    attendance_status: !s.attendance
      ? resolveNoAttendanceStatus(s.session_type)
      : s.attendance.out_time
      ? 'checked_out'
      : 'checked_in',
    in_time:    s.attendance?.in_time    ?? null,
    out_time:   s.attendance?.out_time   ?? null,
    in_status:  s.attendance?.in_status  ?? null,
    out_status: s.attendance?.out_status ?? null,
    auto_out:   s.attendance?.auto_out   ?? false,
  }));

  const pad = (n) => String(n).padStart(2, '0');
  res.json({
    date:  `${ist.year}-${pad(ist.month)}-${pad(ist.day)}`,
    total: result.length,
    data:  result,
  });
}

// ─── GET /attendance/mine/summary ─────────────────────────────────────────────
// Personalized attendance dashboard for the logged-in faculty member — their own
// duty slots (as currently assigned) for one month, joined with attendance, plus
// aggregate counts overall and per session. Late/not-checked-in/auto-out are all
// derived from the same admin-configured system_config thresholds used by the
// admin live dashboard (getLive) and check-in flow — never hardcoded here.

async function getMySummary(req, res) {
  const ist = nowInIST();
  const year  = req.query.year  !== undefined ? parseInt(req.query.year, 10)  : ist.year;
  const month = req.query.month !== undefined ? parseInt(req.query.month, 10) : ist.month;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: true, code: 'BAD_REQUEST', message: 'Invalid year.' });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: true, code: 'BAD_REQUEST', message: 'Month must be between 1 and 12.' });
  }

  const cfg      = await settingsService.getSettings();
  const todayStr = formatDateIST(new Date());
  const nowMins  = ist.hour * 60 + ist.minute;

  const slots = await prisma.dutySlot.findMany({
    where: {
      duty_date: monthDateRange(year, month),
      faculty_id: req.user.id,
    },
    include: { attendance: true },
    orderBy: [{ duty_date: 'asc' }, { session_type: 'asc' }],
  });

  // Mirrors getLive's resolveNoAttendanceStatus, extended across past/future
  // dates: a past slot's session has necessarily already started (not_checked_in),
  // a future slot hasn't started yet (upcoming), only "today" needs the session-start check.
  function resolveAttendanceStatus(slot) {
    if (slot.attendance?.out_time) return 'checked_out';
    if (slot.attendance?.in_time)  return 'checked_in';

    const slotDateStr = formatDateIST(slot.duty_date);
    if (slotDateStr > todayStr) return 'upcoming';
    if (slotDateStr < todayStr) return 'not_checked_in';

    const startHour = slot.session_type === 'morning'
      ? cfg.session_start_morning_hour
      : cfg.session_start_afternoon_hour;
    const startMin  = slot.session_type === 'morning'
      ? cfg.session_start_morning_min
      : cfg.session_start_afternoon_min;
    return nowMins < startHour * 60 + startMin ? 'upcoming' : 'not_checked_in';
  }

  const history = slots.map((s) => ({
    slot_id:           s.id,
    duty_date:         s.duty_date,
    session_type:      s.session_type,
    slot_status:       s.status,
    attendance_status: resolveAttendanceStatus(s),
    in_time:           s.attendance?.in_time    ?? null,
    out_time:          s.attendance?.out_time   ?? null,
    in_status:         s.attendance?.in_status  ?? null,
    out_status:        s.attendance?.out_status ?? null,
    auto_out:          s.attendance?.auto_out   ?? false,
  }));

  function tally(records) {
    return {
      total:          records.length,
      checked_in:     records.filter((r) => !!r.in_time).length,
      checked_out:    records.filter((r) => !!r.out_time).length,
      late:           records.filter((r) => r.in_status === 'late').length,
      not_checked_in: records.filter((r) => r.attendance_status === 'not_checked_in').length,
      auto_out:       records.filter((r) => r.auto_out).length,
    };
  }

  const today = history.filter((h) => formatDateIST(h.duty_date) === todayStr);

  res.json({
    year,
    month,
    today,
    summary: {
      ...tally(history),
      morning:   tally(history.filter((h) => h.session_type === 'morning')),
      afternoon: tally(history.filter((h) => h.session_type === 'afternoon')),
    },
    data: history,
  });
}

// ─── GET /attendance/:dutySlotId ──────────────────────────────────────────────

async function getAttendance(req, res) {
  const slot = await prisma.dutySlot.findUnique({ where: { id: req.params.dutySlotId } });
  if (!slot) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Duty slot not found.' });
  }

  // Faculty can view attendance only for slots they currently own.
  if (req.user.role === 'faculty' && slot.faculty_id !== req.user.id) {
    return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'Access denied.' });
  }

  const attendance = await prisma.dutyAttendance.findUnique({ where: { duty_slot_id: slot.id } });
  if (!attendance) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'No attendance record for this slot yet.' });
  }

  res.json(attendance);
}

// ─── PATCH /attendance/:dutySlotId/override ───────────────────────────────────

async function overrideAttendance(req, res) {
  const slot = await prisma.dutySlot.findUnique({ where: { id: req.params.dutySlotId } });
  if (!slot) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Duty slot not found.' });
  }

  let attendance = await prisma.dutyAttendance.findUnique({ where: { duty_slot_id: slot.id } });

  const { in_time, out_time, in_status, out_status, override_reason } = req.body;

  const data = {
    overridden_by:   req.user.id,
    override_reason,
    ...(in_time    !== undefined && { in_time:    new Date(in_time) }),
    ...(out_time   !== undefined && { out_time:   new Date(out_time) }),
    ...(in_status  !== undefined && { in_status }),
    ...(out_status !== undefined && { out_status }),
  };

  if (attendance) {
    attendance = await prisma.dutyAttendance.update({ where: { id: attendance.id }, data });
  } else {
    // When creating from scratch, use the slot's faculty_id as the record owner
    // (the current owner after any reassignment).
    attendance = await prisma.dutyAttendance.create({
      data: { duty_slot_id: slot.id, faculty_id: slot.faculty_id, ...data },
    });
  }

  if (out_time) {
    await prisma.dutySlot.update({ where: { id: slot.id }, data: { status: 'completed' } });
  }

  logAction({
    actorId: req.user.id,
    action: 'ATTENDANCE_OVERRIDE',
    targetId: slot.id,
    targetType: 'duty_slot',
    metadata: { ...data, in_time: data.in_time?.toISOString(), out_time: data.out_time?.toISOString() },
  }).catch(() => {});

  res.json(attendance);
}

module.exports = { checkIn, checkOut, getLive, getMySummary, getAttendance, overrideAttendance };
