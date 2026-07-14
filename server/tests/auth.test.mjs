// Load via createRequire so test and controllers share the same Node CJS cache.
// vi.spyOn on the shared prisma object then intercepts controller calls too.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _require   = createRequire(import.meta.url);

const prisma   = _require('../lib/prisma');
const bcrypt   = _require('bcryptjs');
const jwt      = _require('jsonwebtoken');
const { login, changePassword } = _require('../controllers/auth.controller');
const audit    = _require('../services/audit.service');

function makeReq(body = {}) { return { body, cookies: {}, headers: {} }; }
function makeRes() {
  const res = { _status: 200, _body: null, _cookies: {} };
  res.status = (c) => { res._status = c; return res; };
  res.json = (b) => { res._body = b; return res; };
  res.cookie = (n, v) => { res._cookies[n] = v; return res; };
  res.clearCookie = (n) => { delete res._cookies[n]; return res; };
  return res;
}

describe('login', () => {
  const userWithPassword = {
    id: 'user-1',
    email: 'faculty@sims.edu',
    password_hash: '$2b$12$somehash',
    status: 'active',
    deleted_at: null,
    session_version: 1,
    must_change_password: false,
    name: 'Dr. Test',
    role: 'faculty',
    department: 'Pharmacy',
    designation: 'AP',
    phone: null,
    telegram_verified: true,
    approved_at: new Date(),
    created_at: new Date(),
  };

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(false);
    vi.spyOn(jwt, 'sign').mockReturnValue('test-jwt-token');
    vi.spyOn(audit, 'logAction').mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns 200 and sets cookies on successful login with correct password', async () => {
    prisma.user.findUnique.mockResolvedValue(userWithPassword);
    bcrypt.compare.mockResolvedValue(true);
    const res = makeRes();
    await login(makeReq({ email: userWithPassword.email, password: 'password123' }), res);
    expect(res._status).toBe(200);
    expect(res._cookies['sims_token']).toBe('test-jwt-token');
    expect(typeof res._cookies['sims_csrf']).toBe('string');
    expect(res._cookies['sims_csrf'].length).toBeGreaterThan(0);
    expect(res._body.id).toBe(userWithPassword.id);
    expect(res._body.email).toBe(userWithPassword.email);
    expect(res._body.must_change_password).toBe(false);
  });

  it('returns 401 INVALID_CREDENTIALS on incorrect password', async () => {
    prisma.user.findUnique.mockResolvedValue(userWithPassword);
    bcrypt.compare.mockResolvedValue(false);
    const res = makeRes();
    await login(makeReq({ email: userWithPassword.email, password: 'wrongpassword' }), res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 INVALID_CREDENTIALS for unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await login(makeReq({ email: 'nobody@sims.edu', password: 'password123' }), res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 INVALID_CREDENTIALS for user with null password_hash', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...userWithPassword, password_hash: null });
    const res = makeRes();
    await login(makeReq({ email: userWithPassword.email, password: 'password123' }), res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 INVALID_CREDENTIALS for deleted user', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...userWithPassword, deleted_at: new Date() });
    const res = makeRes();
    await login(makeReq({ email: userWithPassword.email, password: 'password123' }), res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 INVALID_CREDENTIALS for inactive user', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...userWithPassword, status: 'inactive' });
    const res = makeRes();
    await login(makeReq({ email: userWithPassword.email, password: 'password123' }), res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('INVALID_CREDENTIALS');
  });

  it('calls audit.logAction with PASSWORD_LOGIN action on success', async () => {
    prisma.user.findUnique.mockResolvedValue(userWithPassword);
    bcrypt.compare.mockResolvedValue(true);
    const res = makeRes();
    await login(makeReq({ email: userWithPassword.email, password: 'password123' }), res);
    expect(audit.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: userWithPassword.id,
        action: 'PASSWORD_LOGIN',
        targetId: userWithPassword.id,
        targetType: 'user',
        metadata: expect.objectContaining({ email: userWithPassword.email }),
      }),
    );
  });
});

describe('changePassword', () => {
  const userWithPassword = {
    id: 'user-1',
    email: 'faculty@sims.edu',
    password_hash: '$2b$12$somehash',
    status: 'active',
    deleted_at: null,
    must_change_password: true,
  };

  const userWithoutPassword = {
    id: 'user-1',
    email: 'faculty@sims.edu',
    password_hash: null,
    status: 'active',
    deleted_at: null,
    must_change_password: true,
  };

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(userWithPassword);
    vi.spyOn(prisma.user, 'update').mockResolvedValue({});
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(false);
    vi.spyOn(bcrypt, 'hash').mockResolvedValue('$2b$12$newhash');
    vi.spyOn(audit, 'logAction').mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('successfully changes password when password_hash exists and current_password is correct', async () => {
    prisma.user.findUnique.mockResolvedValue(userWithPassword);
    prisma.user.update.mockResolvedValue({ ...userWithPassword, must_change_password: false, session_version: 2, role: 'faculty' });
    bcrypt.compare.mockResolvedValue(true);
    const req = makeReq({ current_password: 'oldpassword', new_password: 'newpassword123' });
    req.user = { id: userWithPassword.id, role: 'faculty' };
    const res = makeRes();
    await changePassword(req, res);
    expect(res._status).toBe(200);
    // Response is the safeUser shape (spec 017) — no message field, never password_hash
    expect(res._body.id).toBe(userWithPassword.id);
    expect(res._body.must_change_password).toBe(false);
    expect(res._body.password_hash).toBeUndefined();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userWithPassword.id },
        data: expect.objectContaining({
          password_hash: '$2b$12$newhash',
          must_change_password: false,
        }),
      }),
    );
  });

  it('successfully changes password when password_hash is null (first-time set)', async () => {
    prisma.user.findUnique.mockResolvedValue(userWithoutPassword);
    prisma.user.update.mockResolvedValue({ ...userWithoutPassword, must_change_password: false, session_version: 2, role: 'faculty' });
    const req = makeReq({ current_password: '', new_password: 'newpassword123' });
    req.user = { id: userWithoutPassword.id, role: 'faculty' };
    const res = makeRes();
    await changePassword(req, res);
    expect(res._status).toBe(200);
    expect(res._body.id).toBe(userWithoutPassword.id);
    expect(res._body.must_change_password).toBe(false);
    expect(res._body.password_hash).toBeUndefined();
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userWithoutPassword.id },
        data: expect.objectContaining({
          password_hash: '$2b$12$newhash',
          must_change_password: false,
        }),
      }),
    );
  });

  it('returns 401 INVALID_CURRENT_PASSWORD when current password is incorrect', async () => {
    prisma.user.findUnique.mockResolvedValue(userWithPassword);
    bcrypt.compare.mockResolvedValue(false);
    const req = makeReq({ current_password: 'wrongpassword', new_password: 'newpassword123' });
    req.user = { id: userWithPassword.id, role: 'faculty' };
    const res = makeRes();
    await changePassword(req, res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('INVALID_CURRENT_PASSWORD');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('returns 401 INVALID_USER for a deleted user', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...userWithPassword, deleted_at: new Date() });
    const req = makeReq({ current_password: 'oldpassword', new_password: 'newpassword123' });
    req.user = { id: userWithPassword.id, role: 'faculty' };
    const res = makeRes();
    await changePassword(req, res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('INVALID_USER');
  });

  it('returns 401 INVALID_USER when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const req = makeReq({ current_password: 'oldpassword', new_password: 'newpassword123' });
    req.user = { sub: 'nonexistent-user' };
    const res = makeRes();
    await changePassword(req, res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('INVALID_USER');
  });

  it('calls audit.logAction with PASSWORD_CHANGED action on success', async () => {
    prisma.user.findUnique.mockResolvedValue(userWithPassword);
    bcrypt.compare.mockResolvedValue(true);
    const req = makeReq({ current_password: 'oldpassword', new_password: 'newpassword123' });
    req.user = { id: userWithPassword.id, role: 'faculty' };
    const res = makeRes();
    await changePassword(req, res);
    expect(audit.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: userWithPassword.id,
        action: 'PASSWORD_CHANGED',
        targetId: userWithPassword.id,
        targetType: 'user',
        metadata: expect.objectContaining({ changed_by: 'self' }),
      }),
    );
  });

  it('uses req.user.id (from authenticate middleware) not req.user.sub', async () => {
    // Verify the fix for issue where changePassword was using req.user.sub instead of req.user.id
    // This test documents the correct shape: authenticate middleware sets { id, role }, not { sub, role }
    prisma.user.findUnique.mockResolvedValue(userWithPassword);
    bcrypt.compare.mockResolvedValue(true);
    const req = makeReq({ current_password: 'oldpassword', new_password: 'newpassword123' });
    req.user = { id: userWithPassword.id, role: 'faculty' }; // Shape set by authenticate middleware
    const res = makeRes();
    await changePassword(req, res);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: userWithPassword.id }, // Must use req.user.id
    });
  });
});
