// IST is UTC+5:30 — 5 hours 30 minutes ahead of UTC.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // 19 800 000 ms

/**
 * Returns the current wall-clock date/time in Asia/Kolkata as plain integers.
 * Works correctly regardless of the server's TZ env var.
 *
 * @param {Date} [now] - defaults to new Date()
 * @returns {{ year, month (1-based), day, hour, minute }}
 */
function nowInIST(now = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  return {
    year:   shifted.getUTCFullYear(),
    month:  shifted.getUTCMonth() + 1,
    day:    shifted.getUTCDate(),
    hour:   shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/**
 * UTC Date range that covers the entire given IST calendar date.
 *
 * Because Prisma returns @db.Date values as UTC-midnight JS Dates
 * (e.g. "2026-06-10" → 2026-06-10T00:00:00.000Z), querying with
 * Date.UTC boundaries for that calendar date selects the correct rows.
 */
function istDayRangeUTC(year, month, day) {
  return {
    gte: new Date(Date.UTC(year, month - 1, day)),
    lte: new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)),
  };
}

/**
 * Returns true when a duty_date (@db.Date, returned as UTC midnight)
 * falls on the current IST calendar date.
 */
function isSlotToday(dutyDate) {
  const ist = nowInIST();
  return (
    dutyDate.getUTCFullYear() === ist.year &&
    dutyDate.getUTCMonth() + 1 === ist.month &&
    dutyDate.getUTCDate() === ist.day
  );
}

/**
 * Converts an IST wall-clock time on a given IST date to a UTC Date.
 * E.g. istWallToUTC(2026, 6, 10, 8, 15) → 2026-06-10T02:45:00.000Z (8:15 AM IST)
 */
function istWallToUTC(year, month, day, hour, minute) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS);
}

/**
 * Formats a Date as an IST date string (YYYY-MM-DD).
 */
function formatDateIST(date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { nowInIST, istDayRangeUTC, isSlotToday, istWallToUTC, formatDateIST };
