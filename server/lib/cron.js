const cron = require('node-cron');
const prisma = require('./prisma');
const logger = require('./logger');
const telegram = require('./telegram');
const settingsService = require('../services/settings.service');
const { nowInIST, istDayRangeUTC, istWallToUTC, formatDateIST } = require('./time');

// All schedules fire at IST times via { timezone: 'Asia/Kolkata' }.
// Date calculations inside each job use IST-aware helpers so they are correct
// even when the server's TZ env var is UTC (the default on Railway).

// ─── 1. Auto clock-out — every 10 minutes, per-session configured cutoff ──────
// Each session (Morning/Afternoon) has its own configurable auto-checkout
// time (e.g. Morning 12:00 PM, Afternoon 5:00 PM), so a single once-daily
// trigger can't serve both — this job ticks frequently and only clocks out
// a (date, session) group once THAT session's own cutoff has passed.

async function autoClockOut() {
  const ist = nowInIST();
  const nowMins = ist.hour * 60 + ist.minute;
  const throughToday = istDayRangeUTC(ist.year, ist.month, ist.day).lte;
  const cfg = await settingsService.getSettings();

  // ── Auto clock-out (checked-in, no check-out) ──
  const openAttendance = await prisma.dutyAttendance.findMany({
    where: {
      dutySlot: { duty_date: { lte: throughToday } },
      in_time:  { not: null },
      out_time: null,
    },
    select: { id: true, duty_slot_id: true, dutySlot: { select: { duty_date: true, session_type: true } } },
  });

  if (openAttendance.length > 0) {
    const byGroup = new Map();
    for (const a of openAttendance) {
      const d = a.dutySlot.duty_date;
      const sessionType = a.dutySlot.session_type;
      const key = `${d.toISOString().slice(0, 10)}:${sessionType}`;
      if (!byGroup.has(key)) byGroup.set(key, { date: d, sessionType, attendanceIds: [], slotIds: [] });
      const group = byGroup.get(key);
      group.attendanceIds.push(a.id);
      group.slotIds.push(a.duty_slot_id);
    }

    let closedCount = 0;
    for (const { date, sessionType, attendanceIds, slotIds } of byGroup.values()) {
      const isToday = date.getUTCFullYear() === ist.year
        && date.getUTCMonth() + 1 === ist.month
        && date.getUTCDate() === ist.day;

      const cutoffHour = sessionType === 'morning' ? cfg.auto_checkout_morning_hour : cfg.auto_checkout_afternoon_hour;
      const cutoffMin  = sessionType === 'morning' ? cfg.auto_checkout_morning_min  : cfg.auto_checkout_afternoon_min;

      if (isToday && nowMins < cutoffHour * 60 + cutoffMin) continue;

      const autoOutUTC = istWallToUTC(
        date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(),
        cutoffHour, cutoffMin,
      );

      await prisma.$transaction([
        prisma.dutyAttendance.updateMany({
          where: { id: { in: attendanceIds } },
          data:  { out_time: autoOutUTC, out_status: 'auto', auto_out: true },
        }),
        prisma.dutySlot.updateMany({
          where: { id: { in: slotIds } },
          data:  { status: 'completed' },
        }),
      ]);

      closedCount += attendanceIds.length;
    }

    if (closedCount > 0) {
      logger.info(`[cron] Auto clock-out: ${closedCount} record(s) closed.`);
    }
  }

  // ── No-show → absent (scheduled, never checked in, past cutoff) ──
  const absentCount = await markNoShowAbsent(throughToday, nowMins, ist, cfg);
  if (absentCount > 0) {
    logger.info(`[cron] No-show absent: ${absentCount} slot(s) marked absent.`);
  }
}

// ─── 2. Mark no-show slots absent — runs with auto clock-out ─────────────────
// After a session's auto-checkout time has passed, any scheduled slot that has
// never been checked into is marked absent — both the duty_slot status and the
// attendance record (with in_status='absent'). This is the sole path that
// produces absent records; reports depend on it.

async function markNoShowAbsent(throughToday, nowMins, ist, cfg) {
  const openSlots = await prisma.dutySlot.findMany({
    where: {
      duty_date: { lte: throughToday },
      status: 'scheduled',
      attendance: null,
    },
    select: { id: true, duty_date: true, session_type: true, faculty_id: true },
  });

  if (openSlots.length === 0) return 0;

  const idsToMark = [];

  for (const slot of openSlots) {
    const isToday = slot.duty_date.getUTCFullYear() === ist.year
      && slot.duty_date.getUTCMonth() + 1 === ist.month
      && slot.duty_date.getUTCDate() === ist.day;

    const cutoffHour = slot.session_type === 'morning' ? cfg.auto_checkout_morning_hour : cfg.auto_checkout_afternoon_hour;
    const cutoffMin  = slot.session_type === 'morning' ? cfg.auto_checkout_morning_min  : cfg.auto_checkout_afternoon_min;

    if (isToday && nowMins < cutoffHour * 60 + cutoffMin) continue;

    idsToMark.push(slot);
  }

  if (idsToMark.length === 0) return 0;

  let markedCount = 0;

  for (const slot of idsToMark) {
    try {
      await prisma.$transaction([
        prisma.dutyAttendance.create({
          data: {
            duty_slot_id: slot.id,
            faculty_id: slot.faculty_id,
            in_status: 'absent',
          },
        }),
        prisma.dutySlot.update({
          where: { id: slot.id },
          data: { status: 'absent' },
        }),
      ]);
      markedCount++;
    } catch (err) {
      // Isolate per-slot so one bad transaction doesn't block the rest of the
      // batch — the query is idempotent, so a failed slot is simply retried
      // on the next tick, but log it so a persistently-failing slot is visible.
      logger.error(`[cron] markNoShowAbsent failed for slot ${slot.id}: ${err.message}`);
    }
  }

  return markedCount;
}
// ─── 3. Calendar auto-close — 23:55 IST on the last day of the month ─────────
// Fires at 23:55 IST so faculty have the full last day to pick slots.

