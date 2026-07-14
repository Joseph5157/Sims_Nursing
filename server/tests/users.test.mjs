// Load via createRequire so test and controllers share the same Node CJS cache.
// vi.spyOn on the shared prisma object then intercepts controller calls too.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _require   = createRequire(import.meta.url);

const prisma = _require('../lib/prisma');
const logger = _require('../lib/logger');
const { updateProfile } = _require('../controllers/users.controller');

function makeReq({ params = {}, body = {}, user = {} } = {}) {
  return { params, body, user, cookies: {}, headers: {} };
}
function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (c) => { res._status = c; return res; };
  res.json = (b) => { res._body = b; return res; };
  return res;
}

describe('updateProfile', () => {
  const selfUser = {
    id: 'user-1',
    email: 'faculty@sims.edu',
    role: 'faculty',
    name: 'Dr. Test',
    department: 'Pharmacy',
    designation: 'AP',
    title: 'Dr.',
    avatar: null,
    deleted_at: null,
  };

  const otherUser = {
    id: 'user-2',
    email: 'other@sims.edu',
    role: 'faculty',
    name: 'Dr. Other',
    department: 'Chemistry',
    designation: 'AP',
    title: null,
    avatar: null,
    deleted_at: null,
  };

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.user, 'update').mockResolvedValue(null);
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('allows a user to PATCH their own profile — 200, data persists', async () => {
    prisma.user.findUnique.mockResolvedValue(selfUser);
    const updated = { ...selfUser, name: 'Dr. Updated' };
    prisma.user.update.mockResolvedValue(updated);

    const req = makeReq({
      params: { id: selfUser.id },
      body: { name: 'Dr. Updated' },
      user: { id: selfUser.id, role: selfUser.role },
    });
    const res = makeRes();
    await updateProfile(req, res);

    expect(res._status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: selfUser.id },
      data: { name: 'Dr. Updated' },
    });
    expect(res._body.name).toBe('Dr. Updated');
  });

  it.each(['faculty', 'admin', 'super_admin'])(
    "rejects a %s PATCHing a different user's profile — 403, no data changes",
    async (role) => {
      prisma.user.findUnique.mockResolvedValue(otherUser);

      const req = makeReq({
        params: { id: otherUser.id },
        body: { name: 'Hacked Name' },
        user: { id: 'user-1', role },
      });
      const res = makeRes();
      await updateProfile(req, res);

      expect(res._status).toBe(403);
      expect(res._body.code).toBe('FORBIDDEN');
      expect(prisma.user.update).not.toHaveBeenCalled();
    },
  );
});
