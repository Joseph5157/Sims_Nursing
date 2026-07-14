import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

const prisma          = _require('../lib/prisma');
const settingsService = _require('../services/settings.service');
const { nowInIST }     = _require('../lib/time');
const { getMySummary, checkIn } = _require('../controllers/attendance.controller');

const ist = nowInIST();
const year  = ist.year;
const month = ist.month;

const todayUTC     = new Date(Date.UTC(ist.year, ist.month - 1, ist.day));
const yesterdayUTC = new Date(Date.UTC(ist.year, ist.month - 1, ist.day - 1));
const tomorrowUTC  = new Date(Date.UTC(ist.year, ist.month - 1, ist.day + 1));

// Session-start times derived relative to the actual current IST time so
// "today" slots deterministically fall on either side of their session's
// start no matter when this suite runs — mirrors cron.test.mjs's convention.
// (P26: not-checked-in cutoff removed — status is now gated on session_start.)
const nowMins    = ist.hour * 60 + ist.minute;
const pastMins   = Math.max(0, nowMins - 60);
const futureMins = Math.min(1439, nowMins + 60);

const sessionStartedSettings = {
  session_start_morning_hour:   Math.floor(pastMins / 60),
  session_start_morning_min:    pastMins % 60,
  session_start_afternoon_hour: Math.floor(pastMins / 60),
  session_start_afternoon_min:  pastMins % 60,
};

const sessionNotStartedSettings = {
  session_start_morning_hour:   Math.floor(futureMins / 60),
  session_start_morning_min:    futureMins % 60,
  session_start_afternoon_hour: Math.floor(futureMins / 60),
  session_start_afternoon_min:  futureMins % 60,
};

function makeReq(query = {}) {
  return { query, user: { id: 'f1', role: 'faculty' } };
}
function makeRes() {
  const r = { _status: 200, _body: null };
  r.status = (c) => { r._status = c; return r; };
  r.json   = (b) => { r._body = b; return r; };
  return r;
}

describe('getMySummary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns 400 for an invalid month', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sessionStartedSettings);
    vi.spyOn(prisma.dutySlot, 'findMany').mockResolvedValue([]);
    const res = makeRes();
    await getMySummary(makeReq({ year, month: 13 }), res);
    expect(res._status).toBe(400);
    expect(res._body.code).toBe('BAD_REQUEST');
  });

  it('marks a past slot with no attendance as not_checked_in, unconditionally', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sessionNotStartedSettings);
    vi.spyOn(prisma.dutySlot, 'findMany').mockResolvedValue([
      { id: 's1', duty_date: yesterdayUTC, session_type: 'morning', status: 'scheduled', attendance: null },
    ]);
    const res = makeRes();
    await getMySummary(makeReq({ year, month }), res);
    expect(res._body.data[0].attendance_status).toBe('not_checked_in');
    expect(res._body.summary.not_checked_in).toBe(1);
  });

  it('marks a future slot as upcoming even if its session-start time has already passed today', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sessionStartedSettings);
    vi.spyOn(prisma.dutySlot, 'findMany').mockResolvedValue([
      { id: 's1', duty_date: tomorrowUTC, session_type: 'afternoon', status: 'scheduled', attendance: null },
    ]);
    const res = makeRes();
    await getMySummary(makeReq({ year, month }), res);
    expect(res._body.data[0].attendance_status).toBe('upcoming');
    expect(res._body.summary.not_checked_in).toBe(0);
  });

  it("shows today's no-show slot as upcoming before session start, not_checked_in after (no separate cutoff stage)", async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sessionNotStartedSettings);
    vi.spyOn(prisma.dutySlot, 'findMany').mockResolvedValue([
      { id: 's1', duty_date: todayUTC, session_type: 'morning', status: 'scheduled', attendance: null },
    ]);
    const res = makeRes();
    await getMySummary(makeReq({ year, month }), res);
    expect(res._body.data[0].attendance_status).toBe('upcoming');
    expect(res._body.today[0].attendance_status).toBe('upcoming');
  });

  it("flips today's no-show slot straight to not_checked_in as soon as its session starts", async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sessionStartedSettings);
    vi.spyOn(prisma.dutySlot, 'findMany').mockResolvedValue([
      { id: 's1', duty_date: todayUTC, session_type: 'morning', status: 'scheduled', attendance: null },
    ]);
    const res = makeRes();
    await getMySummary(makeReq({ year, month }), res);
    expect(res._body.data[0].attendance_status).toBe('not_checked_in');
    expect(res._body.today[0].attendance_status).toBe('not_checked_in');
  });

  it('counts a checked-in, checked-out, late, auto-out slot correctly and per session', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sessionNotStartedSettings);
    vi.spyOn(prisma.dutySlot, 'findMany').mockResolvedValue([
      {
        id: 's1', duty_date: yesterdayUTC, session_type: 'morning', status: 'completed',
        attendance: { in_time: yesterdayUTC, out_time: yesterdayUTC, in_status: 'late', out_status: 'auto', auto_out: true },
      },
      {
        id: 's2', duty_date: yesterdayUTC, session_type: 'afternoon', status: 'completed',
        attendance: { in_time: yesterdayUTC, out_time: yesterdayUTC, in_status: 'normal', out_status: 'normal', auto_out: false },
      },
    ]);
    const res = makeRes();
    await getMySummary(makeReq({ year, month }), res);

    expect(res._body.summary.checked_in).toBe(2);
    expect(res._body.summary.checked_out).toBe(2);
    expect(res._body.summary.late).toBe(1);
    expect(res._body.summary.auto_out).toBe(1);
    expect(res._body.summary.morning).toEqual(
      expect.objectContaining({ checked_in: 1, checked_out: 1, late: 1, auto_out: 1 }),
    );
    expect(res._body.summary.afternoon).toEqual(
      expect.objectContaining({ checked_in: 1, checked_out: 1, late: 0, auto_out: 0 }),
    );
  });

  it('scopes slots to the requesting faculty as the current owner (faculty_id only)', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(sessionNotStartedSettings);
    const findMany = vi.spyOn(prisma.dutySlot, 'findMany').mockResolvedValue([]);
    const res = makeRes();
    await getMySummary(makeReq({ year, month }), res);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ faculty_id: 'f1' }),
      }),
    );
  });
});

