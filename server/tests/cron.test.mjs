import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

const prisma          = _require('../lib/prisma');
const settingsService = _require('../services/settings.service');
const telegram         = _require('../lib/telegram');
const logger            = _require('../lib/logger');
const { nowInIST }     = _require('../lib/time');
const { autoClockOut, sendDailyDutyDigest, markNoShowAbsent } = _require('../lib/cron');

const ist = nowInIST();
const todayUTC     = new Date(Date.UTC(ist.year, ist.month - 1, ist.day));
const yesterdayUTC = new Date(Date.UTC(ist.year, ist.month - 1, ist.day - 1));

// Cutoffs derived relative to the actual current IST time so "today" groups
// deterministically fall on either side of their session's cutoff no matter
// when this suite runs — clamped to stay within a single day (0–1439 mins).
const nowMins    = ist.hour * 60 + ist.minute;
const pastMins   = Math.max(0, nowMins - 60);
const futureMins = Math.min(1439, nowMins + 60);

const defaultSettings = {
  auto_checkout_morning_hour:   Math.floor(pastMins / 60),
  auto_checkout_morning_min:    pastMins % 60,
  auto_checkout_afternoon_hour: Math.floor(futureMins / 60),
  auto_checkout_afternoon_min:  futureMins % 60,
};

