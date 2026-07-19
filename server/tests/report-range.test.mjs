import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const _require = createRequire(import.meta.url);
const {
  monthDutyDateRange,
  yearDutyDateRange,
  dayDutyDateRange,
  monthInstantRange,
  yearInstantRange,
  dayInstantRange,
  rangeInstantRange,
  monthPeriod,
  weekPeriod,
  violationInPeriod,
  parseIsoDate,
} = _require('../lib/reportRange');

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// The UTC instant at which a given IST wall-clock time occurs. Mirrors how a
// `created_at` timestamp is produced when a record is made at that IST moment.
function istInstant(y, m, d, hh = 0, mm = 0) {
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MS);
}

// Half-open membership: gte <= t < lt (the instant-range convention).
function inInstantRange(instant, r) {
  return instant.getTime() >= r.gte.getTime() && instant.getTime() < r.lt.getTime();
}

// Inclusive membership for @db.Date ranges (gte <= d <= lte). Duty dates are
// UTC-midnight Dates, matching how Prisma returns @db.Date values.
function inDutyDateRange(dutyDate, r) {
  return dutyDate.getTime() >= r.gte.getTime() && dutyDate.getTime() <= r.lte.getTime();
}
const utcDate = (y, m, d) => new Date(Date.UTC(y, m - 1, d));

describe('reportRange — instant ranges (created_at / timestamptz)', () => {
  describe('12:30 AM and 11:30 PM IST land in the correct IST day', () => {
    const day = { year: 2026, month: 7, day: 15 };
    const range = dayInstantRange(day);

    it('12:30 AM IST (just after midnight) belongs to that day, not the previous one', () => {
      expect(inInstantRange(istInstant(2026, 7, 15, 0, 30), range)).toBe(true);
      // 12:30 AM the *previous* day must not leak in
      expect(inInstantRange(istInstant(2026, 7, 14, 0, 30), range)).toBe(false);
    });

    it('11:30 PM IST belongs to that day, and 12:30 AM the next day does not', () => {
      expect(inInstantRange(istInstant(2026, 7, 15, 23, 30), range)).toBe(true);
      expect(inInstantRange(istInstant(2026, 7, 16, 0, 30), range)).toBe(false);
    });

    it('day boundaries are exactly IST midnight-to-midnight in UTC', () => {
      expect(range.gte.toISOString()).toBe('2026-07-14T18:30:00.000Z'); // 2026-07-15 00:00 IST
      expect(range.lt.toISOString()).toBe('2026-07-15T18:30:00.000Z');  // 2026-07-16 00:00 IST
    });
  });

  describe('month-end boundary (the classic misclassification bug)', () => {
    const july = monthInstantRange(2026, 7);

    it('11:30 PM IST on Jul 31 counts in July', () => {
      expect(inInstantRange(istInstant(2026, 7, 31, 23, 30), july)).toBe(true);
    });

    it('12:30 AM IST on Aug 1 does NOT count in July', () => {
      expect(inInstantRange(istInstant(2026, 8, 1, 0, 30), july)).toBe(false);
      expect(inInstantRange(istInstant(2026, 8, 1, 0, 30), monthInstantRange(2026, 8))).toBe(true);
    });

    it('2:00 AM IST on Jul 1 counts in July, not June (the admin ad-hoc regression)', () => {
      // On a UTC server the old `new Date(2026,6,1)` boundary would have put this
      // 2026-06-30T20:30:00Z instant in June. It must be July.
      expect(inInstantRange(istInstant(2026, 7, 1, 2, 0), july)).toBe(true);
      expect(inInstantRange(istInstant(2026, 7, 1, 2, 0), monthInstantRange(2026, 6))).toBe(false);
    });

    it('July boundaries are IST-correct in UTC', () => {
      expect(july.gte.toISOString()).toBe('2026-06-30T18:30:00.000Z'); // Jul 1 00:00 IST
      expect(july.lt.toISOString()).toBe('2026-07-31T18:30:00.000Z');  // Aug 1 00:00 IST
    });
  });

  describe('year-end boundary', () => {
    const y2026 = yearInstantRange(2026);

    it('11:30 PM IST on Dec 31 2026 counts in 2026', () => {
      expect(inInstantRange(istInstant(2026, 12, 31, 23, 30), y2026)).toBe(true);
    });

    it('12:30 AM IST on Jan 1 2027 counts in 2027, not 2026', () => {
      expect(inInstantRange(istInstant(2027, 1, 1, 0, 30), y2026)).toBe(false);
      expect(inInstantRange(istInstant(2027, 1, 1, 0, 30), yearInstantRange(2027))).toBe(true);
    });

    it('year boundaries are IST-correct in UTC', () => {
      expect(y2026.gte.toISOString()).toBe('2025-12-31T18:30:00.000Z'); // 2026-01-01 00:00 IST
      expect(y2026.lt.toISOString()).toBe('2026-12-31T18:30:00.000Z');  // 2027-01-01 00:00 IST
    });
  });

  describe('week (inclusive from..to) range', () => {
    const week = rangeInstantRange({ year: 2026, month: 7, day: 15 }, { year: 2026, month: 7, day: 21 });

    it('includes 11:30 PM IST on the final day (to is inclusive of its whole IST day)', () => {
      expect(inInstantRange(istInstant(2026, 7, 21, 23, 30), week)).toBe(true);
    });

    it('excludes 12:30 AM IST on the day after the range', () => {
      expect(inInstantRange(istInstant(2026, 7, 22, 0, 30), week)).toBe(false);
    });

    it('includes 12:30 AM IST on the first day', () => {
      expect(inInstantRange(istInstant(2026, 7, 15, 0, 30), week)).toBe(true);
      expect(inInstantRange(istInstant(2026, 7, 14, 23, 30), week)).toBe(false);
    });
  });
});

