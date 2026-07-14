# Implementation Plan: Admin Duty Timing Settings

**Branch**: `003-admin-duty-timing-settings` | **Date**: 2026-07-06 | **Spec**: `specs/003-admin-duty-timing-settings/spec.md`

**Input**: Feature specification from `specs/003-admin-duty-timing-settings/spec.md`

## Summary

Make session start times, late-arrival cutoffs, not-checked-in cutoffs, and auto clock-out times Admin/Super-Admin-configurable per session (Morning/Afternoon), replacing hardcoded values. **Discovery during planning**: most of the backend groundwork already exists — `system_config` (Prisma `SystemConfig`), `settings.service.js`, and `/admin/settings` (Super-Admin-only) already store and serve `session_start_*`, `late_threshold_*` per session, driving `checkIn()`'s window enforcement and late-status calc. The real remaining work is narrower than "hardcode → DB":

1. Add per-session `auto_checkout_{morning,afternoon}_{hour,min}` (replacing the single shared `auto_checkout_hour/min`) and new per-session `not_checked_in_{morning,afternoon}_{hour,min}` columns.
2. Rework the auto-clock-out cron from a single fixed daily trigger to a frequent tick that clocks out each session only once *its own* configured time has passed.
3. Add cutoff-aware "not checked in" logic to `getLive()` (currently a pure null-check with no time dimension) and a new `upcoming` pre-cutoff status on the dashboard.
4. Expose a dedicated **Admin + Super Admin** accessible endpoint/page for these four timing fields (existing `/admin/settings` is nested under a router-level `authorize('super_admin')` guard covering unrelated Super-Admin-only endpoints — timing settings need their own route group per FR-008).
5. Add save-time ordering validation (start ≤ late cutoff ≤ not-checked-in cutoff ≤ auto clock-out, per session).
6. Build the missing frontend page (no Settings page exists in `client/src` today).
7. Bump `CONSTITUTION.md` to v2.7 per the spec's assumptions.

## Technical Context

**Language/Version**: Node.js (Express, CommonJS) backend; React 18 (Vite) frontend — matches existing repo, no new runtime.

**Primary Dependencies**: Prisma ORM, Zod, node-cron, TanStack Query, Mantine, Tailwind — all already in use, no new dependencies required.

**Storage**: PostgreSQL via Prisma — extend existing `system_config` table (single-row) with new columns; additive migration.

**Testing**: existing `server/tests/*.test.mjs` (Node's built-in test runner based on `cron.test.mjs` precedent) + manual quickstart validation (no frontend test harness currently in repo).

**Target Platform**: Railway-hosted Node server + PWA frontend (existing).

**Project Type**: Web application (existing `client/` + `server/` + `prisma/` monolith — Option 2 in the template below).

**Performance Goals**: N/A beyond existing cron/API latency norms; new cron tick interval must stay lightweight (bounded by open-attendance row count, same as today).

**Constraints**: Must not retroactively alter existing `duty_attendance` records (FR-007); must not introduce a new role or break the 3-role model; must keep `system_config` as the single source of truth (FR-009) — no module keeps its own copy.

**Scale/Scope**: Single admin-facing settings page, ~8 new/changed schema columns, 1 new route module, 1 cron rework, 2 controller logic changes (checkIn window-close lookup, getLive), 1 new frontend page + hook.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Tech stack**: Uses only the locked stack (React/Vite/TanStack/Tailwind/Mantine, Express/Prisma/Zod) — **PASS**.
- **Roles**: No new role introduced. Admin gains access to a settings sub-area it didn't have via `/admin/settings` before — this requires a constitution update (Admin permissions list) rather than a new role — **PASS with required constitution amendment** (see below).
- **UUID PKs / DECIMAL money / soft deletes**: Not applicable — no new monetary or deletable entities — **PASS**.
- **Single source of truth (`system_config`)**: New fields extend the existing table rather than creating a duplicate config store — **PASS**.
- **Folder structure**: New files follow `server/routes|controllers|services|schemas` and `client/src/pages/admin`, `client/src/hooks` — no structural changes — **PASS**.
- **Constitution amendment required**: CONSTITUTION.md §3 (Admin permissions must list Duty Timing Settings access), §4 Duty Attendance (currently states fixed 9:00/2:00/4:30 rules — must reference configurable settings instead), §9 Cron Jobs table (auto clock-out row currently says "Daily 4:30 PM" — must reflect per-session configurable + frequent-tick design), §5 `system_config` row (already generically described, minor field-list note optional). Version bump 3.1 → 3.2 (constitution's own versioning scheme, not the spec's assumed "v2.6/v2.7"). This is an explicit, spec-mandated amendment (see spec Assumptions), not a deviation — no Complexity Tracking entry needed.

No unjustified violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-admin-duty-timing-settings/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── duty-timing-settings-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

**Structure Decision**: Existing web-application monolith (Option 2: `client/` + `server/` + root `prisma/`). This feature only adds/edits files within that existing structure — no new top-level directories.

```text
prisma/
├── schema.prisma                 # EDIT: SystemConfig — add/replace columns
└── migrations/                   # ADD: new migration for column changes

server/
├── routes/
│   └── duty-timing-settings.routes.js   # ADD: GET/PATCH, authorize('admin','super_admin')
├── controllers/
│   ├── duty-timing-settings.controller.js  # ADD: getDutyTimingSettings/updateDutyTimingSettings
│   └── attendance.controller.js         # EDIT: per-session auto-checkout lookup, getLive() cutoff logic
├── services/
│   └── settings.service.js              # EDIT: DEFAULTS + field list for new columns
├── schemas/
│   └── duty-timing-settings.schema.js   # ADD: Zod schema + ordering validation
├── lib/
│   └── cron.js                          # EDIT: autoClockOut → per-session, frequent tick
└── index.js                             # EDIT: mount new route

client/src/
├── hooks/
│   └── useDutyTimingSettings.js         # ADD: TanStack Query hook (get + update)
├── pages/admin/
│   └── DutyTimingSettingsPage.jsx       # ADD: settings form page
└── App.jsx                              # EDIT: register route under ['admin','super_admin'] group

CONSTITUTION.md                          # EDIT: v3.1 → v3.2, §3/§4/§9 updates
```

## Complexity Tracking

*No violations requiring justification.*
