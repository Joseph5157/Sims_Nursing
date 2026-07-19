// ─── Report date-range utility (IST-explicit) ────────────────────────────────
//
// Single source of truth for every report/analytics date boundary. All report
// endpoints MUST build their date filters through this module so month, year,
// day and week windows are constructed identically and independently of the
// server's `TZ` env var or the Postgres session time zone.
//
// Two column kinds need DIFFERENT boundary semantics — mixing one range object
// for both was the original correctness bug:
//
//   • `@db.Date`  (duty_slots.duty_date, duty_reassignments.duty_date)
//       A pure calendar date. Prisma returns these as UTC-midnight JS Dates
//       ("2026-07-15" → 2026-07-15T00:00:00.000Z), so they must be compared
//       against `Date.UTC(...)` calendar boundaries (same convention as
//       lib/time.js `istDayRangeUTC`). Inclusive on both ends.
//
//   • `timestamptz` (violations.created_at — the admin ad-hoc record time)
//       A true instant. An IST calendar period maps to a fixed half-open UTC
//       window because IST is a constant UTC+05:30 (no DST). Built from
//       lib/time.js `istWallToUTC`. gte start, lt end.
//
// A period bundles both, so `violationInPeriod` can match slot-linked
// violations by their duty_date and admin ad-hoc (slot-less) violations by
// their created_at, each with the correct boundary kind.

const { istWallToUTC } = require('./time');

// ── @db.Date calendar-date ranges (inclusive [start, end]) ────────────────────

function monthDutyDateRange(year, month) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lte: new Date(Date.UTC(year, month, 0)), // day 0 of the next month = last day of this month
  };
}

function yearDutyDateRange(year) {
  return {
    gte: new Date(Date.UTC(year, 0, 1)),
    lte: new Date(Date.UTC(year, 11, 31)),
  };
}

function dayDutyDateRange({ year, month, day }) {
  const d = new Date(Date.UTC(year, month - 1, day));
  return { gte: d, lte: d };
}

function rangeDutyDateRange(from, to) {
  return {
    gte: new Date(Date.UTC(from.year, from.month - 1, from.day)),
    lte: new Date(Date.UTC(to.year, to.month - 1, to.day)),
  };
}

// ── timestamptz instant ranges in IST wall-clock (half-open [start, end)) ─────

function monthInstantRange(year, month) {
  // istWallToUTC handles month overflow (month = 13 → next January).
  return { gte: istWallToUTC(year, month, 1, 0, 0), lt: istWallToUTC(year, month + 1, 1, 0, 0) };
}

function yearInstantRange(year) {
  return { gte: istWallToUTC(year, 1, 1, 0, 0), lt: istWallToUTC(year + 1, 1, 1, 0, 0) };
}

function dayInstantRange({ year, month, day }) {
  // day + 1 overflows into the next month/year cleanly via Date.UTC.
  return { gte: istWallToUTC(year, month, day, 0, 0), lt: istWallToUTC(year, month, day + 1, 0, 0) };
}

function rangeInstantRange(from, to) {
  // Inclusive of the whole of `to`'s IST day → exclusive upper bound is the
  // start of the following IST day.
  return { gte: istWallToUTC(from.year, from.month, from.day, 0, 0), lt: istWallToUTC(to.year, to.month, to.day + 1, 0, 0) };
}

// ── Period bundles (duty_date + instant) ──────────────────────────────────────

function monthPeriod(year, month) {
  return { dutyDate: monthDutyDateRange(year, month), instant: monthInstantRange(year, month) };
}

function yearPeriod(year) {
  return { dutyDate: yearDutyDateRange(year), instant: yearInstantRange(year) };
}

function dayPeriod(parts) {
  return { dutyDate: dayDutyDateRange(parts), instant: dayInstantRange(parts) };
}

function weekPeriod(from, to) {
  return { dutyDate: rangeDutyDateRange(from, to), instant: rangeInstantRange(from, to) };
}

// A violation's effective date is its duty slot's duty_date, but admin ad-hoc
// records have no slot (duty_slot_id = null) — for those the effective date is
// created_at. Match both so admin-recorded violations are never dropped from a
// date-scoped report, each with its correct boundary kind.
function violationInPeriod(period) {
  return {
    OR: [
      { dutySlot: { duty_date: period.dutyDate } },
      { duty_slot_id: null, created_at: period.instant },
    ],
  };
}

// Strict 'YYYY-MM-DD' parser. Returns { year, month, day } or null (malformed).
// Validates real calendar dates (rejects 2026-02-30, 2026-13-01, etc.).
function parseIsoDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str ?? ''));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Round-trip through Date.UTC to reject impossible days (e.g. Feb 30).
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return null;
  return { year, month, day };
}

module.exports = {
  monthDutyDateRange,
  yearDutyDateRange,
  dayDutyDateRange,
  rangeDutyDateRange,
  monthInstantRange,
  yearInstantRange,
  dayInstantRange,
  rangeInstantRange,
  monthPeriod,
  yearPeriod,
  dayPeriod,
  weekPeriod,
  violationInPeriod,
  parseIsoDate,
};
