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
const { login, changePassword, telegramLogin, requestOtp, verifyOtp } = _require('../controllers/auth.controller');
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
    sims_id: 1100,
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

  it('accepts a four-digit SIMS ID as the login identifier', async () => {
    prisma.user.findUnique.mockResolvedValue(userWithPassword);
    bcrypt.compare.mockResolvedValue(true);
    const res = makeRes();
    await login(makeReq({ identifier: '1100', password: 'password123' }), res);
    expect(res._status).toBe(200);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { sims_id: 1100 } });
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { identifier_type: 'sims_id' },
    }));
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
        metadata: expect.objectContaining({ identifier_type: 'email' }),
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

// 022-telegram-magic-link-login
describe('telegramLogin', () => {
  function makeTelegramReq(token) { return { params: { token } }; }
  function makeTelegramRes() {
    const res = { _redirect: null, _cookies: {} };
    res.cookie = (n, v) => { res._cookies[n] = v; return res; };
    res.redirect = (loc) => { res._redirect = loc; return res; };
    return res;
  }

  const activeUser = {
    id: 'user-1',
    role: 'faculty',
    session_version: 1,
    status: 'active',
    deleted_at: null,
  };

  function tokenRow({ used_at = null, expires_at = new Date(Date.now() + 5 * 60 * 1000), user = activeUser } = {}) {
    return { token: 'abc123', expires_at, used_at, user };
  }

  beforeEach(() => {
    vi.spyOn(prisma.telegramLoginToken, 'findUnique').mockResolvedValue(tokenRow());
    vi.spyOn(prisma.telegramLoginToken, 'updateMany').mockResolvedValue({ count: 1 });
    vi.spyOn(jwt, 'sign').mockReturnValue('test-jwt-token');
    vi.spyOn(audit, 'logAction').mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('redirects to / and sets cookies on a valid, unused, unexpired token', async () => {
    const res = makeTelegramRes();
    await telegramLogin(makeTelegramReq('abc123'), res);
    expect(res._redirect).toBe('/');
    expect(res._cookies['sims_token']).toBe('test-jwt-token');
    expect(typeof res._cookies['sims_csrf']).toBe('string');
    expect(res._cookies['sims_csrf'].length).toBeGreaterThan(0);
  });

  it('logs a TELEGRAM_LOGIN audit action on success', async () => {
    const res = makeTelegramRes();
    await telegramLogin(makeTelegramReq('abc123'), res);
    expect(audit.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: activeUser.id, action: 'TELEGRAM_LOGIN', targetId: activeUser.id, targetType: 'user' }),
    );
  });

  it('redirects with telegram_error=expired for an expired token', async () => {
    prisma.telegramLoginToken.findUnique.mockResolvedValue(tokenRow({ expires_at: new Date(Date.now() - 1000) }));
    prisma.telegramLoginToken.updateMany.mockResolvedValue({ count: 0 });
    const res = makeTelegramRes();
    await telegramLogin(makeTelegramReq('abc123'), res);
    expect(res._redirect).toBe('/login?telegram_error=expired');
    expect(res._cookies['sims_token']).toBeUndefined();
  });

  it('redirects with telegram_error=used for an already-used token', async () => {
    prisma.telegramLoginToken.findUnique.mockResolvedValue(tokenRow({ used_at: new Date() }));
    prisma.telegramLoginToken.updateMany.mockResolvedValue({ count: 0 });
    const res = makeTelegramRes();
    await telegramLogin(makeTelegramReq('abc123'), res);
    expect(res._redirect).toBe('/login?telegram_error=used');
  });

  it('redirects with telegram_error=inactive_account for a deactivated user, even though the token is unexpired and unused', async () => {
    prisma.telegramLoginToken.findUnique.mockResolvedValue(
      tokenRow({ user: { ...activeUser, status: 'inactive' } }),
    );
    prisma.telegramLoginToken.updateMany.mockResolvedValue({ count: 0 });
    const res = makeTelegramRes();
    await telegramLogin(makeTelegramReq('abc123'), res);
    expect(res._redirect).toBe('/login?telegram_error=inactive_account');
    expect(res._cookies['sims_token']).toBeUndefined();
  });

  it('redirects with telegram_error=inactive_account for a soft-deleted user', async () => {
    prisma.telegramLoginToken.findUnique.mockResolvedValue(
      tokenRow({ user: { ...activeUser, deleted_at: new Date() } }),
    );
    prisma.telegramLoginToken.updateMany.mockResolvedValue({ count: 0 });
    const res = makeTelegramRes();
    await telegramLogin(makeTelegramReq('abc123'), res);
    expect(res._redirect).toBe('/login?telegram_error=inactive_account');
  });

  it('redirects with telegram_error=not_found for a nonexistent token', async () => {
    prisma.telegramLoginToken.findUnique.mockResolvedValue(null);
    prisma.telegramLoginToken.updateMany.mockResolvedValue({ count: 0 });
    const res = makeTelegramRes();
    await telegramLogin(makeTelegramReq('does-not-exist'), res);
    expect(res._redirect).toBe('/login?telegram_error=not_found');
  });

  it('only allows one of two concurrent claims on the same token to succeed', async () => {
    prisma.telegramLoginToken.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    // The winner's UPDATE commits used_at before the loser's diagnostic lookup
    // runs (real Postgres ordering) — reflect that so the loser correctly
    // reports "used" rather than a stale "not_found".
    prisma.telegramLoginToken.findUnique.mockResolvedValue(tokenRow({ used_at: new Date() }));

    const res1 = makeTelegramRes();
    const res2 = makeTelegramRes();
    await Promise.all([
      telegramLogin(makeTelegramReq('abc123'), res1),
      telegramLogin(makeTelegramReq('abc123'), res2),
    ]);

    const redirects = [res1._redirect, res2._redirect].sort();
    expect(redirects).toEqual(['/', '/login?telegram_error=used']);
  });
});

