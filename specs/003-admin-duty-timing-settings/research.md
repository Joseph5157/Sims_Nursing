# Phase 0 Research: Admin Duty Timing Settings

## Decision: Extend `system_config`, do not create a new table

**Rationale**: `prisma/schema.prisma` already has a `SystemConfig` single-row model backing `late_threshold_{morning,afternoon}_{hour,min}` and `session_start_{morning,afternoon}_{hour,min}`, read via `server/services/settings.service.js` (in-memory cached) and already consumed by `attendance.controller.js` (`checkIn`) for window enforcement and late-status calc. FR-009 requires one source of truth — adding a second table would violate that.

**Alternatives considered**: New dedicated `duty_timing_settings` table — rejected, would duplicate/fork the existing single-row config pattern and require both tables to stay in sync.

## Decision: Split auto-checkout into per-session columns; drop the shared pair

**Rationale**: User Story 4 requires independent Morning/Afternoon auto clock-out times (e.g. 12:00 PM vs 5:00 PM). The current `auto_checkout_hour/min` is a single shared pair used both by the cron job and by `checkIn()`'s `windowCloseMins` calc. Both call sites must become session-aware.

**Alternatives considered**: Keep the shared pair as a "default" and add optional per-session overrides — rejected as unnecessary complexity; the spec has no notion of a fallback default, only two required per-session values.

## Decision: New `not_checked_in_{morning,afternoon}_{hour,min}` columns

**Rationale**: No existing field represents this concept — `getLive()` currently flags "not checked in" purely by absence of a `DutyAttendance` row, with no time dimension at all (a slot shows `not_checked_in` from midnight onward). User Story 3 requires a *cutoff-gated* status.

**Alternatives considered**: Derive not-checked-in cutoff from late-threshold cutoff (i.e., reuse `late_threshold_*`) — rejected; spec explicitly calls out "not-checked-in cutoff" as a distinct configurable value from the late-arrival cutoff (Edge Cases section explicitly asks what happens if not-checked-in cutoff is set later than auto clock-out, implying it's independently tunable).

## Decision: New `attendance_status` value `upcoming` for pre-cutoff, no-check-in slots

**Rationale**: Introducing a time-gated not-checked-in cutoff means the dashboard needs a way to represent "hasn't checked in yet, but cutoff hasn't passed" distinctly from "cutoff passed, still no check-in" (the real not-checked-in alert). Reusing `not_checked_in` for both would either alarm admins prematurely (current behavior, the bug this feature fixes) or hide genuine no-shows.

**Alternatives considered**: Keep a single `not_checked_in` value and let the frontend derive urgency by comparing `duty_date`/`session_type` against settings client-side — rejected; duplicates cutoff logic in two places (backend cron/checkIn already does this time math), violating FR-009's single-source-of-truth intent. Server should be the sole authority on status.

## Decision: Rework cron from one fixed daily trigger to a frequent tick

**Rationale**: `server/lib/cron.js` currently registers `cron.schedule('30 16 * * *', ...)` — a single fixed trigger time. Per-session configurable auto clock-out (e.g. Morning at 12:00 PM) cannot be served by a trigger that only fires once at 16:30; a Morning cutoff earlier than 16:30 would never fire in time, and an Afternoon cutoff later than 16:30 would already have fired too early to fully close.

**Decision**: Change the registration to a frequent tick (every 10 minutes: `'*/10 * * * *'`) and move the "has this session's cutoff passed yet" check inside the job body, grouping open attendance by `(duty_date, session_type)` and comparing each group's own `auto_checkout_{session}_hour/min` against current IST time before clocking out that group.

**Alternatives considered**:
- Dynamically re-registering `node-cron` schedules whenever an Admin saves new settings — rejected, adds significant complexity (schedule teardown/rebuild, restart-safety) for no behavioral benefit over a frequent tick with an in-job time check; a 10-minute worst-case delay is acceptable given the existing 30-second-polling precedent elsewhere in the system and no stated SLA tighter than that.
- Every-minute tick — considered for tighter precision; 10 minutes chosen as a balance consistent with the system's existing "30-second polling is fine, no WebSockets" real-time philosophy (CONSTITUTION.md §4 Notifications/§2 Infrastructure) — auto clock-out is not a user-facing real-time action, sub-10-minute precision has no stated requirement.

## Decision: New route group for Admin+Super-Admin timing settings, separate from `/admin/settings`

**Rationale**: `server/routes/admin.routes.js` applies `router.use(authenticate, authorize('super_admin'))` at the router level, covering unrelated Super-Admin-exclusive endpoints (`hard-delete`, `reset-login`, `audit-logs`) as well as the existing `/admin/settings` (which also holds `cover_ttl_hours`, a value the constitution still scopes to Super Admin's "Configures system-wide settings" permission). FR-008 requires Duty Timing Settings specifically to be reachable by Admin *and* Super Admin.

**Decision**: Add a new route module `duty-timing-settings.routes.js` mounted at `/duty-timing-settings`, using per-route `authorize('admin', 'super_admin')` (the same pattern as `calendar.routes.js`), reading/writing only the timing subset of columns on the same `system_config` row via `settingsService`. `cover_ttl_hours` and the existing `/admin/settings` endpoint are untouched and remain Super-Admin-only.

**Alternatives considered**: Loosen `admin.routes.js`'s router-level guard to `authorize('admin','super_admin')` and add a stricter per-route `authorize('super_admin')` to the other three endpoints — rejected as a larger, riskier diff touching working Super-Admin-only endpoints unrelated to this feature, for no benefit over adding one new small route file.

## Decision: Ordering validation performed after merging with the existing row, not in the Zod schema alone

**Rationale**: The endpoint accepts partial `PATCH` bodies (matches existing `updateSettingsSchema` pattern — all fields `.optional()`). FR-003's ordering rule (start ≤ late cutoff ≤ not-checked-in cutoff ≤ auto clock-out, per session) can only be checked correctly against the *effective* merged values, not the raw partial body (e.g. an Admin might PATCH only `auto_checkout_morning_hour` while `session_start_morning_hour` is unchanged from an existing row).

**Decision**: Zod schema validates field types/ranges (`0-23` hour, `0-59` minute) only; the controller merges the incoming partial with the current row before calling a small pure ordering-check function, rejecting with `422 VALIDATION_ERROR` before calling `settingsService.updateSettings()` if any session's order is violated.

**Alternatives considered**: Zod `.superRefine()` cross-field check directly on the request body — rejected, cannot see the current DB row's existing values for fields omitted from a partial PATCH.