async function autoCloseCalendar() {
  const ist = nowInIST();

  // Last day of the current IST month (day 0 of next month = last day of this month)
  const lastDay = new Date(Date.UTC(ist.year, ist.month, 0)).getUTCDate();

  if (ist.day !== lastDay) return;

  const result = await prisma.calendarConfig.updateMany({
    where: { config_month: ist.month, config_year: ist.year, is_window_open: true },
    data:  { is_window_open: false },
  });

  if (result.count > 0) {
    logger.info(`[cron] Calendar auto-close: window closed for ${ist.year}-${String(ist.month).padStart(2, '0')}.`);
  }
}

// ─── 4. Daily duty digest — 08:00 IST ─────────────────────────────────────────
// One consolidated Telegram message per faculty member who holds an active
// duty slot today, sent as a same-day heads-up ahead of the (admin-configured)
// session start time. faculty_id on DutySlot always reflects the current
// holder (reassignment updates it in place — see schema comment on
// DutyReassignment), so no separate "reassigned away" filtering is needed here.

async function sendDailyDutyDigest() {
  const ist = nowInIST();
  const { gte, lte } = istDayRangeUTC(ist.year, ist.month, ist.day);

  const slots = await prisma.dutySlot.findMany({
    where: { duty_date: { gte, lte }, status: 'scheduled' },
    select: {
      session_type: true,
      duty_date: true,
      faculty: { select: { id: true, name: true, telegram_id: true } },
    },
  });

  if (slots.length === 0) return;

  const byFaculty = new Map();
  for (const slot of slots) {
    if (!slot.faculty.telegram_id) continue;
    if (!byFaculty.has(slot.faculty.id)) {
      byFaculty.set(slot.faculty.id, { faculty: slot.faculty, duty_date: slot.duty_date, sessions: [] });
    }
    byFaculty.get(slot.faculty.id).sessions.push(slot.session_type);
  }

  const appUrl = process.env.APP_URL || 'https://sims-dms.railway.app';
  let sentCount = 0;

  for (const { faculty, duty_date, sessions } of byFaculty.values()) {
    const sessionLabel = sessions
      .map((s) => (s === 'morning' ? 'Morning' : 'Afternoon'))
      .join(' & ');

    const text =
      `📌 <b>You're on duty today</b>\n\n` +
      `You have duty on <b>${formatDateIST(duty_date)}</b> (${sessionLabel}).\n\n` +
      `View your schedule: ${appUrl}/faculty/slots`;

    try {
      await telegram.sendMessage(faculty.telegram_id, text);
      sentCount++;
    } catch (err) {
      logger.warn(`[cron] Daily duty digest send failed for faculty ${faculty.id}: ${err.message}`);
    }
  }

  if (sentCount > 0) {
    logger.info(`[cron] Daily duty digest: sent to ${sentCount} faculty.`);
  }
}

// ─── Wrap jobs with error handling ────────────────────────────────────────────

async function safeAutoClockOut() {
  try {
    await autoClockOut();
  } catch (err) {
    logger.error('[cron] autoClockOut failed:', err.message);
  }
}

async function safeAutoCloseCalendar() {
  try {
    await autoCloseCalendar();
  } catch (err) {
    logger.error('[cron] autoCloseCalendar failed:', err.message);
  }
}

async function safeSendDailyDutyDigest() {
  try {
    await sendDailyDutyDigest();
  } catch (err) {
    logger.error('[cron] sendDailyDutyDigest failed:', err.message);
  }
}

// ─── Register all jobs ────────────────────────────────────────────────────────

function startCronJobs() {
  cron.schedule('*/10 * * * *', safeAutoClockOut,        { timezone: 'Asia/Kolkata' });
  cron.schedule('55 23 * * *',  safeAutoCloseCalendar,    { timezone: 'Asia/Kolkata' });
  cron.schedule('0 8 * * *',    safeSendDailyDutyDigest,  { timezone: 'Asia/Kolkata' });

  logger.info('[cron] All scheduled jobs registered.');
}

module.exports = { startCronJobs, autoClockOut, sendDailyDutyDigest, markNoShowAbsent };
