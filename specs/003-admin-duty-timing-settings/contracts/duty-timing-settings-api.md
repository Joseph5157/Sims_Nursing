# API Contract: Duty Timing Settings

**Base path**: `/duty-timing-settings` (new route module, mounted alongside existing modules in `server/index.js`)

**Auth**: All routes require `authenticate` + `authorize('admin', 'super_admin')` (FR-008 — both roles, unlike the existing Super-Admin-only `/admin/settings`).

---

## `GET /duty-timing-settings`

Returns the timing subset of the `system_config` row (session start, late cutoff, not-checked-in cutoff, auto clock-out — all per session). Does not include `cover_ttl_hours` (out of scope, remains under `/admin/settings`).

**Response 200**:
```json
{
  "session_start_morning_hour": 8,
  "session_start_morning_min": 0,
  "session_start_afternoon_hour": 13,
  "session_start_afternoon_min": 0,
  "late_threshold_morning_hour": 8,
  "late_threshold_morning_min": 15,
  "late_threshold_afternoon_hour": 13,
  "late_threshold_afternoon_min": 15,
  "not_checked_in_morning_hour": 8,
  "not_checked_in_morning_min": 30,
  "not_checked_in_afternoon_hour": 13,
  "not_checked_in_afternoon_min": 30,
  "auto_checkout_morning_hour": 16,
  "auto_checkout_morning_min": 30,
  "auto_checkout_afternoon_hour": 16,
  "auto_checkout_afternoon_min": 30,
  "updated_by": "uuid-or-null",
  "updated_at": "2026-07-06T10:00:00.000Z"
}
```

## `PATCH /duty-timing-settings`

Partial update — any subset of the 16 timing fields above (all `.optional()` in Zod, `.strict()` to reject unknown fields, matching `updateSettingsSchema` convention).

**Request body** (example — changing only Morning late cutoff):
```json
{ "late_threshold_morning_hour": 9, "late_threshold_morning_min": 15 }
```

**Validation**:
- Each field: `z.number().int()`, hour `0-23`, minute `0-59` (same primitives as existing `hour`/`minute` in `settings.schema.js`).
- Cross-field ordering check (see `data-model.md`) runs in the controller against the *merged* (existing + incoming) row, per session:
  `session_start < late_threshold ≤ not_checked_in ≤ auto_checkout`.

**Response 200**: same shape as `GET`, reflecting the merged, persisted row.

**Response 422** (ordering violation):
```json
{ "error": true, "code": "VALIDATION_ERROR", "message": "Morning cutoffs must occur in order: session start < late cutoff ≤ not-checked-in cutoff ≤ auto clock-out." }
```

**Response 422** (Zod type/range failure — existing `validate` middleware shape):
```json
{ "error": true, "code": "VALIDATION_ERROR", "errors": [{ "field": "late_threshold_morning_hour", "message": "..." }] }
```

**Response 403** (caller is Faculty): existing `authorize` middleware shape:
```json
{ "error": true, "code": "FORBIDDEN", "message": "..." }
```

**Side effect**: on success, writes an `admin_audit_log` entry via `logAction({ actorId, action: 'DUTY_TIMING_SETTINGS_UPDATE', targetId: settings.id, targetType: 'system_config', metadata: req.body })` — mirrors the existing `SETTINGS_UPDATE` audit pattern in `users.controller.js`, with a distinct action name so the two settings surfaces are distinguishable in the audit log.

---

## Effect on existing contracts (no request/response shape change, behavior change only)

### `POST /attendance/:dutySlotId/check-in`

No contract change. Internally, `windowCloseMins` now reads `cfg.auto_checkout_{session}_hour/min` instead of the removed shared `cfg.auto_checkout_hour/min`.

### `GET /attendance/live`

**Response shape addition**: `attendance_status` gains a new possible value `"upcoming"` (see `data-model.md`) alongside the existing `"not_checked_in"`, `"checked_in"`, `"checked_out"`. Consumers (`client/src/pages/admin/AttendanceLivePage.jsx`) must handle the new value — existing filters keyed on `"not_checked_in"` (e.g. the `notIn` stat count) are unaffected since they use exact string match and `"upcoming"` is a distinct value.
