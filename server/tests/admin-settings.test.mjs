import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

const prisma           = _require('../lib/prisma');
const settingsService   = _require('../services/settings.service');
const { updateSettings } = _require('../controllers/users.controller');

function makeReq(body = {}, user = { id: 'admin-1', role: 'super_admin' }) {
  return { body, user };
}
function makeRes() {
  const r = { _status: 200, _body: null };
  r.status = (c) => { r._status = c; return r; };
  r.json   = (b) => { r._body = b; return r; };
  return r;
}

// Regression coverage for the PATCH /admin/settings route itself: it was
// silently dropped from server/routes/admin.routes.js in commit 42c2edb (an
// unrelated Telegram self-service-reset commit that touched several route
// files) while the controller function it wired to stayed exported and
// untouched — so `require`-ing the controller directly, as older
// tests/regressions might, would never have caught the route going missing.
describe('admin.routes.js — PATCH /settings route registration', () => {
  it('registers a PATCH /settings route', () => {
    // Fresh require of the actual router module — this is what would have
    // caught commit 42c2edb: that commit left updateSettings fully intact
    // and exported, so any test that only unit-tests the controller function
    // (as the block below does) passes whether or not the route exists.
    delete require.cache[require.resolve('../routes/admin.routes')];
    const router = _require('../routes/admin.routes');

    const patchSettingsRoute = router.stack.find(
      (layer) => layer.route?.path === '/settings' && layer.route?.methods?.patch,
    );
    expect(patchSettingsRoute).toBeDefined();
  });
});

// Mirrors the real DEFAULTS in settings.service.js — a valid, in-order
// baseline (8:00 < 8:15 ≤ 16:30 / 13:00 < 13:15 ≤ 16:30) so a partial PATCH
// merges onto something ordering-valid unless the PATCH itself breaks it.
const currentSettings = {
  id: 'cfg-1',
  session_start_morning_hour:    8,  session_start_morning_min:    0,
  session_start_afternoon_hour:  13, session_start_afternoon_min:  0,
  late_threshold_morning_hour:   8,  late_threshold_morning_min:   15,
  late_threshold_afternoon_hour: 13, late_threshold_afternoon_min: 15,
  auto_checkout_morning_hour:    16, auto_checkout_morning_min:    30,
  auto_checkout_afternoon_hour:  16, auto_checkout_afternoon_min:  30,
};

describe('updateSettings', () => {
  const updatedRow = { ...currentSettings, auto_checkout_morning_hour: 17, auto_checkout_morning_min: 0, updated_by: 'admin-1' };

  beforeEach(() => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(currentSettings);
    vi.spyOn(settingsService, 'updateSettings').mockResolvedValue(updatedRow);
    // audit.service's logAction is destructured at require-time in
    // users.controller.js, so spying on the audit module's own export
    // afterwards would not intercept the call — mock the actual DB write
    // logAction makes instead (prisma itself is a shared singleton, not
    // destructured, so this boundary is spy-able).
    vi.spyOn(prisma.adminAuditLog, 'create').mockResolvedValue({});
  });
  afterEach(() => vi.restoreAllMocks());

  it('persists the settings change via settingsService and returns the updated row', async () => {
    const body = { auto_checkout_morning_hour: 17, auto_checkout_morning_min: 0 };
    const res = makeRes();
    await updateSettings(makeReq(body), res);

    expect(settingsService.updateSettings).toHaveBeenCalledWith(body, 'admin-1');
    expect(res._status).toBe(200);
    expect(res._body).toEqual(updatedRow);
  });

  it('writes a SETTINGS_UPDATE audit log entry for the change', async () => {
    const body = { auto_checkout_morning_hour: 17, auto_checkout_morning_min: 0 };
    await updateSettings(makeReq(body), makeRes());

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actor_id: 'admin-1',
        action: 'SETTINGS_UPDATE',
        target_id: updatedRow.id,
        target_type: 'system_config',
        metadata: body,
      }),
    });
  });

  // Regression coverage for the ordering check itself: PATCH /admin/settings
  // shares system_config's timing fields with PATCH /duty-timing-settings and
  // must reject the same out-of-order values the same way — via the shared
  // settingsService.findOrderingViolation, not a separate reimplementation.
  it('rejects a PATCH that would put auto_checkout before session_start, same as /duty-timing-settings', async () => {
    // Current morning session_start is 8:00 / late_threshold 8:15 — pushing
    // auto_checkout to 7:00 puts it before both.
    const body = { auto_checkout_morning_hour: 7, auto_checkout_morning_min: 0 };
    const res = makeRes();
    await updateSettings(makeReq(body), res);

    expect(res._status).toBe(422);
    expect(res._body.code).toBe('VALIDATION_ERROR');
    expect(res._body.message).toMatch(/Morning cutoffs must occur in order/);
    expect(settingsService.updateSettings).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });
});