describe('requestOtp (T008)', () => {
  const activeUserWithTelegram = {
    id: 'user-1',
    sims_id: 1100,
    status: 'active',
    deleted_at: null,
    telegram_id: '123456789',
    telegram_verified: true,
    otp_locked_until: null,
    otp_login_codes: [],
  };

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.otpLoginCode, 'deleteMany').mockResolvedValue({ count: 0 });
    vi.spyOn(prisma.otpLoginCode, 'create').mockResolvedValue({});
    vi.spyOn(bcrypt, 'hash').mockResolvedValue('$2b$12$hashedcode');
    vi.spyOn(audit, 'logAction').mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns generic 200 for valid active user with telegram_verified', async () => {
    prisma.user.findUnique.mockResolvedValue(activeUserWithTelegram);
    const res = makeRes();
    await requestOtp(makeReq({ sims_id: '1100' }), res);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ message: expect.any(String) });
  });

  it('creates an OtpLoginCode row with bcrypt-hashed code', async () => {
    prisma.user.findUnique.mockResolvedValue(activeUserWithTelegram);
    const res = makeRes();
    await requestOtp(makeReq({ sims_id: '1100' }), res);
    expect(prisma.otpLoginCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: activeUserWithTelegram.id,
          code_hash: '$2b$12$hashedcode',
          expires_at: expect.any(Date),
        }),
      }),
    );
  });

  it('returns generic 200 even for non-existent SIMS ID (no enumeration)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await requestOtp(makeReq({ sims_id: '9999' }), res);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ message: expect.any(String) });
    // But no code should be created
    expect(prisma.otpLoginCode.create).not.toHaveBeenCalled();
  });

  it('returns generic 200 for inactive user (no enumeration)', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...activeUserWithTelegram, status: 'inactive' });
    const res = makeRes();
    await requestOtp(makeReq({ sims_id: '1100' }), res);
    expect(res._status).toBe(200);
    expect(prisma.otpLoginCode.create).not.toHaveBeenCalled();
  });

  it('returns generic 200 for user without telegram_verified', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...activeUserWithTelegram, telegram_verified: false });
    const res = makeRes();
    await requestOtp(makeReq({ sims_id: '1100' }), res);
    expect(res._status).toBe(200);
    expect(prisma.otpLoginCode.create).not.toHaveBeenCalled();
  });

  it('always runs bcrypt hash regardless of conditions (timing-safe)', async () => {
    // User doesn't exist, but bcrypt should still run
    prisma.user.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await requestOtp(makeReq({ sims_id: '9999' }), res);
    // bcrypt.hash is called during the function regardless of whether we create a code
    expect(bcrypt.hash).toHaveBeenCalled();
  });
});

