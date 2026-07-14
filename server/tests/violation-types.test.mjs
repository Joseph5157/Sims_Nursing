import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

const prisma = _require('../lib/prisma');
const { deleteViolationType } = _require('../controllers/violation-types.controller');

function makeReq({ params = {}, user = {} } = {}) {
  return { params, user };
}
function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (c) => { res._status = c; return res; };
  res.json = (b) => { res._body = b; return res; };
  return res;
}

describe('deleteViolationType', () => {
  const othersType = {
    id: 'vt-others',
    name: 'Others',
    is_system: true,
    is_active: true,
  };

  const customType = {
    id: 'vt-custom',
    name: 'Late to duty',
    is_system: false,
    is_active: true,
  };

  beforeEach(() => {
    vi.spyOn(prisma.violationType, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.violation, 'count').mockResolvedValue(0);
    vi.spyOn(prisma.violationType, 'delete').mockResolvedValue(null);
  });
  afterEach(() => vi.restoreAllMocks());

  it("refuses to delete the system 'Others' type — 403, no delete issued", async () => {
    prisma.violationType.findUnique.mockResolvedValue(othersType);

    const req = makeReq({ params: { id: othersType.id }, user: { id: 'admin-1', role: 'admin' } });
    const res = makeRes();
    await deleteViolationType(req, res);

    expect(res._status).toBe(403);
    expect(res._body.code).toBe('FORBIDDEN');
    expect(prisma.violationType.delete).not.toHaveBeenCalled();
  });

  it('deletes a non-system, unused type', async () => {
    prisma.violationType.findUnique.mockResolvedValue(customType);
    prisma.violation.count.mockResolvedValue(0);

    const req = makeReq({ params: { id: customType.id }, user: { id: 'admin-1', role: 'admin' } });
    const res = makeRes();
    await deleteViolationType(req, res);

    expect(res._status).toBe(200);
    expect(prisma.violationType.delete).toHaveBeenCalledWith({ where: { id: customType.id } });
  });

  it('refuses to delete a non-system type still referenced by violation records — 409, no delete issued', async () => {
    prisma.violationType.findUnique.mockResolvedValue(customType);
    prisma.violation.count.mockResolvedValue(3);

    const req = makeReq({ params: { id: customType.id }, user: { id: 'admin-1', role: 'admin' } });
    const res = makeRes();
    await deleteViolationType(req, res);

    expect(res._status).toBe(409);
    expect(res._body.code).toBe('TYPE_IN_USE');
    expect(prisma.violationType.delete).not.toHaveBeenCalled();
  });
});
