import csrf from '../middleware/csrf.js';

// globals: true — describe, it, expect, beforeEach are injected by vitest

function makeRes() {
  const res = { _status: null, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json   = (body) => { res._body = body; return res; };
  return res;
}

describe('CSRF middleware', () => {
  let nextCalled;

  beforeEach(() => { nextCalled = false; });

  const next = () => { nextCalled = true; };

  it('passes GET requests without checking CSRF tokens', () => {
    const req = { method: 'GET', cookies: {}, headers: {} };
    csrf(req, makeRes(), next);
    expect(nextCalled).toBe(true);
  });

  it('passes HEAD requests without checking CSRF tokens', () => {
    const req = { method: 'HEAD', cookies: {}, headers: {} };
    csrf(req, makeRes(), next);
    expect(nextCalled).toBe(true);
  });

  it('passes unauthenticated POST requests (no sims_token cookie)', () => {
    const req = { method: 'POST', cookies: {}, headers: {} };
    csrf(req, makeRes(), next);
    expect(nextCalled).toBe(true);
  });

  it('exempts POST /auth/login even when a stale sims_token cookie is present', () => {
    const req = {
      method: 'POST',
      path: '/auth/login',
      cookies: { sims_token: 'stale-jwt-here' }, // no sims_csrf cookie at all
      headers: {},
    };
    csrf(req, makeRes(), next);
    expect(nextCalled).toBe(true);
  });

  it('returns 403 CSRF_MISSING when authenticated but no CSRF tokens provided', () => {
    const req = {
      method: 'POST',
      cookies: { sims_token: 'jwt-here' },
      headers: {},
    };
    const res = makeRes();
    csrf(req, res, next);
    expect(nextCalled).toBe(false);
    expect(res._status).toBe(403);
    expect(res._body.code).toBe('CSRF_MISSING');
  });

  it('returns 403 CSRF_INVALID when cookie and header tokens do not match', () => {
    const req = {
      method: 'PATCH',
      cookies: { sims_token: 'jwt-here', sims_csrf: 'aaa' },
      headers: { 'x-csrf-token': 'bbb' },
    };
    const res = makeRes();
    csrf(req, res, next);
    expect(nextCalled).toBe(false);
    expect(res._status).toBe(403);
    expect(res._body.code).toBe('CSRF_INVALID');
  });

  it('calls next when sims_csrf cookie and X-CSRF-Token header match exactly', () => {
    const token = 'deadbeef'.repeat(8); // 64-char token
    const req = {
      method: 'DELETE',
      cookies: { sims_token: 'jwt-here', sims_csrf: token },
      headers: { 'x-csrf-token': token },
    };
    csrf(req, makeRes(), next);
    expect(nextCalled).toBe(true);
  });
});