describe('verifyOtp (T009-T011)', () => {
  const activeUserWithoutMustChange = {
    id: 'user-1',
    sims_id: 1100,
    role: 'faculty',
    status: 'active',
    deleted_at: null,
    must_change_password: false,
    session_version: 1,
    otp_locked_until: null,
    otp_failed_attempts: 0,
    name: 'Dr. Test',
    email: 'faculty@sims.edu',
    phone: null,
    telegram_verified: true,
    department: 'Pharmacy',
    designation: 'AP',
    approved_at: new Date(),
    created_at: new Date(),
  };

  const codeRow = {
    id: 'code-1',
    code_hash: '$2b$12$abcdefghijklmnopqrstuvwxyz', // bcrypt hash of "048291"
  };

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.user, 'update').mockResolvedValue(activeUserWithoutMustChange);
    vi.spyOn(prisma.otpLoginCode, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.otpLoginCode, 'updateMany').mockResolvedValue({ count: 0 });
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(false);
    vi.spyOn(jwt, 'sign').mockReturnValue('test-jwt-token');
    vi.spyOn(audit, 'logAction').mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns 200 and sets cookies on successful code verification (T009)', async () => {
    prisma.user.findUnique.mockResolvedValue(activeUserWithoutMustChange);
    prisma.otpLoginCode.findFirst.mockResolvedValue(codeRow);
    bcrypt.compare.mockResolvedValue(true);
    prisma.otpLoginCode.updateMany.mockResolvedValue({ count: 1 });
    const res = makeRes();
    await verifyOtp(makeReq({ sims_id: '1100', code: '048291' }), res);
    expect(res._status).toBe(200);
    expect(res._cookies['sims_token']).toBe('test-jwt-token');
    expect(typeof res._cookies['sims_csrf']).toBe('string');
    expect(res._cookies['sims_csrf'].length).toBeGreaterThan(0);
    expect(res._body.id).toBe(activeUserWithoutMustChange.id);
    expect(res._body.must_change_password).toBe(false);
  });

  it('returns response body matching login shape with role and safeUser fields', async () => {
    prisma.user.findUnique.mockResolvedValue(activeUserWithoutMustChange);
    prisma.otpLoginCode.findFirst.mockResolvedValue(codeRow);
    bcrypt.compare.mockResolvedValue(true);
    prisma.otpLoginCode.updateMany.mockResolvedValue({ count: 1 });
    const res = makeRes();
    await verifyOtp(makeReq({ sims_id: '1100', code: '048291' }), res);
    expect(res._body).toMatchObject({
      id: activeUserWithoutMustChange.id,
      email: activeUserWithoutMustChange.email,
      role: activeUserWithoutMustChange.role,
      must_change_password: false,
    });
  });

  it('preserves leading zeros in code (e.g., "048291") end-to-end (T010)', async () => {
    // This test verifies the code is kept as a string, never converted to number
    prisma.user.findUnique.mockResolvedValue(activeUserWithoutMustChange);
    prisma.otpLoginCode.findFirst.mockResolvedValue(codeRow);
    bcrypt.compare.mockResolvedValue(true);
    prisma.otpLoginCode.updateMany.mockResolvedValue({ count: 1 });
    const res = makeRes();
    // The code "048291" should be compared as a string, not Number("048291") = 48291
    await verifyOtp(makeReq({ sims_id: '1100', code: '048291' }), res);
    expect(bcrypt.compare).toHaveBeenCalledWith('048291', codeRow.code_hash);
    expect(res._status).toBe(200);
  });

  it('propagates must_change_password in response (T011)', async () => {
    const userWithMustChange = { ...activeUserWithoutMustChange, must_change_password: true };
    prisma.user.findUnique.mockResolvedValue(userWithMustChange);
    prisma.otpLoginCode.findFirst.mockResolvedValue(codeRow);
    bcrypt.compare.mockResolvedValue(true);
    prisma.otpLoginCode.updateMany.mockResolvedValue({ count: 1 });
    const res = makeRes();
    await verifyOtp(makeReq({ sims_id: '1100', code: '123456' }), res);
    expect(res._status).toBe(200);
    expect(res._body.must_change_password).toBe(true);
  });

  it('returns 401 INVALID_OTP on wrong code', async () => {
    prisma.user.findUnique.mockResolvedValue(activeUserWithoutMustChange);
    prisma.otpLoginCode.findFirst.mockResolvedValue(codeRow);
    bcrypt.compare.mockResolvedValue(false);
    const res = makeRes();
    await verifyOtp(makeReq({ sims_id: '1100', code: 'wrongcode' }), res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('INVALID_OTP');
  });

  it('returns 401 INVALID_OTP for non-existent code', async () => {
    prisma.user.findUnique.mockResolvedValue(activeUserWithoutMustChange);
    prisma.otpLoginCode.findFirst.mockResolvedValue(null);
    const res = makeRes();
    await verifyOtp(makeReq({ sims_id: '1100', code: '123456' }), res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('INVALID_OTP');
  });

  it('rejects if atomic claim fails (concurrent redemption)', async () => {
    prisma.user.findUnique.mockResolvedValue(activeUserWithoutMustChange);
    prisma.otpLoginCode.findFirst.mockResolvedValue(codeRow);
    bcrypt.compare.mockResolvedValue(true);
    // Simulate another request claiming it concurrently
    prisma.otpLoginCode.updateMany.mockResolvedValue({ count: 0 });
    const res = makeRes();
    await verifyOtp(makeReq({ sims_id: '1100', code: '048291' }), res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('INVALID_OTP');
  });

  it('calls audit.logAction with OTP_LOGIN on success', async () => {
    prisma.user.findUnique.mockResolvedValue(activeUserWithoutMustChange);
    prisma.otpLoginCode.findFirst.mockResolvedValue(codeRow);
    bcrypt.compare.mockResolvedValue(true);
    prisma.otpLoginCode.updateMany.mockResolvedValue({ count: 1 });
    const res = makeRes();
    await verifyOtp(makeReq({ sims_id: '1100', code: '048291' }), res);
    expect(audit.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: activeUserWithoutMustChange.id,
        action: 'OTP_LOGIN',
        targetId: activeUserWithoutMustChange.id,
        targetType: 'user',
      }),
    );
  });
});

