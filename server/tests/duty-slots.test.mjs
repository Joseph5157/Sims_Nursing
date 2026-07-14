import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

const prisma     = _require('../lib/prisma');
const { pickSlot, getMonthSlots } = _require('../controllers/duty-slots.controller');

function makeReq(b = {}) { return { body: b, user: { id: 'f1', role: 'faculty' }, params: {} }; }
function makeRes() {
  const r = { _status: 200, _body: null };
  r.status = (c) => { r._status = c; return r; };
  r.json   = (b) => { r._body = b; return r; };
  return r;
}

const openConfig = { is_window_open: true, working_days: ['2026-06-10'], sessions_per_faculty: 3 };
const validBody  = { duty_date: '2026-06-10', session_type: 'morning' };

describe('pickSlot', () => {
  beforeEach(() => {
    vi.spyOn(prisma.calendarConfig, 'findUnique').mockResolvedValue(openConfig);
    vi.spyOn(prisma, '$transaction');
  });
  afterEach(() => vi.restoreAllMocks());

  function tx({ count = 0, createResult = null, createError = null }) {
    prisma.$transaction.mockImplementationOnce(async (fn) => fn({
      dutySlot: {
        count:  vi.fn().mockResolvedValue(count),
        create: createError ? vi.fn().mockRejectedValue(createError) : vi.fn().mockResolvedValue(createResult),
      },
    }));
  }

  it('returns 409 WINDOW_CLOSED when no calendar config exists', async () => {
    prisma.calendarConfig.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await pickSlot(makeReq(validBody), res);
    expect(res._status).toBe(409);
    expect(res._body.code).toBe('WINDOW_CLOSED');
  });

  it('returns 409 WINDOW_CLOSED when the window is not open', async () => {
    prisma.calendarConfig.findUnique.mockResolvedValue({ ...openConfig, is_window_open: false });
    const res = makeRes();
    await pickSlot(makeReq(validBody), res);
    expect(res._status).toBe(409);
    expect(res._body.code).toBe('WINDOW_CLOSED');
  });

  it('returns 409 LIMIT_REACHED when faculty already has the maximum slots', async () => {
    tx({ count: 3 });
    const res = makeRes();
    await pickSlot(makeReq(validBody), res);
    expect(res._status).toBe(409);
    expect(res._body.code).toBe('LIMIT_REACHED');
  });

  it('returns 409 SLOT_TAKEN when Prisma raises a P2002 unique constraint error', async () => {
    tx({ count: 0, createError: Object.assign(new Error('unique'), { code: 'P2002' }) });
    const res = makeRes();
    await pickSlot(makeReq(validBody), res);
    expect(res._status).toBe(409);
    expect(res._body.code).toBe('SLOT_TAKEN');
  });

  it('returns 201 with the created slot on the success path', async () => {
    const slot = { id: 's1', faculty_id: 'f1', duty_date: new Date('2026-06-10'), session_type: 'morning', status: 'scheduled' };
    tx({ count: 0, createResult: slot });
    const res = makeRes();
    await pickSlot(makeReq(validBody), res);
    expect(res._status).toBe(201);
    expect(res._body).toEqual(slot);
  });
});

describe('getMonthSlots', () => {
  afterEach(() => vi.restoreAllMocks());

  it('scopes a faculty member to the slots they currently own (faculty_id only)', async () => {
    const ownSlot = {
      id: 's1', faculty_id: 'f1',
      duty_date: new Date('2026-06-10'), session_type: 'morning', status: 'scheduled',
    };
    const findMany = vi.spyOn(prisma.dutySlot, 'findMany').mockResolvedValue([ownSlot]);

    const req = { params: { year: '2026', month: '6' }, user: { id: 'f1', role: 'faculty' } };
    const res = makeRes();
    await getMonthSlots(req, res);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ faculty_id: 'f1' }),
    }));
    expect(res._body.data).toEqual([ownSlot]);
    expect(res._body.total).toBe(1);
  });

  it('selects attendance.in_time/out_time so the frontend can tell which slot is actively checked in', async () => {
    const findMany = vi.spyOn(prisma.dutySlot, 'findMany').mockResolvedValue([]);

    const req = { params: { year: '2026', month: '6' }, user: { id: 'f1', role: 'faculty' } };
    const res = makeRes();
    await getMonthSlots(req, res);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        attendance: { select: { in_time: true, out_time: true } },
      }),
    }));
  });
});