describe('reportRange — @db.Date ranges (duty_date)', () => {
  it('month range spans first to last calendar day at UTC midnight', () => {
    const r = monthDutyDateRange(2026, 7);
    expect(r.gte.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(r.lte.toISOString()).toBe('2026-07-31T00:00:00.000Z');
    expect(inDutyDateRange(utcDate(2026, 7, 1), r)).toBe(true);
    expect(inDutyDateRange(utcDate(2026, 7, 31), r)).toBe(true);
    expect(inDutyDateRange(utcDate(2026, 8, 1), r)).toBe(false);
    expect(inDutyDateRange(utcDate(2026, 6, 30), r)).toBe(false);
  });

  it('handles February in a leap year (last day = 29)', () => {
    const r = monthDutyDateRange(2028, 2);
    expect(r.lte.toISOString()).toBe('2028-02-29T00:00:00.000Z');
    expect(inDutyDateRange(utcDate(2028, 2, 29), r)).toBe(true);
    expect(inDutyDateRange(utcDate(2028, 3, 1), r)).toBe(false);
  });

  it('year range spans Jan 1 to Dec 31', () => {
    const r = yearDutyDateRange(2026);
    expect(r.gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(r.lte.toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });

  it('single-day range is that exact date', () => {
    const r = dayDutyDateRange({ year: 2026, month: 7, day: 15 });
    expect(r.gte.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    expect(r.lte.toISOString()).toBe('2026-07-15T00:00:00.000Z');
  });
});

describe('reportRange — violationInPeriod uses the right column per branch', () => {
  it('matches slot-linked by duty_date and admin ad-hoc by created_at', () => {
    const period = monthPeriod(2026, 7);
    const filter = violationInPeriod(period);
    expect(filter.OR).toHaveLength(2);
    // slot-linked branch → duty_date (calendar) range
    expect(filter.OR[0]).toEqual({ dutySlot: { duty_date: period.dutyDate } });
    // slot-less admin ad-hoc branch → created_at (instant) range
    expect(filter.OR[1]).toEqual({ duty_slot_id: null, created_at: period.instant });
    // and the two branches use different boundary kinds
    expect(period.dutyDate.gte.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(period.instant.gte.toISOString()).toBe('2026-06-30T18:30:00.000Z');
  });

  it('weekPeriod bundles a duty-date range and an instant range', () => {
    const p = weekPeriod({ year: 2026, month: 7, day: 15 }, { year: 2026, month: 7, day: 21 });
    expect(p.dutyDate.lte.toISOString()).toBe('2026-07-21T00:00:00.000Z');
    expect(p.instant.lt.toISOString()).toBe('2026-07-21T18:30:00.000Z'); // Jul 22 00:00 IST
  });
});

describe('reportRange — parseIsoDate', () => {
  it('parses a valid date', () => {
    expect(parseIsoDate('2026-07-15')).toEqual({ year: 2026, month: 7, day: 15 });
  });

  it('rejects malformed and impossible dates', () => {
    expect(parseIsoDate('2026-13-01')).toBeNull(); // month 13
    expect(parseIsoDate('2026-02-30')).toBeNull(); // Feb 30
    expect(parseIsoDate('2026-00-10')).toBeNull(); // month 0
    expect(parseIsoDate('2026-7-1')).toBeNull();   // not zero-padded
    expect(parseIsoDate('garbage')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
  });
});
