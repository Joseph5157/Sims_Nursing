import { createRequire } from 'module';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const _require = createRequire(import.meta.url);
const prisma = _require('../lib/prisma');
const { createInvite, listInvites, regenerateInvite, cancelInvite } =
  _require('../controllers/invites.controller');
const { logAction } = _require('../services/audit.service');

// ── Fixtures ────────────────────────────────────────────────────────────────

const adminActor = { id: 'admin-1', role: 'admin' };
const superAdminActor = { id: 'sa-1', role: 'super_admin' };

function makeReq(body = {}, params = {}, user = adminActor) {
  return { body, params, user };
}

function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (c) => { res._status = c; return res; };
  res.json = (b) => { res._body = b; return res; };
  return res;
}

const validBody = {
  name: 'Dr. Test',
  email: 'test@sims.edu',
  role: 'faculty',
  phone: null,
  department: 'Pharma',
  designation: 'AP',
};

const existingInvite = {
  id: 'inv-1',
  ...validBody,
  invite_token: 'abc123def456',
  invite_expires_at: new Date(Date.now() + 86400000),
  invited_by: 'admin-1',
  created_at: new Date(),
  updated_at: new Date(),
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('createInvite', () => {
  beforeEach(() => {
    vi.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.pendingInvite, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.pendingInvite, 'create').mockResolvedValue(existingInvite);
    vi.spyOn(prisma.adminAuditLog, 'create').mockResolvedValue({});
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns 409 EMAIL_TAKEN when active user exists', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u-1' });
    const res = makeRes();
    await createInvite(makeReq(validBody), res);
    expect(res._status).toBe(409);
    expect(res._body.code).toBe('EMAIL_TAKEN');
  });

  it('returns 409 EMAIL_TAKEN when pending invite exists', async () => {
    prisma.pendingInvite.findUnique.mockResolvedValue(existingInvite);
    const res = makeRes();
    await createInvite(makeReq(validBody), res);
    expect(res._status).toBe(409);
    expect(res._body.code).toBe('EMAIL_TAKEN');
  });

  it('returns 403 FORBIDDEN when admin tries to invite admin role', async () => {
    const res = makeRes();
    await createInvite(makeReq({ ...validBody, role: 'admin' }, {}, adminActor), res);
    expect(res._status).toBe(403);
    expect(res._body.code).toBe('FORBIDDEN');
  });

  it('returns 201 with invite_link on success', async () => {
    const res = makeRes();
    await createInvite(makeReq(validBody), res);
    expect(res._status).toBe(201);
    expect(res._body.invite_link).toMatch(/\?start=invite_/);
    expect(res._body.invite).not.toHaveProperty('invite_token');
  });

  it('super_admin can invite admin role', async () => {
    const res = makeRes();
    await createInvite(makeReq({ ...validBody, role: 'admin' }, {}, superAdminActor), res);
    expect(res._status).toBe(201);
    expect(res._body.invite_link).toBeDefined();
  });
});

describe('listInvites', () => {
  beforeEach(() => {
    vi.spyOn(prisma.pendingInvite, 'findMany').mockResolvedValue([existingInvite]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('does not expose invite_token in response', async () => {
    const res = makeRes();
    await listInvites(makeReq(), res);
    expect(res._body.data[0]).not.toHaveProperty('invite_token');
    expect(res._body.data[0]).toHaveProperty('invite_expires_at');
  });
});

describe('regenerateInvite', () => {
  beforeEach(() => {
    vi.spyOn(prisma.pendingInvite, 'findUnique').mockResolvedValue(existingInvite);
    vi.spyOn(prisma.pendingInvite, 'update').mockResolvedValue(existingInvite);
    vi.spyOn(prisma.adminAuditLog, 'create').mockResolvedValue({});
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns 404 if invite not found', async () => {
    prisma.pendingInvite.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await regenerateInvite(makeReq({}, { id: 'missing' }), res);
    expect(res._status).toBe(404);
  });

  it('returns 403 if admin tries to regenerate admin invite', async () => {
    prisma.pendingInvite.findUnique.mockResolvedValue({ ...existingInvite, role: 'admin' });
    const res = makeRes();
    await regenerateInvite(makeReq({}, { id: 'inv-1' }, adminActor), res);
    expect(res._status).toBe(403);
  });

  it('returns new invite_link on success', async () => {
    const res = makeRes();
    await regenerateInvite(makeReq({}, { id: 'inv-1' }), res);
    expect(res._status).toBe(200);
    expect(res._body.invite_link).toMatch(/\?start=invite_/);
  });
});

describe('cancelInvite', () => {
  beforeEach(() => {
    vi.spyOn(prisma.pendingInvite, 'findUnique').mockResolvedValue(existingInvite);
    vi.spyOn(prisma.pendingInvite, 'delete').mockResolvedValue(existingInvite);
    vi.spyOn(prisma.adminAuditLog, 'create').mockResolvedValue({});
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns 404 if invite not found', async () => {
    prisma.pendingInvite.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await cancelInvite(makeReq({}, { id: 'missing' }), res);
    expect(res._status).toBe(404);
  });

  it('deletes invite and returns success', async () => {
    const res = makeRes();
    await cancelInvite(makeReq({}, { id: 'inv-1' }), res);
    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(prisma.pendingInvite.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
  });

  it('returns 403 if admin tries to cancel admin invite', async () => {
    prisma.pendingInvite.findUnique.mockResolvedValue({ ...existingInvite, role: 'admin' });
    const res = makeRes();
    await cancelInvite(makeReq({}, { id: 'inv-1' }, adminActor), res);
    expect(res._status).toBe(403);
  });
});
