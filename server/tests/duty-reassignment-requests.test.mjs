import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

const prisma = _require('../lib/prisma');
const telegram = _require('../lib/telegram');
const { createRequest, cancelRequest } = _require('../controllers/duty-reassignment-requests.controller');

function makeReq(b = {}, userId = 'f1', params = {}) { return { body: b, user: { id: userId, role: 'faculty' }, params }; }
function makeRes() {
  const r = { _status: 200, _body: null };
  r.status = (c) => { r._status = c; return r; };
  r.json   = (b) => { r._body = b; return r; };
  return r;
}

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const scheduledSlot = {
  id: 'slot-1',
  faculty_id: 'f1',
  duty_date: futureDate,
  session_type: 'morning',
  status: 'scheduled',
  attendance: null,
};
const validBody = { duty_slot_id: 'slot-1', to_faculty_id: 'f2', reason: 'sick' };

describe('createRequest', () => {
  beforeEach(() => {
    vi.spyOn(prisma.dutySlot, 'findUnique').mockResolvedValue(scheduledSlot);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 'f2', role: 'faculty', status: 'active', deleted_at: null });
    vi.spyOn(prisma.dutySlot, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.dutyReassignmentRequest, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.dutyReassignmentRequest, 'create').mockResolvedValue({
      id: 'req-1',
      fromFaculty: { id: 'f1', name: 'A', telegram_id: null },
      toFaculty:   { id: 'f2', name: 'B', telegram_id: null },
      dutySlot:    { duty_date: futureDate, session_type: 'morning' },
    });
    vi.spyOn(telegram, 'sendMessage').mockResolvedValue();
  });
  afterEach(() => vi.restoreAllMocks());

  it('rejects a request targeting yourself with 422 VALIDATION_ERROR, before ever creating a request', async () => {
    const res = makeRes();
    await createRequest(makeReq({ ...validBody, to_faculty_id: 'f1' }, 'f1'), res);

    expect(res._status).toBe(422);
    expect(res._body.code).toBe('VALIDATION_ERROR');
    expect(prisma.dutyReassignmentRequest.create).not.toHaveBeenCalled();
  });

  it('creates the request on the success path when to_faculty_id differs from the requester', async () => {
    const res = makeRes();
    await createRequest(makeReq(validBody, 'f1'), res);

    expect(res._status).toBe(201);
    expect(prisma.dutyReassignmentRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ from_faculty_id: 'f1', to_faculty_id: 'f2' }),
      }),
    );
  });
});

describe('cancelRequest', () => {
  const pendingRequest = {
    id: 'req-1',
    from_faculty_id: 'f1',
    to_faculty_id:   'f2',
    status: 'pending',
    dutySlot:    { duty_date: futureDate, session_type: 'morning' },
    fromFaculty: { id: 'f1', name: 'A' },
    toFaculty:   { id: 'f2', name: 'B', telegram_id: 'chat-2' },
  };

  beforeEach(() => {
    vi.spyOn(prisma.dutyReassignmentRequest, 'findUnique').mockResolvedValue(pendingRequest);
    vi.spyOn(prisma.dutyReassignmentRequest, 'update').mockResolvedValue({ ...pendingRequest, status: 'cancelled' });
    vi.spyOn(telegram, 'sendMessage').mockResolvedValue();
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns 404 when the request does not exist', async () => {
    prisma.dutyReassignmentRequest.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await cancelRequest(makeReq({}, 'f1', { id: 'req-1' }), res);
    expect(res._status).toBe(404);
    expect(res._body.code).toBe('NOT_FOUND');
  });

  it('returns 403 when someone other than the original requester tries to cancel', async () => {
    const res = makeRes();
    await cancelRequest(makeReq({}, 'f2', { id: 'req-1' }), res);
    expect(res._status).toBe(403);
    expect(res._body.code).toBe('FORBIDDEN');
    expect(prisma.dutyReassignmentRequest.update).not.toHaveBeenCalled();
  });

  it('returns 409 when the request is no longer pending', async () => {
    prisma.dutyReassignmentRequest.findUnique.mockResolvedValue({ ...pendingRequest, status: 'approved' });
    const res = makeRes();
    await cancelRequest(makeReq({}, 'f1', { id: 'req-1' }), res);
    expect(res._status).toBe(409);
    expect(res._body.code).toBe('CONFLICT');
    expect(prisma.dutyReassignmentRequest.update).not.toHaveBeenCalled();
  });

  it('cancels a pending request by its original requester and notifies the target faculty', async () => {
    const res = makeRes();
    await cancelRequest(makeReq({}, 'f1', { id: 'req-1' }), res);

    expect(res._status).toBe(200);
    expect(prisma.dutyReassignmentRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1' },
        data: expect.objectContaining({ status: 'cancelled', responded_by_id: 'f1' }),
      }),
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith('chat-2', expect.stringContaining('withdrew'));
  });
});