describe('autoClockOut', () => {
  beforeEach(() => {
    vi.spyOn(prisma.dutyAttendance, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.dutyAttendance, 'updateMany').mockResolvedValue({ count: 0 });
    vi.spyOn(prisma.dutySlot,       'updateMany').mockResolvedValue({ count: 0 });
    // markNoShowAbsent (called unconditionally at the end of autoClockOut) queries
    // for open no-show slots — out of scope for this describe block, so default it
    // to "none found" so it short-circuits without touching the DB.
    vi.spyOn(prisma.dutySlot,       'findMany').mockResolvedValue([]);
    vi.spyOn(settingsService,       'getSettings').mockResolvedValue(defaultSettings);
    // Real $transaction validates its array elements are branded Prisma
    // promises, which mocked sub-calls aren't — replace it with a plain
    // Promise.all so the mocked updateMany calls above are actually awaited.
    vi.spyOn(prisma, '$transaction').mockImplementation((ops) => Promise.all(ops));
  });
  afterEach(() => vi.restoreAllMocks());

  it('calls dutyAttendance.updateMany with out_status "auto" and auto_out true for a past-day straggler', async () => {
    prisma.dutyAttendance.findMany.mockResolvedValue([
      { id: 'att-1', duty_slot_id: 'slot-1', dutySlot: { duty_date: yesterdayUTC, session_type: 'morning' } },
      { id: 'att-2', duty_slot_id: 'slot-2', dutySlot: { duty_date: yesterdayUTC, session_type: 'morning' } },
    ]);
    await autoClockOut();
    expect(prisma.dutyAttendance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['att-1', 'att-2'] } },
        data:  expect.objectContaining({ auto_out: true, out_status: 'auto' }),
      }),
    );
  });

  it('updates corresponding duty slots to "completed"', async () => {
    prisma.dutyAttendance.findMany.mockResolvedValue([
      { id: 'att-1', duty_slot_id: 'slot-1', dutySlot: { duty_date: yesterdayUTC, session_type: 'morning' } },
    ]);
    await autoClockOut();
    expect(prisma.dutySlot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['slot-1'] } }, data: { status: 'completed' } }),
    );
  });

  it('returns early without any DB writes when no open attendance records exist', async () => {
    prisma.dutyAttendance.findMany.mockResolvedValue([]);
    await autoClockOut();
    expect(prisma.dutyAttendance.updateMany).not.toHaveBeenCalled();
    expect(prisma.dutySlot.updateMany).not.toHaveBeenCalled();
  });

  it('clocks out a today session whose own cutoff has already passed, but not a today session whose cutoff has not', async () => {
    prisma.dutyAttendance.findMany.mockResolvedValue([
      { id: 'att-morning',   duty_slot_id: 'slot-morning',   dutySlot: { duty_date: todayUTC, session_type: 'morning' } },
      { id: 'att-afternoon', duty_slot_id: 'slot-afternoon', dutySlot: { duty_date: todayUTC, session_type: 'afternoon' } },
    ]);
    await autoClockOut();
    expect(prisma.dutyAttendance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['att-morning'] } } }),
    );
    expect(prisma.dutyAttendance.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['att-afternoon'] } } }),
    );
    expect(prisma.dutyAttendance.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe('sendDailyDutyDigest', () => {
  beforeEach(() => {
    vi.spyOn(prisma.dutySlot, 'findMany').mockResolvedValue([]);
    vi.spyOn(telegram, 'sendMessage').mockResolvedValue();
  });
  afterEach(() => vi.restoreAllMocks());

  it('does nothing when there are no scheduled slots today', async () => {
    await sendDailyDutyDigest();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('skips a faculty with no linked telegram_id', async () => {
    prisma.dutySlot.findMany.mockResolvedValue([
      { session_type: 'morning', duty_date: todayUTC, faculty: { id: 'f1', name: 'A', telegram_id: null } },
    ]);
    await sendDailyDutyDigest();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('sends one message per faculty with today\'s session(s) mentioned', async () => {
    prisma.dutySlot.findMany.mockResolvedValue([
      { session_type: 'morning',   duty_date: todayUTC, faculty: { id: 'f1', name: 'A', telegram_id: 'chat-1' } },
      { session_type: 'afternoon', duty_date: todayUTC, faculty: { id: 'f2', name: 'B', telegram_id: 'chat-2' } },
    ]);
    await sendDailyDutyDigest();
    expect(telegram.sendMessage).toHaveBeenCalledTimes(2);
    expect(telegram.sendMessage).toHaveBeenCalledWith('chat-1', expect.stringContaining('Morning'));
    expect(telegram.sendMessage).toHaveBeenCalledWith('chat-2', expect.stringContaining('Afternoon'));
  });

  it('consolidates both sessions into a single message for a faculty holding both today', async () => {
    prisma.dutySlot.findMany.mockResolvedValue([
      { session_type: 'morning',   duty_date: todayUTC, faculty: { id: 'f1', name: 'A', telegram_id: 'chat-1' } },
      { session_type: 'afternoon', duty_date: todayUTC, faculty: { id: 'f1', name: 'A', telegram_id: 'chat-1' } },
    ]);
    await sendDailyDutyDigest();
    expect(telegram.sendMessage).toHaveBeenCalledTimes(1);
    expect(telegram.sendMessage).toHaveBeenCalledWith('chat-1', expect.stringContaining('Morning & Afternoon'));
  });
});

describe('markNoShowAbsent', () => {
  beforeEach(() => {
    vi.spyOn(prisma.dutySlot,       'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.dutyAttendance, 'create').mockResolvedValue({});
    vi.spyOn(prisma.dutySlot,       'update').mockResolvedValue({});
    // Same rationale as the autoClockOut block: real $transaction validates its
    // array elements are branded Prisma promises, which mocked calls aren't.
    vi.spyOn(prisma, '$transaction').mockImplementation((ops) => Promise.all(ops));
  });
  afterEach(() => vi.restoreAllMocks());

  it('marks a past-date scheduled slot with no attendance as absent', async () => {
    prisma.dutySlot.findMany.mockResolvedValue([
      { id: 'slot-1', duty_date: yesterdayUTC, session_type: 'morning', faculty_id: 'fac-1' },
    ]);
    const count = await markNoShowAbsent(todayUTC, nowMins, ist, defaultSettings);
    expect(count).toBe(1);
    expect(prisma.dutyAttendance.create).toHaveBeenCalledWith({
      data: { duty_slot_id: 'slot-1', faculty_id: 'fac-1', in_status: 'absent' },
    });
    expect(prisma.dutySlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data:  { status: 'absent' },
    });
  });

  it('skips a today slot whose session cutoff has not yet passed', async () => {
    prisma.dutySlot.findMany.mockResolvedValue([
      { id: 'slot-2', duty_date: todayUTC, session_type: 'afternoon', faculty_id: 'fac-2' },
    ]);
    const count = await markNoShowAbsent(todayUTC, nowMins, ist, defaultSettings);
    expect(count).toBe(0);
    expect(prisma.dutyAttendance.create).not.toHaveBeenCalled();
    expect(prisma.dutySlot.update).not.toHaveBeenCalled();
  });

  it('marks a today slot absent once its session cutoff has passed', async () => {
    prisma.dutySlot.findMany.mockResolvedValue([
      { id: 'slot-3', duty_date: todayUTC, session_type: 'morning', faculty_id: 'fac-3' },
    ]);
    const count = await markNoShowAbsent(todayUTC, nowMins, ist, defaultSettings);
    expect(count).toBe(1);
    expect(prisma.dutyAttendance.create).toHaveBeenCalledWith({
      data: { duty_slot_id: 'slot-3', faculty_id: 'fac-3', in_status: 'absent' },
    });
    expect(prisma.dutySlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-3' },
      data:  { status: 'absent' },
    });
  });

  // The where-clause is what actually excludes already-attended slots and
  // non-'scheduled' slots (case 4 and 5 from the request) — that filtering is
  // performed by Prisma/the DB, not by JS in this function, so with prisma
  // mocked the only thing a unit test can verify is that the function *asks*
  // for the right filter. It cannot prove a real DB would honor it.
  it('queries only scheduled slots with no attendance record, up through the given date', async () => {
    await markNoShowAbsent(todayUTC, nowMins, ist, defaultSettings);
    expect(prisma.dutySlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { duty_date: { lte: todayUTC }, status: 'scheduled', attendance: null },
      }),
    );
  });

  it('returns 0 and performs no writes when no open slots are found', async () => {
    prisma.dutySlot.findMany.mockResolvedValue([]);
    const count = await markNoShowAbsent(todayUTC, nowMins, ist, defaultSettings);
    expect(count).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('writes the attendance record and the slot-status update inside a single transaction', async () => {
    prisma.dutySlot.findMany.mockResolvedValue([
      { id: 'slot-1', duty_date: yesterdayUTC, session_type: 'morning', faculty_id: 'fac-1' },
    ]);
    await markNoShowAbsent(todayUTC, nowMins, ist, defaultSettings);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
  });

  it('isolates a failing slot\'s transaction so a later slot in the same batch is still processed, and logs the failure', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    prisma.dutySlot.findMany.mockResolvedValue([
      { id: 'slot-fail',  duty_date: yesterdayUTC, session_type: 'morning', faculty_id: 'fac-1' },
      { id: 'slot-after', duty_date: yesterdayUTC, session_type: 'morning', faculty_id: 'fac-2' },
    ]);
    prisma.$transaction
      .mockImplementationOnce(() => Promise.reject(new Error('DB write failed')))
      .mockImplementationOnce((ops) => Promise.all(ops));

    const count = await markNoShowAbsent(todayUTC, nowMins, ist, defaultSettings);

    // Both slots were attempted — the loop didn't stop after the first failure...
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);

    // ...but only slot-after's transaction actually resolved (i.e. "applied";
    // slot-after's own args were still evaluated eagerly like slot-fail's, so
    // the transaction outcome — not the create()/update() call args — is what
    // distinguishes "attempted" from "committed" here).
    expect(prisma.dutySlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-after' },
      data:  { status: 'absent' },
    });
    expect(count).toBe(1);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('slot-fail'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('DB write failed'));
    expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('slot-after'));
  });
});
