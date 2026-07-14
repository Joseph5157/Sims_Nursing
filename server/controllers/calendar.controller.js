const prisma = require('../lib/prisma');
const telegram = require('../lib/telegram');
const { logAction } = require('../services/audit.service');
const logger = require('../lib/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseParams(req, res) {
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

// Last moment of the last day of a given month (local midnight is fine — stored as UTC in Railway)
function lastDayOfMonth(year, month) {
  return new Date(year, month, 0, 23, 59, 59, 999); // month is 1-based; day 0 = last day of prev month
}

// Derive working_days as every calendar date in the month minus blocked holidays
function deriveWorkingDays(year, month, blockedDates) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const blocked = new Set(Array.isArray(blockedDates) ? blockedDates : []);
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!blocked.has(dateStr)) days.push(dateStr);
  }
  return days;
}

// Find or create a CalendarConfig row — never leave the caller with null
async function getOrCreateConfig(year, month) {
  const existing = await prisma.calendarConfig.findUnique({
    where: { config_month_config_year: { config_month: month, config_year: year } },
  });
  if (existing) return existing;
  return prisma.calendarConfig.create({
    data: { config_month: month, config_year: year },
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// en-IN, IST-anchored "31 July 2026" — matches the long-date style already
// used on the admin Calendar page (CalendarPage.jsx), not the raw ISO dates
// used in per-duty transactional messages elsewhere.
function formatFriendlyDateIST(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Send Telegram notifications to all active faculty (fire-and-forget).
// Sends are staggered ~50ms apart (dispatch, not completion) to stay well
// under Telegram's ~30 msg/sec limit — at ~40 faculty a burst can otherwise
// tail into 429s. Failure handling per recipient is unchanged.
async function notifyAllFaculty(year, month, config) {
  const faculty = await prisma.user.findMany({
    where: { role: 'faculty', status: 'active', deleted_at: null, telegram_id: { not: null } },
    select: { id: true, telegram_id: true, name: true },
  });

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  const slotCount = config.sessions_per_faculty;
  const slotsLabel = `${slotCount} duty slot${slotCount === 1 ? '' : 's'}`;
  const closesLabel = config.closes_at ? formatFriendlyDateIST(config.closes_at) : null;
  const appUrl = process.env.APP_URL || 'https://sims-dms.railway.app';

  const text =
    `📅 <b>Duty Scheduling Window Open</b>\n\n` +
    `The duty slot selection window for <b>${monthLabel}</b> is now open.\n\n` +
    `You need to pick <b>${slotsLabel}</b> this month.` +
    (closesLabel ? `\n⏰ Closes: <b>${closesLabel}</b>` : '') +
    `\n\nPick your slots: ${appUrl}/faculty/slots`;

  for (const f of faculty) {
    telegram.sendMessage(f.telegram_id, text).catch((err) => {
      logger.warn(`Telegram notify failed for faculty ${f.id}: ${err.message}`);
    });
    await sleep(50);
  }
}

// ─── GET /calendar/:year/:month ───────────────────────────────────────────────

async function getConfig(req, res) {
  const params = parseParams(req, res);
  if (!params) return;
  const { year, month } = params;

  const config = await getOrCreateConfig(year, month);
  res.json(config);
}

// ─── POST /calendar/:year/:month/open ─────────────────────────────────────────

async function openWindow(req, res) {
  const params = parseParams(req, res);
  if (!params) return;
  const { year, month } = params;

  let config = await getOrCreateConfig(year, month);

  if (config.is_window_open) {
    return res.status(409).json({
      error: true,
      code: 'WINDOW_ALREADY_OPEN',
      message: 'The scheduling window is already open for this month.',
    });
  }

  const workingDays = deriveWorkingDays(year, month, config.blocked_dates);

  config = await prisma.calendarConfig.update({
    where: { id: config.id },
    data: {
      is_window_open: true,
      opened_by: req.user.id,
      opened_at: new Date(),
      closes_at: lastDayOfMonth(year, month),
      working_days: workingDays,
    },
  });

  await logAction({
    actorId: req.user.id,
    action: 'CALENDAR_WINDOW_OPEN',
    targetId: config.id,
    targetType: 'calendar_config',
    metadata: { year, month },
  });

  // Notify all faculty asynchronously — do not block the response
  notifyAllFaculty(year, month, config);

  res.json(config);
}

// ─── POST /calendar/:year/:month/close ────────────────────────────────────────

async function closeWindow(req, res) {
  const params = parseParams(req, res);
  if (!params) return;
  const { year, month } = params;

  const config = await prisma.calendarConfig.findUnique({
    where: { config_month_config_year: { config_month: month, config_year: year } },
  });

  if (!config) {
    return res.status(404).json({
      error: true,
      code: 'NOT_FOUND',
      message: 'No calendar configuration found for this month.',
    });
  }

  if (!config.is_window_open) {
    return res.status(409).json({
      error: true,
      code: 'WINDOW_NOT_OPEN',
      message: 'The scheduling window is not currently open.',
    });
  }

  const updated = await prisma.calendarConfig.update({
    where: { id: config.id },
    data: { is_window_open: false },
  });

  await logAction({
    actorId: req.user.id,
    action: 'CALENDAR_WINDOW_CLOSE',
    targetId: config.id,
    targetType: 'calendar_config',
    metadata: { year, month, manual: true },
  });

  res.json(updated);
}

// ─── PATCH /calendar/:year/:month/blocked-dates ───────────────────────────────

async function updateBlockedDates(req, res) {
  const params = parseParams(req, res);
  if (!params) return;
  const { year, month } = params;

  const config = await getOrCreateConfig(year, month);

  const newBlocked = req.body.blocked_dates;
  const workingDays = deriveWorkingDays(year, month, newBlocked);

  const updated = await prisma.calendarConfig.update({
    where: { id: config.id },
    data: { blocked_dates: newBlocked, working_days: workingDays },
  });

  await logAction({
    actorId: req.user.id,
    action: 'CALENDAR_BLOCKED_DATES_UPDATE',
    targetId: config.id,
    targetType: 'calendar_config',
    metadata: { year, month, blocked_dates: req.body.blocked_dates },
  });

  res.json(updated);
}

// ─── PATCH /calendar/:year/:month/working-days ───────────────────────────────

async function updateWorkingDays(req, res) {
  const params = parseParams(req, res);
  if (!params) return;
  const { year, month } = params;

  const config = await getOrCreateConfig(year, month);

  const updated = await prisma.calendarConfig.update({
    where: { id: config.id },
    data: { working_days: req.body.working_days },
  });

  await logAction({
    actorId: req.user.id,
    action: 'CALENDAR_WORKING_DAYS_UPDATE',
    targetId: config.id,
    targetType: 'calendar_config',
    metadata: { year, month, working_days: req.body.working_days },
  });

  res.json(updated);
}

// ─── PATCH /calendar/:year/:month/sessions-per-faculty ────────────────────────

async function updateSessionsPerFaculty(req, res) {
  const params = parseParams(req, res);
  if (!params) return;
  const { year, month } = params;

  const config = await getOrCreateConfig(year, month);

  const updated = await prisma.calendarConfig.update({
    where: { id: config.id },
    data: { sessions_per_faculty: req.body.sessions_per_faculty },
  });

  await logAction({
    actorId: req.user.id,
    action: 'CALENDAR_SESSIONS_UPDATE',
    targetId: config.id,
    targetType: 'calendar_config',
    metadata: { year, month, sessions_per_faculty: req.body.sessions_per_faculty },
  });

  res.json(updated);
}

// ─── GET /calendar/:year/:month/unassigned-faculty ────────────────────────────

async function getUnassignedFaculty(req, res) {
  const params = parseParams(req, res);
  if (!params) return;
  const { year, month } = params;

  const config = await prisma.calendarConfig.findUnique({
    where: { config_month_config_year: { config_month: month, config_year: year } },
  });

  const required = config?.sessions_per_faculty ?? 3;

  // Date range for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  // All active faculty
  const allFaculty = await prisma.user.findMany({
    where: { role: 'faculty', status: 'active', deleted_at: null },
    select: { id: true, name: true, email: true, department: true, designation: true },
  });

  // Count duty slots per faculty for the month
  const slotCounts = await prisma.dutySlot.groupBy({
    by: ['faculty_id'],
    where: {
      duty_date: { gte: startDate, lte: endDate },
    },
    _count: { id: true },
  });

  const countMap = new Map(slotCounts.map((r) => [r.faculty_id, r._count.id]));

  const unassigned = allFaculty
    .filter((f) => (countMap.get(f.id) ?? 0) < required)
    .map((f) => ({
      ...f,
      slots_picked: countMap.get(f.id) ?? 0,
      slots_required: required,
    }));

  res.json({ data: unassigned, total: unassigned.length, sessions_per_faculty: required });
}

// ─── POST /calendar/:year/:month/assign/:facultyId ────────────────────────────
// Checks each requested slot globally (not per-faculty) using the unique index,
// collects valid ones, then creates them all inside a single transaction so the
// entire valid batch is atomic. A P2002 on the transaction means a concurrent
// request took a slot between our pre-check and the insert; that surfaces as 409.

async function assignSlots(req, res) {
  const params = parseParams(req, res);
  if (!params) return;
  const { year, month } = params;
  const { facultyId } = req.params;

  const faculty = await prisma.user.findUnique({ where: { id: facultyId } });
  if (!faculty || faculty.deleted_at || faculty.role !== 'faculty') {
    return res.status(404).json({
      error: true,
      code: 'NOT_FOUND',
      message: 'Faculty member not found.',
    });
  }

  const { slots } = req.body;

  // Phase 1 — pre-validate: deduplicate within the request and check global conflicts
  const seen = new Set();
  const toCreate = [];
  const skipped = [];

  for (const slot of slots) {
    const key = `${slot.duty_date}|${slot.session_type}`;
    if (seen.has(key)) {
      skipped.push({ ...slot, reason: 'Duplicate in request.' });
      continue;
    }
    seen.add(key);

    // Global check using compound unique index — catches any existing assignment,
    // regardless of which faculty member holds it.
    const existing = await prisma.dutySlot.findUnique({
      where: {
        duty_date_session_type: {
          duty_date: new Date(slot.duty_date),
          session_type: slot.session_type,
        },
      },
    });

    if (existing) {
      skipped.push({ ...slot, reason: 'This slot is already taken.' });
      continue;
    }

    toCreate.push(slot);
  }

  // Phase 2 — create all validated slots in one atomic transaction
  let created = [];
  if (toCreate.length > 0) {
    try {
      created = await prisma.$transaction(
        toCreate.map((slot) =>
          prisma.dutySlot.create({
            data: {
              faculty_id: facultyId,
              duty_date: new Date(slot.duty_date),
              session_type: slot.session_type,
              created_by: req.user.id,
            },
          }),
        ),
      );
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({
          error: true,
          code: 'SLOT_TAKEN',
          message: 'One or more slots were taken by another request during assignment. Please refresh and retry.',
        });
      }
      logger.error(`assignSlots transaction error: ${err.message}`);
      return res.status(500).json({ error: true, code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' });
    }
  }

  await logAction({
    actorId: req.user.id,
    action: 'ADMIN_ASSIGN_SLOTS',
    targetId: facultyId,
    targetType: 'user',
    metadata: { year, month, created_count: created.length, skipped_count: skipped.length },
  });

  res.status(201).json({
    created_count: created.length,
    skipped_count: skipped.length,
    created,
    skipped,
  });
}

module.exports = {
  getConfig,
  openWindow,
  closeWindow,
  updateBlockedDates,
  updateWorkingDays,
  updateSessionsPerFaculty,
  getUnassignedFaculty,
  assignSlots,
  MONTH_NAMES,
  formatFriendlyDateIST,
};