describe('checkIn', () => {
  function makeCheckInReq(dutySlotId = 'slot-1') {
    return { params: { dutySlotId }, user: { id: 'f1', role: 'faculty' } };
  }

  function hm(mins) {
    return { hour: Math.floor(mins / 60), min: mins % 60 };
  }

  // Offsets relative to the real current IST time (same convention as the rest of
  // this suite / cron.test.mjs) so tests are deterministic regardless of when the
  // suite runs — attendance.controller.js destructures `nowInIST` at import time,
  // so spying on lib/time afterwards would not affect its already-bound reference.
  const past90   = Math.max(0, nowMins - 90);
  const past30   = Math.max(0, nowMins - 30);
  const future90 = Math.min(1439, nowMins + 90);

  function cfgFor({ startMins, lateMins, checkoutMins }) {
    const start    = hm(startMins);
    const late     = hm(lateMins);
    const checkout = hm(checkoutMins);
    return {
      session_start_morning_hour:  start.hour,
      session_start_morning_min:   start.min,
      late_threshold_morning_hour: late.hour,
      late_threshold_morning_min:  late.min,
      auto_checkout_morning_hour:  checkout.hour,
      auto_checkout_morning_min:   checkout.min,
    };
  }

  function mockSlot(overrides = {}) {
    vi.spyOn(prisma.dutySlot, 'findUnique').mockResolvedValue({
      id: 'slot-1', faculty_id: 'f1', duty_date: todayUTC, session_type: 'morning', ...overrides,
    });
  }

  afterEach(() => vi.restoreAllMocks());

  it('marks an on-time check-in as normal (now before the late threshold)', async () => {
    mockSlot();
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(
      cfgFor({ startMins: past90, lateMins: future90, checkoutMins: future90 }),
    );
    vi.spyOn(prisma.dutyAttendance, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.dutyAttendance, 'create').mockImplementation(async ({ data }) => ({ id: 'att-1', ...data }));

    const res = makeRes();
    await checkIn(makeCheckInReq(), res);

    expect(res._status).toBe(201);
    expect(res._body.in_status).toBe('normal');
  });

  it('marks a late check-in as late (now past the late threshold)', async () => {
    mockSlot();
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(
      cfgFor({ startMins: past90, lateMins: past30, checkoutMins: future90 }),
    );
    vi.spyOn(prisma.dutyAttendance, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.dutyAttendance, 'create').mockImplementation(async ({ data }) => ({ id: 'att-1', ...data }));

    const res = makeRes();
    await checkIn(makeCheckInReq(), res);

    expect(res._status).toBe(201);
    expect(res._body.in_status).toBe('late');
  });

  it('does not misfire late exactly at the late threshold (strictly-after comparison)', async () => {
    mockSlot();
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(
      // Late threshold pinned to exactly "now" — resolveInStatus compares with a
      // strict `>`, so landing exactly on the threshold must still read 'normal'.
      cfgFor({ startMins: past90, lateMins: nowMins, checkoutMins: future90 }),
    );
    vi.spyOn(prisma.dutyAttendance, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.dutyAttendance, 'create').mockImplementation(async ({ data }) => ({ id: 'att-1', ...data }));

    const res = makeRes();
    await checkIn(makeCheckInReq(), res);

    expect(res._status).toBe(201);
    expect(res._body.in_status).toBe('normal');
  });

  it('rejects a check-in attempted before the session start time', async () => {
    mockSlot();
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(
      cfgFor({ startMins: future90, lateMins: future90, checkoutMins: future90 }),
    );
    const create = vi.spyOn(prisma.dutyAttendance, 'create');

    const res = makeRes();
    await checkIn(makeCheckInReq(), res);

    expect(res._status).toBe(409);
    expect(res._body.code).toBe('BEFORE_SESSION_START');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a check-in attempted after the session window has closed', async () => {
    mockSlot();
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(
      cfgFor({ startMins: past90, lateMins: past90, checkoutMins: past30 }),
    );
    const create = vi.spyOn(prisma.dutyAttendance, 'create');

    const res = makeRes();
    await checkIn(makeCheckInReq(), res);

    expect(res._status).toBe(409);
    expect(res._body.code).toBe('OUTSIDE_SESSION_WINDOW');
    expect(create).not.toHaveBeenCalled();
  });
});
