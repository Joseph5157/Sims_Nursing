import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

const prisma = _require('../lib/prisma');
const { editViolation } = _require('../controllers/violations.controller');

function makeReq({ params = {}, body = {}, user = {} } = {}) {
  return { params, body, user };
}
function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (c) => { res._status = c; return res; };
  res.json = (b) => { res._body = b; return res; };
  return res;
}

describe('editViolation', () => {
  const ownViolation = {
    id: 'v-1',
    faculty_id: 'f1',
    deleted_at: null,
    is_flagged: false,
    custom_violation: null,
    fine_amount: '100',
    is_warning_only: false,
    remarks: 'original remarks',
    record_status: 'active',
    flag_note: null,
  };

  beforeEach(() => {
    vi.spyOn(prisma.violation, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.violation, 'update').mockResolvedValue(null);
    vi.spyOn(prisma.violationAuditLog, 'create').mockResolvedValue(null);
  });
  afterEach(() => vi.restoreAllMocks());

  it('allows the owning faculty to edit their own unflagged violation', async () => {
    prisma.violation.findUnique.mockResolvedValue(ownViolation);
    prisma.violation.update.mockResolvedValue({ ...ownViolation, remarks: 'updated remarks' });

    const req = makeReq({
      params: { id: ownViolation.id },
      body: { remarks: 'updated remarks' },
      user: { id: 'f1', role: 'faculty' },
    });
    const res = makeRes();
    await editViolation(req, res);

    expect(res._status).toBe(200);
    expect(prisma.violation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ownViolation.id },
        data: expect.objectContaining({ remarks: 'updated remarks' }),
      }),
    );
  });

  it('rejects editing a violation that has already been flagged — 409, no data changes', async () => {
    prisma.violation.findUnique.mockResolvedValue({ ...ownViolation, is_flagged: true });

    const req = makeReq({
      params: { id: ownViolation.id },
      body: { remarks: 'trying to sneak an edit in' },
      user: { id: 'f1', role: 'faculty' },
    });
    const res = makeRes();
    await editViolation(req, res);

    expect(res._status).toBe(409);
    expect(res._body.code).toBe('ALREADY_FLAGGED');
    expect(prisma.violation.update).not.toHaveBeenCalled();
  });

  it("rejects a faculty editing another faculty's violation — 403, no data changes", async () => {
    prisma.violation.findUnique.mockResolvedValue({ ...ownViolation, faculty_id: 'other-faculty' });

    const req = makeReq({
      params: { id: ownViolation.id },
      body: { remarks: 'not mine to edit' },
      user: { id: 'f1', role: 'faculty' },
    });
    const res = makeRes();
    await editViolation(req, res);

    expect(res._status).toBe(403);
    expect(res._body.code).toBe('FORBIDDEN');
    expect(prisma.violation.update).not.toHaveBeenCalled();
  });
});