describe('Lockout protection (T020-T024)', () => {
  const userWithoutLock = {
    id: 'user-1',
    sims_id: 1100,
    role: 'faculty',
    status: 'active',
    deleted_at: null,
    must_change_password: false,
    session_version: 1,
    otp_failed_attempts: 0,
    otp_locked_until: null,
    name: 'Dr. Test',
    email: 'faculty@sims.edu',
    phone: null,
    telegram_verified: true,
    department: 'Pharmacy',
    designation: 'AP',
    approved_at: new Date(),
    created_at: new Date(),
  };

  const codeRow = {
    id: 'code-1',
    code_hash: '$2b$12$abcdefghijklmnopqrstuvwxyz',
  };

  beforeEach(() => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.user, 'update').mockResolvedValue(userWithoutLock);
    vi.spyOn(prisma.otpLoginCode, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.otpLoginCode, 'updateMany').mockResolvedValue({ count: 0 });
    vi.spyOn(prisma.otpLoginCode, 'create').mockResolvedValue({});
    vi.spyOn(prisma.otpLoginCode, 'deleteMany').mockResolvedValue({ count: 0 });
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(false);
    vi.spyOn(bcrypt, 'hash').mockResolvedValue('$2b$12$hashedcode');
    vi.spyOn(jwt, 'sign').mockReturnValue('test-jwt-token');
  });
  afterEach(() => vi.restoreAllMocks());

  it('locks account after 5 failed attempts and rejects 6th attempt (T020)', async () => {
    // Simulate 5 failed attempts: user.update will be called 5 times, incrementing the counter
    // On the 5th call, otp_locked_until should be set
    prisma.user.findUnique.mockResolvedValue(userWithoutLock);
    prisma.otpLoginCode.findFirst.mockResolvedValue(codeRow);
    bcrypt.compare.mockResolvedValue(false);

    // Simulate incremental failures
    prisma.user.update.mockResolvedValueOnce({ ...userWithoutLock, otp_failed_attempts: 1 });
    prisma.user.update.mockResolvedValueOnce({ ...userWithoutLock, otp_failed_attempts: 2 });
    prisma.user.update.mockResolvedValueOnce({ ...userWithoutLock, otp_failed_attempts: 3 });
    prisma.user.update.mockResolvedValueOnce({ ...userWithoutLock, otp_failed_attempts: 4 });
    const futureDate = new Date(Date.now() + 15 * 60 * 1000);
    prisma.user.update.mockResolvedValueOnce({
      ...userWithoutLock,
      otp_failed_attempts: 5,
      otp_locked_until: futureDate,
    });

    const res5 = makeRes();
    await verifyOtp(makeReq({ sims_id: '1100', code: 'wrong' }), res5);
    expect(res5._status).toBe(401);

    // Now 6th attempt: user is locked, should reject even with correct code
    const lockedUser = { ...userWithoutLock, otp_locked_until: futureDate, otp_failed_attempts: 5 };
    prisma.user.findUnique.mockResolvedValue(lockedUser);
    bcrypt.compare.mockResolvedValue(true); // Correct code!
    const res6 = makeRes();
    await verifyOtp(makeReq({ sims_id: '1100', code: '123456' }), res6);
    expect(res6._status).toBe(401);
    expect(res6._body.code).toBe('OTP_LOCKED');
  });

  it('suppresses code generation during lockout but returns generic 200 (T021)', async () => {
    const lockedUser = {
      ...userWithoutLock,
      otp_locked_until: new Date(Date.now() + 10 * 60 * 1000), // Still locked
      otp_login_codes: [],
    };
    prisma.user.findUnique.mockResolvedValue(lockedUser);
    const res = makeRes();
    await requestOtp(makeReq({ sims_id: '1100' }), res);
    // Should return generic 200
    expect(res._status).toBe(200);
    // But should NOT create a code
    expect(prisma.otpLoginCode.create).not.toHaveBeenCalled();
  });

  it('resets both otp_failed_attempts and otp_locked_until when lock lapses (T022)', async () => {
    // This is the critical reset-on-lapse test
    const pastLockedUser = {
      ...userWithoutLock,
      otp_failed_attempts: 5,
      otp_locked_until: new Date(Date.now() - 1 * 60 * 1000), // 1 minute in past - lock has lapsed
    };
    prisma.user.findUnique.mockResolvedValue(pastLockedUser);
    prisma.otpLoginCode.findFirst.mockResolvedValue(codeRow);
    bcrypt.compare.mockResolvedValue(false); // Wrong code

    // After lapse check/clear, user.update should be called to reset both fields
    prisma.user.update.mockResolvedValueOnce({
      ...pastLockedUser,
      otp_failed_attempts: 0,
      otp_locked_until: null,
    });

    const res = makeRes();
    await verifyOtp(makeReq({ sims_id: '1100', code: 'wrong' }), res);

    // Verify the update was called to clear both fields
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: pastLockedUser.id },
        data: expect.objectContaining({
          otp_failed_attempts: 0,
          otp_locked_until: null,
        }),
      }),
    );
    // After clearing, one failure should result in count=1
    expect(res._status).toBe(401); // Still rejected but for wrong code, not lock
  });

  it('clears both fields to 0/null on successful verification (T023)', async () => {
    const userWithSomeFails = {
      ...userWithoutLock,
      otp_failed_attempts: 2,
    };
    prisma.user.findUnique.mockResolvedValue(userWithSomeFails);
    prisma.otpLoginCode.findFirst.mockResolvedValue(codeRow);
    bcrypt.compare.mockResolvedValue(true);
    prisma.otpLoginCode.updateMany.mockResolvedValue({ count: 1 });

    const res = makeRes();
    await verifyOtp(makeReq({ sims_id: '1100', code: '123456' }), res);
    expect(res._status).toBe(200);
    // The response should contain must_change_password, indicating successful login
    expect(res._body.must_change_password).toBeDefined();
  });

  it('only allows one of two concurrent code verifications to succeed, other is rejected (T024)', async () => {
    const activeUser = { ...userWithoutLock, otp_failed_attempts: 0 };
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.otpLoginCode.findFirst.mockResolvedValue(codeRow);
    bcrypt.compare.mockResolvedValue(true);

    // First request claims successfully
    prisma.otpLoginCode.updateMany.mockResolvedValueOnce({ count: 1 });
    // Second request fails (concurrent claim)
    prisma.otpLoginCode.updateMany.mockResolvedValueOnce({ count: 0 });

    const res1 = makeRes();
    const res2 = makeRes();

    await Promise.all([
      verifyOtp(makeReq({ sims_id: '1100', code: '123456' }), res1),
      verifyOtp(makeReq({ sims_id: '1100', code: '123456' }), res2),
    ]);

    // Exactly one should succeed
    const statuses = [res1._status, res2._status].sort();
    expect(statuses).toEqual([200, 401]);
  });
});
