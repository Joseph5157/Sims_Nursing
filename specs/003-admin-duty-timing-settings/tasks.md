# Tasks: Admin Duty Timing Settings

**Input**: Design documents from `specs/003-admin-duty-timing-settings/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/duty-timing-settings-api.md, quickstart.md

**Tests**: Not explicitly requested by the spec. One existing test file (`server/tests/cron.test.mjs`) exercises code this feature rewrites and MUST be updated to keep passing — that is maintenance of an existing suite, not new test authoring, and is included below for correctness.

**Organization**: Tasks are grouped by user story per `spec.md` priorities (US1/US2 = P1, US3 = P2, US4 = P1).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps task to US1–US4 from spec.md

---

## Phase 1: Setup

- [X] T001 [P] Update `CONSTITUTION.md` to v3.2: §3 Admin permissions (add Duty Timing Settings access, shared with Super Admin), §4 Duty Attendance (remove fixed 9:00/2:00/4:30 language, reference configurable settings), §9 Cron Jobs table (auto clock-out row: "Daily 4:30 PM" → per-session configurable, frequent-tick evaluated)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — the schema change here is a breaking change to two existing call sites that must be fixed in the same phase.

- [X] T002 Add Prisma migration extending `system_config` in `prisma/schema.prisma` + new migration under `prisma/migrations/`: add `not_checked_in_morning_hour`, `not_checked_in_morning_min`, `not_checked_in_afternoon_hour`, `not_checked_in_afternoon_min`, `auto_checkout_morning_hour`, `auto_checkout_morning_min`, `auto_checkout_afternoon_hour`, `auto_checkout_afternoon_min` (all `Int @db.SmallInt`, defaults per `data-model.md`); drop `auto_checkout_hour`/`auto_checkout_min`; migration SQL backfills the two new per-session pairs from the old shared pair's existing values before dropping them
- [X] T003 Update `server/services/settings.service.js` `DEFAULTS` object to drop `auto_checkout_hour`/`auto_checkout_min` and add the 8 new fields with defaults matching `data-model.md` (depends on T002)
- [X] T004 Update `server/controllers/attendance.controller.js` `checkIn()` — `windowCloseMins` (currently `cfg.auto_checkout_hour * 60 + cfg.auto_checkout_min`) must read `cfg.auto_checkout_{session}_hour/min` keyed by `slot.session_type`, matching the existing `startHour`/`startMin` per-session pattern just above it (depends on T002) — **required to keep check-in working post-migration**

**Checkpoint**: Schema updated, existing check-in flow still works. User story implementation can begin.

---

## Phase 3: User Story 1 — Admin Configures Session and Cutoff Times (Priority: P1) 🎯 MVP

**Goal**: Admin/Super Admin can view and edit all timing fields from one settings page; invalid orderings are rejected.

**Independent Test**: Log in as Admin, open Duty Timing Settings, change Morning start time + late cutoff, save, confirm persistence; log in as Faculty and confirm access is denied; submit an invalid ordering and confirm rejection.

- [X] T005 [P] [US1] Create `server/schemas/duty-timing-settings.schema.js` — Zod schema with all 16 timing fields (`session_start_*`, `late_threshold_*`, `not_checked_in_*`, `auto_checkout_*`, each `_hour`/`_min`), all `.optional()`, `hour` = `z.number().int().min(0).max(23)`, `minute` = `z.number().int().min(0).max(59)`, `.strict()` — mirrors `server/schemas/settings.schema.js` conventions
- [X] T006 [US1] Create `server/controllers/duty-timing-settings.controller.js` — `getDutyTimingSettings(req,res)` returns the 16-field subset from `settingsService.getSettings()`; `updateDutyTimingSettings(req,res)` merges `req.body` into the current row, runs the per-session ordering check from `data-model.md` (`session_start < late_threshold ≤ not_checked_in ≤ auto_checkout`) rejecting with `422 VALIDATION_ERROR` on failure, else calls `settingsService.updateSettings(...)` and logs `logAction({ actorId: req.user.id, action: 'DUTY_TIMING_SETTINGS_UPDATE', targetId: settings.id, targetType: 'system_config', metadata: req.body })` via `server/services/audit.service.js` (depends on T003, T005)
- [X] T007 [US1] Create `server/routes/duty-timing-settings.routes.js` — `router.use(authenticate)`, then `router.get('/', authorize('admin','super_admin'), asyncHandler(ctrl.getDutyTimingSettings))` and `router.patch('/', authorize('admin','super_admin'), validate(updateDutyTimingSettingsSchema), asyncHandler(ctrl.updateDutyTimingSettings))` (depends on T006)
- [X] T008 [US1] Mount the new router in `server/index.js` — `app.use('/duty-timing-settings', require('./routes/duty-timing-settings.routes'))`, added to the existing route-mounting block (depends on T007)
- [X] T009 [P] [US1] Create `client/src/hooks/useDutyTimingSettings.js` — `useDutyTimingSettings()` (TanStack `useQuery` on `GET /duty-timing-settings`) and `useUpdateDutyTimingSettings()` (`useMutation` on `PATCH /duty-timing-settings`, `qc.invalidateQueries` on success) — mirrors `client/src/hooks/useCalendar.js` pattern
- [X] T010 [US1] Create `client/src/pages/admin/DutyTimingSettingsPage.jsx` — `Layout`/`Breadcrumb`/`PageHeader` per `CalendarPage.jsx` convention; form with Mantine `NumberInput` pairs (hour/min) for all 4 timing concepts × 2 sessions; save button wired to `useUpdateDutyTimingSettings()`; surface `422` validation errors from the API as inline/toast messages (depends on T009)
- [X] T011 [US1] Register `/admin/duty-timing-settings` route in `client/src/App.jsx` inside the existing `requiredRoles={['admin','super_admin']}` protected route group (line ~113) (depends on T010)

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 — Late Arrival Flagging Uses Configured Cutoff (Priority: P1)

**Goal**: Confirm check-in late/normal status already reflects the Admin-configured per-session cutoff.

**Independent Test**: Per `quickstart.md` §2 — set Morning late cutoff to 9:15 AM, check in at 9:16 AM → `late`; check in at 9:10 AM → `normal`; change cutoff mid-flow and confirm earlier records are untouched.

- [X] T012 [US2] Validate `resolveInStatus()` in `server/controllers/attendance.controller.js` (unchanged by this feature — already reads `cfg.late_threshold_{session}_hour/min`) continues to behave correctly against the post-migration `system_config` row; run through `quickstart.md` §2 manually since this story requires no code change beyond what T002–T004 already provide

**Checkpoint**: User Story 2 confirmed working (no new code beyond Foundational phase).

---

## Phase 5: User Story 3 — Not-Checked-In Status Uses Configured Cutoff (Priority: P2)

**Goal**: Live attendance dashboard distinguishes "not yet due" from "cutoff passed, still not checked in."

**Independent Test**: Set not-checked-in cutoff to 9:30 AM; before cutoff a scheduled faculty member with no check-in shows `upcoming`; after cutoff, `not_checked_in`; checking in afterward flips to `checked_in`.

- [X] T013 [US3] Update `getLive()` in `server/controllers/attendance.controller.js` — for slots with no attendance row, compute `upcoming` vs `not_checked_in` by comparing current IST time (`nowInIST()`) against `cfg.not_checked_in_{session}_hour/min` (fetch `cfg` via `settingsService.getSettings()`, same as `checkIn()`), replacing the current unconditional `not_checked_in` (depends on T002)
- [X] T014 [P] [US3] Update `client/src/pages/admin/AttendanceLivePage.jsx` (including its `FacultyCard`) to render the new `upcoming` status distinctly (neutral/no-alert styling) from `not_checked_in` (alert styling); confirm the `notIn` stat count still filters on `attendance_status === 'not_checked_in'` only (depends on T013)

**Checkpoint**: User Story 3 fully functional and independently testable.

---

## Phase 6: User Story 4 — Auto Clock-Out Uses Configured Time Per Session (Priority: P1)

**Goal**: Auto clock-out cron respects each session's own configured time instead of one shared fixed time.

**Independent Test**: Set Morning auto clock-out to 12:00 PM, Afternoon to 5:00 PM; a Morning faculty member left checked in is clocked out at 12:00 PM; an Afternoon faculty member is unaffected until 5:00 PM.

- [X] T015 [US4] Rework `autoClockOut()` in `server/lib/cron.js`: change trigger registration from `cron.schedule('30 16 * * *', ...)` to a frequent tick `cron.schedule('*/10 * * * *', ...)`; inside the job, group open attendance by `(duty_date, session_type)` instead of `duty_date` alone; for each group, read that session's `cfg.auto_checkout_{session}_hour/min`, skip the group if current IST time hasn't reached it yet, and only clock out groups whose cutoff has passed (depends on T002, T004)
- [X] T016 [US4] Update `server/tests/cron.test.mjs` to match the new per-session, frequent-tick `autoClockOut()` behavior (existing assertions built around the single shared `auto_checkout_hour/min` and single daily trigger will fail otherwise) (depends on T015)

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T017 [P] Run full `specs/003-admin-duty-timing-settings/quickstart.md` end-to-end (all 5 sections) against a local dev stack
- [X] T018 Fill out `specs/003-admin-duty-timing-settings/handoff.md` from `specs/_templates/handoff.md` per `CLAUDE.md` handoff requirement

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: No dependencies, can run any time (independent of code)
- **Foundational (T002–T004)**: BLOCKS all user stories — T003/T004 both depend on T002's schema change
- **User Stories (Phase 3–6)**: All depend on Foundational completion
  - US1 (T005–T011): no dependency on US2/US3/US4
  - US2 (T012): no code dependency beyond Foundational — can be validated any time after T004
  - US3 (T013–T014): no dependency on US1/US2/US4 beyond Foundational
  - US4 (T015–T016): no dependency on US1/US2/US3 beyond Foundational (T004)
- **Polish (T017–T018)**: after all desired stories are complete

### Parallel Opportunities

- T001 can run in parallel with T002–T004 (docs vs. code)
- Within Foundational: T003 and T004 both depend on T002 but not on each other — can run in parallel once T002 lands
- Once Foundational is done: US1, US3, US4 touch disjoint files and can proceed in parallel; US2 is validation-only and can happen any time after Foundational
- Within US1: T005 and T009 have no code dependency on each other and can start in parallel; T009's hook can be written against the contract in `contracts/duty-timing-settings-api.md` before T006–T008 land, though it can't be exercised end-to-end until T008 is done

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Setup (T001) + Foundational (T002–T004)
2. Complete User Story 1 (T005–T011)
3. Validate independently via `quickstart.md` §1
4. This alone satisfies SC-001 (Admin can view/edit settings without DB access) and SC-004 (invalid orderings rejected)

### Incremental Delivery

1. Setup + Foundational → schema ready, existing check-in flow intact
2. + US1 → settings page usable (MVP)
3. + US2 → confirm late-flagging already correct (no new code)
4. + US3 → not-checked-in cutoff live on dashboard
5. + US4 → per-session auto clock-out cron
6. Polish → full quickstart pass + handoff.md

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete task
- T004 and T015 both touch cron/check-in auto-checkout logic but at different times (T004 is a minimal Foundational fix to prevent breakage; T015 is US4's full per-session rework) — do not skip T004 even if planning to do T015 soon after, since Foundational must leave the app in a working state before user-story work begins
- Commit after each task or logical group per repo convention
- No new role, no new table, no retroactive rewrite of existing `duty_attendance` rows at any step (FR-007)
