# Handoff Report

## task_id
005-duty-reassignment / Remove Need Cover / Volunteer workflow (SIMS DMS Problems 8) and replace it with Admin Duty Reassignment (SIMS DMS Problems 9)

## status
complete

## completed
- **Full removal of the Cover Request / Volunteer workflow** across the whole app, per owner decision (full DB-level removal, not just UI hide):
  - Prisma: dropped `CoverRequest` model, `CoverStatus` enum, `DutySlot.covered_by`/`coveringFaculty`, the `cover_pending`/`covered` values of `SlotStatus`, `calendar_config.max_cover_requests_per_slot`, and `system_config.cover_ttl_hours`. Removed the three cover relations on `User`.
  - Migration `20260707120000_remove_cover_add_duty_reassignment` hand-written: drops the table/enum/columns (collapsing any `cover_pending`/`covered` slots to `scheduled`, recreating the `SlotStatus` enum since Postgres can't drop enum values in place) and creates `duty_reassignments`. **Not yet applied to any database** — see open questions.
  - Backend: deleted `cover-requests` routes/controller/schema and `server/tests/cover-requests.test.mjs`; unmounted the route in `index.js`; removed the hourly cover-expiry cron job; removed `covered_by`/`coveringFaculty` branches from `duty-slots`, `attendance`, and `violations` controllers (ownership is now a single `faculty_id` check); removed cover fields from `settings.service`/`settings.schema`.
  - Frontend: deleted admin + faculty `CoverRequestsPage`, `useCoverRequests`, `PostCoverBroadcastModal`; removed routes (`App.jsx`), nav items + bottom tab (`Layout.jsx`), route constants + cover status colors/labels, `vite.config` proxy/precache entries, dead `COVER_REQUESTS` cache TTL. Faculty dashboard lost the Request Cover button, cover alert, and cover activity items; admin dashboard lost the Cover Requests stat card and Open Cover Requests panel.
- **Admin Duty Reassignment** built end to end:
  - New `duty_reassignments` table (slot, from/to faculty, denormalised date+session, reason, admin, timestamp). On reassign the slot's `faculty_id` is mutated in place and one history row is written, so attendance, My Slots, and counts follow the new owner automatically.
  - `POST /duty-slots/:id/reassign` (admin) — guards: slot must be `scheduled`, date not passed, no attendance recorded, target is an active faculty ≠ current owner. Writes `admin_audit_log` (`REASSIGN_DUTY`) and fires Telegram to both faculty. `GET /duty-slots/reassigned-away/:year/:month` (faculty) lists duties moved away from them. Each slot now carries its latest reassignment (for "reassigned to you" / "originally assigned" labels).
  - Admin **Duty Slots** page: per-row **Reassign** action (only when eligible) + modal (current faculty, date, session, status, searchable new-faculty select, reason, confirm). Replaced the "Covered by" column with a "Reassignment" column.
  - Faculty **Dashboard**: upcoming duties show a "reassigned from …" chip when received; new **Reassigned Away** section; reassignments appear in Recent Activity.
  - Reports: replaced the Cover Request Summary report with a **Duty Reassignments** report (per-faculty duty counts — Regular / Received / Reassigned Away / Final — plus full reassignment history with final attendance). Removed `cover_pending`/`covered` from the Duty Coverage report. Admin dashboard "Reassignments (this month)" stat + Recent Reassignments panel.
  - In-app notification type `cover_request` → `duty_reassigned` (Bell + Notifications page).
- Updated `CONSTITUTION.md` to v3.4 (§3 permissions, §4 new "Admin Duty Reassignment" section replacing "Need Cover", §5 tables/rules, §6 API counts 97→90 / 13→12 modules, §9 crons 3→2). Owner instruction authorised these constitution changes.
- **Verified**: `npm run generate` clean, `npm run build --workspace=client` clean, `npm run test --workspace=server` → 53/53 pass (updated 2 tests that asserted the old `covered_by` OR-scoping).

## failed_or_blocked
- None.

## commands_run
```
npm run generate                       # Prisma client regen — OK
node -e "require('./server/...')"       # backend module load smoke test — OK
npm run build --workspace=client        # exit 0, clean
npm run test --workspace=server         # 53 passed
```

## constraints_discovered
- `duty_slots` has `@@unique([duty_date, session_type])` — exactly one slot per date+session globally. Reassignment is therefore a clean owner swap on that single row; no uniqueness conflict is possible, and the target faculty can never already hold "the same" slot.
- Postgres cannot remove enum values in place; the migration recreates `SlotStatus` via rename-old / create-new / cast / drop-old.

## deviations_from_constitution
- None. The constitution was updated in the same change to match (Admin Duty Reassignment replaces Need Cover); version bumped to 3.4.

## files_touched
- prisma/schema.prisma; prisma/migrations/20260707120000_remove_cover_add_duty_reassignment/migration.sql (new)
- server/index.js; server/lib/cron.js; server/services/settings.service.js; server/schemas/settings.schema.js; server/controllers/duty-timing-settings.controller.js
- server/controllers/duty-slots.controller.js; server/routes/duty-slots.routes.js; server/schemas/duty-slots.schema.js
- server/controllers/attendance.controller.js; server/controllers/violations.controller.js
- server/controllers/reports.controller.js; server/routes/reports.routes.js
- server/tests/duty-slots.test.mjs; server/tests/attendance.test.mjs
- deleted: server/routes/cover-requests.routes.js, server/controllers/cover-requests.controller.js, server/schemas/cover-requests.schema.js, server/tests/cover-requests.test.mjs
- client/src/App.jsx; client/src/components/Layout.jsx; client/src/utils/constants.js; client/src/components/ui/Badge.jsx; client/vite.config.js; client/src/lib/cache.js
- client/src/hooks/useDutySlots.js; client/src/hooks/useReports.js
- client/src/pages/admin/DutySlotsPage.jsx; client/src/pages/admin/AdminDashboardPage.jsx; client/src/pages/admin/ReportsPage.jsx
- client/src/pages/faculty/DashboardPage.jsx; client/src/pages/NotificationsPage.jsx; client/src/components/NotificationBell.jsx
- deleted: client/src/hooks/useCoverRequests.js, client/src/pages/admin/CoverRequestsPage.jsx, client/src/pages/faculty/CoverRequestsPage.jsx, client/src/components/faculty/PostCoverBroadcastModal.jsx
- CONSTITUTION.md (v3.4)

## open_questions_for_owner
- **Migration not yet applied.** `20260707120000_remove_cover_add_duty_reassignment` drops `cover_requests` and columns — destructive and irreversible on data. Run `npm run migrate:deploy` against staging first and confirm before production. Any existing `cover_pending`/`covered` slots become `scheduled`.
- `SIMS_API_Endpoints_v2.0.md` and `SIMS_Database_Schema_v2.1.md` were already flagged stale; they still describe cover requests and should be regenerated to match this change when convenient.
- In-app notifications are not actually generated server-side for reassignment (Telegram is). The `duty_reassigned` in-app type is wired in the UI for when/if an in-app notification feed is populated.
