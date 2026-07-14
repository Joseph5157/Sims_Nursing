const settingsService = require('../services/settings.service');
const { logAction } = require('../services/audit.service');

// Only these 12 timing fields are exposed here — any other system_config
// fields stay on the Super-Admin-only /admin/settings endpoint.
const TIMING_FIELDS = [
  'session_start_morning_hour', 'session_start_morning_min',
  'session_start_afternoon_hour', 'session_start_afternoon_min',
  'late_threshold_morning_hour', 'late_threshold_morning_min',
  'late_threshold_afternoon_hour', 'late_threshold_afternoon_min',
  'auto_checkout_morning_hour', 'auto_checkout_morning_min',
  'auto_checkout_afternoon_hour', 'auto_checkout_afternoon_min',
];

function pickTimingFields(row) {
  const out = {};
  for (const key of TIMING_FIELDS) out[key] = row[key];
  return out;
}

// ─── GET /duty-timing-settings — Admin, Super Admin ──────────────────────────

async function getDutyTimingSettings(req, res) {
  const settings = await settingsService.getSettings();
  res.json(pickTimingFields(settings));
}

// ─── PATCH /duty-timing-settings — Admin, Super Admin ────────────────────────

async function updateDutyTimingSettings(req, res) {
  const current = await settingsService.getSettings();
  const merged  = { ...current, ...req.body };

  const violation = settingsService.findOrderingViolation(merged);
  if (violation) {
    return res.status(422).json({ error: true, code: 'VALIDATION_ERROR', message: violation });
  }

  const settings = await settingsService.updateSettings(req.body, req.user.id);

  await logAction({
    actorId:    req.user.id,
    action:     'DUTY_TIMING_SETTINGS_UPDATE',
    targetId:   settings.id,
    targetType: 'system_config',
    metadata:   req.body,
  });

  res.json(pickTimingFields(settings));
}

module.exports = { getDutyTimingSettings, updateDutyTimingSettings };
