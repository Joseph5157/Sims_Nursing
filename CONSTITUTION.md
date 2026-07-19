# SIMS DMS — Project Constitution

> This file is the single source of truth for the SIMS Discipline Management System.
> Claude Code must read and follow this document before taking any action on this codebase.
> Do not deviate from decisions recorded here without explicit instruction from the project owner.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Project Name | SIMS Discipline Management System (SIMS Nursing DMS) |
| Institution | SIMS College of Nursing |
| Purpose | Replace the manual paper-based discipline process with a digital system for managing faculty duties, student violations, and reporting |
| Scale | Single college, ~20–30 faculty members |
| Status | All three build phases functionally complete (see §8) — now in QA/UAT before production launch |

---

## 2. Non-Negotiable Tech Stack

These decisions are locked. Do not suggest alternatives or use different tools.

### Frontend

| Tool | Purpose |
|---|---|
| React.js | UI framework — PWA + responsive |
| Vite | Build tooling — replaces Create React App |
| TanStack Query | API state management, caching, 30-second polling |
| Tailwind CSS | Mobile-first responsive styling — all custom layout, typography, and one-off components |
| Mantine (`@mantine/core`, `@mantine/hooks`) | Accessible form primitives (`TextInput`, `Select`, `Checkbox`, `Switch`, `NumberInput`) and overlay focus handling (`Modal`, nav `Drawer`) — kept specifically for behavior not worth re-implementing (focus trapping, keyboard nav, ARIA wiring), not for general styling. **Mantine's color palette is derived from the Tailwind DS tokens** (`client/src/App.jsx` `mantineTheme` object); if brand or status colors change, both `index.css @theme` and `mantineTheme.colors` must be updated in sync to prevent palette drift. |
| Workbox | PWA service worker caching |

> **Evaluated and rejected (2026-07-01): Server-Driven UI (SDUI) for the Admin desktop panel.** SDUI earns its complexity when UI needs to change without a redeploy (native apps gated by app-store review) or one backend serves many heterogeneous clients. Neither applies — this is a single web admin panel for one college's admin team, redeploys are a `git push` to Railway, and scale is ~20-30 faculty. Stick with React + Tailwind + TanStack Query above; do not revisit without a changed scale/deploy constraint.

### Backend

| Tool | Purpose |
|---|---|
| Node.js + Express | Server — monolithic architecture, no microservices |
| Prisma | ORM — all DB access goes through Prisma, no raw SQL except complex reports |
| Zod | Input validation — all API inputs must be validated with Zod schemas |
| Helmet.js | Secure HTTP headers — applied globally |
| express-rate-limit | Brute force protection on OTP and all API routes |
| Morgan + Winston | Morgan for HTTP request logging, Winston for app/error logs |

### Infrastructure

| Layer | Decision |
|---|---|
| Database | PostgreSQL — hosted on Railway |
| Hosting | Railway — both staging and production |
| Auth | Email + password → JWT stored in httpOnly cookie + CSRF token. Every user also has a permanent 4-digit SIMS ID (`1000`–`1099` admin/super_admin, `1100`–`9999` faculty, allocated by an atomic DB counter) usable as an alternative login identifier in place of email — email is now optional, kept for contact and legacy login (see §4 Authentication). **Additionally**, a linked/verified user may log in via a typed 6-digit Telegram OTP code (single-use, 5-minute; enables cross-device login) — see §4 Authentication. (The Telegram magic-link login was removed 2026-07-19 — see §4.) Telegram remains the sole notification channel otherwise |
| Real-time | 30-second polling — no WebSockets, no SSE |
| API style | REST — no GraphQL |
| App structure | Monolithic — single repo, single deploy |
| PWA updates | Optimistic UI on IN/OUT button |
| Reliability | Railway auto-backups + `/health` endpoint + error boundaries |

---

## 3. User Roles & Permissions

There are exactly 3 roles. Do not add, merge, or rename roles.

### Super Admin
- Full unrestricted access to all modules, roles, and data in the system
- Manages Admin accounts (create, deactivate)
- Resets any user's login session or password (including locked accounts) — generates a temporary password, forces a change on next login, and notifies the user via Telegram. Self-service reset via Telegram bot (`/resetpassword`) is also available to any linked user; Super Admin reset is the only path for users without a linked Telegram.
- Views all audit logs across all roles and modules
- Configures system-wide settings
- Can permanently hard-delete any record — the only role that can do this
- Has all Admin permissions

### Admin
- Creates, activates, and deactivates user accounts
- Manages the duty calendar (open/close window, block holidays, set working days, set sessions per faculty)
- Assigns duty slots to faculty who missed the window
- Uploads and manages student Excel data
- Views all duty slots and live attendance dashboard
- Overrides attendance records with a reason
- Reviews and resolves flagged violation records
- Views all violations, can hide records
- Manages violation types
- Reassigns a faculty member's duty slot to another faculty member from the Duty Slots section when the original faculty cannot attend (Admin Duty Reassignment)
- Configures Duty Timing Settings — Morning/Afternoon session start times, late-arrival cutoffs, and auto clock-out times (`/duty-timing-settings`, shared with Super Admin — the only `system_config` fields Admin can edit; other system-wide settings remain Super-Admin-only via `/admin/settings`)
- Access to all 16 reports

### Faculty
- Picks their own duty slots during the open window — the pick is final; a faculty member cannot unpick a slot themselves. Changing a picked slot's owner is only possible via Admin Duty Reassignment or Faculty-Requested Reassignment (§4)
- Checks IN and OUT for their own duty sessions
- Records student violations during their duty
- Requests a duty reassignment directly from a colleague when unable to attend a duty slot — selects an eligible faculty member, who must accept before the duty transfers (Faculty-Requested Reassignment, §4). This is a dedicated request/accept workflow, not the messaging system. Admin can still reassign any duty directly and unilaterally at any time (Admin Duty Reassignment, §4) — the two methods are independent.
- Flags their own violation records for review
- Views own duty history, violations recorded, pending requests
- Can send/receive internal messages — restricted to Admin↔Faculty communication; a faculty
  member cannot message another faculty member directly (`messages.controller.js`
  `sendMessage` enforces this — Admin/Super Admin can message anyone). Faculty-Requested
  Reassignment (§4) is the dedicated peer-to-peer workflow for duty handoffs, separate from
  messaging
- Can reset own password via Telegram bot (`/resetpassword`) if Telegram is linked

---

## 4. Core Business Rules

These are non-negotiable rules encoded in the planning document. Every feature must respect them.

### Authentication
- Login is via registered email/SIMS ID + password, **or** via a typed 6-digit Telegram OTP code
  for users with a linked, verified Telegram account (024-telegram-otp-login) — both methods
  remain fully available side by side; neither replaces the other. The OTP code method
  (user-typed credential) enables cross-device login: a code delivered to Telegram on one device
  can be entered on any other device. See §5 and §6 below for OTP tables and endpoints. The OTP
  login is additive, not a replacement, so password login remains the unbreakable fallback for
  when Telegram is unavailable. See `specs/024-telegram-otp-login/` for the full
  spec/plan/research/contracts.
- **Removed (2026-07-19): Telegram magic-link login** (`GET /auth/telegram/:token`,
  022-telegram-magic-link-login). The single-use link flow, its `/login` bot command, the
  `t.me/<bot>?start=login` deep-link, and the login-page "Log in via Telegram" entry point were
  all removed at the owner's request. Email/SIMS-ID + password and the OTP code are the remaining
  login methods; `TELEGRAM_LOGIN` audit actions are no longer produced. Its backing table,
  `telegram_login_tokens`, was dropped the same day via migration
  `20260719200000_drop_telegram_login_tokens` once confirmed dormant (no writer, no reader) — see
  §5. `specs/022-telegram-magic-link-login/` stays as historical record.
- **SIMS ID login**: every user (and pending invite) also has a permanent 4-digit SIMS ID —
  `1000`–`1099` for admin/super_admin, `1100`–`9999` for faculty — allocated sequentially by an
  atomic `sims_id_counters` row per role series (`server/lib/simsId.js`), assigned at invite
  creation and never reused. `POST /auth/login` accepts either the SIMS ID or the email address
  as the identifier (a bare 4-digit string is treated as a SIMS ID, anything else as email); the
  password check and all other login behavior is unchanged. This makes email optional —
  Telegram-first users (invited without an email address) can still log in and be identified
  purely by SIMS ID. Linked users can recover their SIMS ID any time via `/myid` on the Telegram
  bot.
- Passwords are hashed with bcrypt (cost factor 12) — plaintext is never stored or logged.
- JWT stored in httpOnly cookie — never in localStorage. A CSRF token (`sims_csrf` cookie +
  `X-CSRF-Token` header) is required on every mutating *authenticated* request. **Exception:**
  `POST /auth/login` is exempt from CSRF — it authenticates by credentials, not by an existing
  session, so a stale/expired `sims_token` cookie left over from a previous session must never
  be able to block a fresh login attempt with a CSRF error.
- On any 401 (expired/invalid JWT, revoked session, deactivated/deleted user), the server
  clears both the `sims_token` and `sims_csrf` cookies before responding. `sims_token` is
  httpOnly, so client JS can never clear it itself — recovery from a bad session cookie MUST
  happen server-side, or the user is stuck retrying a login that can never succeed until the
  cookie's 7-day `maxAge` expires.
- `session_version` on the user row is embedded in the JWT and checked on every request.
  Incrementing it (on deactivate, reactivate, delete, role change, or password reset)
  instantly revokes all of that user's existing sessions — this is the forced-logout
  mechanism.
- Audit-log writes (`admin_audit_log`) on login and password-change are best-effort: a
  transient audit-insert failure is logged as a warning but must never fail the login/password
  response, since the cookies (and password hash, for change-password) are already committed
  by that point — the user is genuinely authenticated even if the audit row didn't write.
- New accounts and any admin-reset account are flagged `must_change_password = true` and are
  forced to set a new password via `POST /auth/change-password` before using the rest of the
  system.
- `POST /auth/login` is rate-limited per IP (50 requests / 15 min in production). There is no
  per-account failed-attempt lockout counter — brute-force defense is IP-level rate limiting
  only.
- All routes except `/auth/login` require a valid JWT.
- **Self-service password reset via Telegram**: A linked user can send `/resetpassword` to the
  Telegram bot. This generates a new temporary password, sets `must_change_password = true`,
  increments `session_version` (revoking any existing session), and sends the temporary
  password back via Telegram. Rate-limited to 1 reset per hour per user.
- **Admin-triggered password reset**: Super Admin can trigger a password reset for any user.
  This generates a new temporary password, sets `must_change_password = true`, increments
  `session_version` (revoking any existing session), and notifies the user of the temporary
  password via Telegram — no email, no SMS.
- `session_version` is incremented on self password change (`POST /auth/change-password`),
  self-service bot reset, and admin-triggered reset — the JWT cookie is reissued on self
  change so the user's current session is not invalidated.

### Duty Calendar
- Admin manually opens the scheduling window whenever ready — it does not auto-open.
- Before opening, Admin blocks holidays and sets working days for the month.
- When Admin opens the window, ALL faculty receive an instant Telegram notification.
- Faculty pick their sessions during the open window only.
- Window auto-closes on the last day of the month.
- Admin can also manually close the window early at any time.
- If faculty do not pick slots before window closes, Admin manually assigns their slots.
- Number of sessions per faculty per month is configurable by Admin (default: 3).

### Duty Attendance
- Faculty can only check IN during their assigned duty session window.
- Late IN is flagged automatically based on the Admin-configured, per-session late-arrival cutoff (`system_config` — see Duty Timing Settings, §3 Admin permissions). There is no hardcoded time; session start, late cutoff, and auto clock-out are each independently configurable for Morning and Afternoon.
- If faculty do not check OUT, the system auto-clocks them out at the configured per-session auto clock-out time via cron job — Morning and Afternoon may have different times (e.g. 12:00 PM vs 5:00 PM), evaluated independently.
- A faculty member who has not checked in is shown as "Not checked in" on the live attendance dashboard from that session's configured start time until its auto clock-out — a stageless rule with no separate not-checked-in cutoff (removed 2026-07, see version history).
- Changing a Duty Timing Setting takes effect immediately for future check-ins/clock-outs only — existing `duty_attendance` records are never retroactively recalculated.
- Admin can override any attendance record but must provide a reason.
- Auto-out records are flagged (`auto_out = true`) and visible in reports.

### Violations
- Violations are recorded by Faculty during their duty session.
- Violation types are managed by Admin. The "Others" type is system-locked and cannot be deleted.
- Each violation has a fine amount. Faculty can override the default fine.
- Faculty can mark a violation as "warning only" (no fine).
- Photo attachments are removed from all phases — violations are text-only records.
- Faculty can flag their own violation record for Admin review (replaces correction request module).
- A flagged violation sets `is_flagged = true` on the violation row — no separate table or module.
- Admin reviews and resolves flags from the dedicated Flagged Violations page
  (`/admin/flagged-violations`) only — that page owns `ResolveFlagModal` and calls the
  resolve-flag endpoint. The Student Violations page still shows the Flagged badge and an
  `is_flagged` filter for finding records, but its flagged rows link out to the Flagged
  Violations page ("Review") instead of resolving inline; the Admin Dashboard's old flagged
  detail modal (a third place that duplicated the same resolve/delete actions) was removed
  entirely. One resolve workflow, not three (fixed 2026-07-14 — see
  `specs/001-auth-user-accounts/handoff.md`).
- Admin can delete any violation record; Faculty can delete only violations they personally
  recorded. Deletion is a soft delete (`Violation.deleted_at`) — the deleted record is excluded
  from every read path (lists, dashboards, reports, analytics, counts) but the row is kept,
  consistent with the "all deletes are soft deletes" rule below. Deletion is tracked only in
  `admin_audit_log` (Admin → Audit Logs), not `violation_audit_log` — there is no per-violation
  "Log"/history UI anywhere in the app. (Replaces the earlier Hide action and per-violation
  Audit Log view, removed 2026-07 — see version history.)
- `violation_audit_log` still records created/edited/flagged/flag_resolved changes internally
  for accountability, but has no UI surface — it is not the same log as `admin_audit_log`.

### Duty Reassignment — Two Independent Methods (replaces Need Cover / Volunteer)
There is exactly one concept — **Reassigned Duty** — reachable by two independent
methods. Do not model "extra duty", "additional duty", "volunteer duty", or "admin
assigned duty" as separate concepts. Both methods write to the same
`duty_reassignments` history table (§5), so reports and dashboards never need to
merge two sources of truth.

Shared eligibility rule for **both** methods: only a still-`scheduled` duty slot
whose date has not passed and that has no recorded attendance can be reassigned.

**Method 1 — Admin Duty Reassignment (direct, no approval needed).**
- The Admin manually reassigns any eligible duty from the **Duty Slots** section,
  choosing another faculty member and optionally recording a reason. This is an
  admin-controlled action, not a volunteer/broadcast system — it takes effect
  immediately, with no acceptance step.
- On reassignment the slot's `faculty_id` is updated in place to the new faculty and
  one immutable row is written to `duty_reassignments` (from/to faculty, reason,
  admin as `reassigned_by`, timestamp).
- Both faculty are notified via Telegram when this happens.

**Method 2 — Faculty-Requested Reassignment (peer-to-peer, requires acceptance).**
- A faculty member who cannot attend a duty selects an eligible colleague directly
  from **My Slots** ("Request Reassignment") — never via the messaging system, which
  remains general Admin↔Faculty communication only and plays no role in this
  workflow.
- Eligible colleagues are: active faculty, excluding the requester, excluding anyone
  who already holds a duty at the same date/session.
- This creates a `pending` row in `duty_reassignment_requests`. The target faculty
  is notified via Telegram and sees the request on their dashboard with
  Accept/Reject actions. **No duty changes hands until the target faculty accepts** —
  this is the key difference from Method 1.
- On acceptance: the slot's `faculty_id` transfers (same effect as Method 1), one row
  is written to `duty_reassignments` (`reassigned_by` = the accepting faculty, since
  they are the one whose approval executed the transfer), the request row is marked
  `approved`, and any other still-pending requests for the same slot are
  auto-`declined` (the slot is spoken for). Both faculty are notified via Telegram.
- On rejection: only the request row is marked `declined` — the duty stays with the
  original faculty, who may request a different colleague or use Method 1 via the
  Admin.
- **The requester may cancel their own still-`pending` request** before the target
  faculty responds — the row is marked `cancelled` and the target faculty is
  notified via Telegram. Once a request is `approved`/`declined`/`cancelled` it is
  final; only a fresh request can be sent after that.
- Eligibility (scheduled / not past / no attendance) is re-checked at acceptance
  time as well as at request time, since time may have passed between the two.

### Notifications
- All system notifications (duty window open, duty reassignments, reminders, admin-triggered
  password resets) are sent via Telegram Bot only.
- No email, no SMTP, no SMS — Telegram is the sole notification channel.
- The Faculty-Requested Reassignment notification (Method 2, above) carries inline
  **Accept**/**Reject** buttons so the target faculty can respond directly from Telegram
  without opening the app. Tapping a button routes through the same `respondToRequestCore`
  logic as the in-app PATCH endpoint (`server/controllers/duty-reassignment-requests.controller.js`),
  so eligibility/authorization can never diverge between the two entry points. This is
  currently the only notification with inline buttons — deliberately scoped narrow to limit
  webhook surface area; other notification types remain plain text.
- Telegram is notification-only. It plays no role in login or session issuance (see
  Authentication) — a user with no Telegram linked can still log in with email + password,
  they simply won't receive Telegram notifications.
- The in-app message inbox (`useInbox`, faculty dashboard + Messages page) also polls every
  30 seconds. This is a deliberate UX choice beyond the "live attendance" 30-second-polling
  rationale — confirmed intentional (2026-07) during a perf audit, not scope creep. Noting
  it explicitly here so it isn't flagged again as an unintended over-application of the
  polling pattern.
- **Telegram bot commands beyond password reset**: `/menu` replies with a quick-status inline
  keyboard (My Duty Slots / Next Duty / Scheduling Window Status), routed through
  `handleMenuCallback` (`server/lib/bot.js`). `/myid` replies with the sender's Telegram chat
  ID, for account-linking troubleshooting. Both reply to any incoming message on those exact
  commands, independent of the `/resetpassword` flow (§4 Authentication).

### Students
- Student data is uploaded via Excel. Upsert logic — `registration_number` is the unique key.
- Existing records are updated, new ones created, missing ones deactivated — never deleted, via
  this Excel upload/reconciliation path specifically. This is not a system-wide guarantee: Super
  Admin has a separate, real hard-delete path (`DELETE /students/:id`, `DELETE /students/bulk`;
  blocked if the student has violation records) — the same general Super-Admin hard-delete
  exception as §4 Data & Safety, not a contradiction of the upload path's never-delete rule.
- Failed upload rows are stored in `student_upload_log.errors` (JSONB).
- Students can be promoted to the next semester/year by Admin.

### Data & Safety
- All deletes are soft deletes using `deleted_at` — except Super Admin hard delete.
- **Exception — messages**: a `messages` row is physically deleted when both `deleted_by_sender = true` and `deleted_by_receiver = true`. This is the only non-Super-Admin physical delete permitted in the system. It is intentional: retaining abandoned message rows indefinitely after both parties have dismissed them provides no audit value and would accumulate unbounded storage. The `violation_audit_log` and `admin_audit_log` tables remain fully immutable and are unaffected by this exception.
- All tables use UUID primary keys — never sequential integers.
- All monetary values use `DECIMAL(8,2)` — never floats.
- Every data table has `created_at` **except `system_config`** (single-row; only `updated_at` is tracked, no creation timestamp). Mutable tables also have `updated_at`. Immutable audit/cross-reference tables (`admin_audit_log`, `violation_audit_log`, `duty_reassignments`, `telegram_relink_tokens`, `student_upload_log`) omit `updated_at` by design — rows are never updated after creation. `messages` also has no `updated_at`, but for a different reason: its rows *are* mutated after creation (`is_read`, `read_at`, `deleted_by_sender`, `deleted_by_receiver`) — the omission just means no single last-modified timestamp is tracked, not that the row is immutable.

---

## 5. Database — 18 Tables

All migrations must match this schema exactly. Full column definitions in `SIMS_Database_Schema_v2.1.md`.

| Table | Purpose |
|---|---|
| `users` | All system users — 3 roles: Faculty, Admin, Super Admin. Columns `otp_failed_attempts` (dormant until 024) and `otp_locked_until` (new in 024) support per-account OTP brute-force lockout |
| `students` | Student master data uploaded via Excel |
| `duty_slots` | Monthly duty assignments per faculty |
| `duty_attendance` | Faculty IN/OUT timestamps and status per duty slot |
| `violation_types` | Predefined violation categories (system-locked types cannot be deleted) |
| `violations` | All recorded student violations — includes `is_flagged` for review and photo fields as foundation |
| `violation_audit_log` | Immutable change history scoped to violation records only |
| `admin_audit_log` | Immutable system-level audit trail — session resets, account changes, hard deletes, settings |
| `duty_reassignments` | Reassignment history — from/to faculty, reason, `reassigned_by` (admin or accepting faculty), timestamp. Shared by both reassignment methods (§4) |
| `duty_reassignment_requests` | Faculty-Requested Reassignment (Method 2, §4) — pending/approved/declined requests between faculty; ephemeral workflow state, not history (history lives in `duty_reassignments` once approved) |
| `calendar_config` | Monthly window config — open/close state, blocked holidays, working days, sessions per faculty |
| `messages` | Two-way internal messaging between users |
| `system_config` | Single-row system-wide timing thresholds — session start, late detection, and auto clock-out (each per Morning/Afternoon session) |
| `photo_access_log` | ⚠ Foundation placeholder — not active in Phase 1 |
| `student_upload_log` | History of Excel uploads including error rows |
| `pending_invites` | Temporary invite tokens for new account activation via Telegram |
| `telegram_relink_tokens` | Temporary tokens for relinking an existing user to a new Telegram account |
| `otp_login_codes` | Single-use, 5-minute code-entry OTP login tokens (024-telegram-otp-login). No `deleted_at` — rows persist, `used_at` is the only mutation, no purge job. Code is bcrypt-hashed, not fast-hash (1M keyspace does not survive SHA-256) |
| `sims_id_counters` | Two rows (`admin`, `faculty`) — atomic `last_value` counters backing SIMS ID allocation on `users.sims_id` / `pending_invites.sims_id`. No FK to either table; purely a sequence generator |

> **Removed**: `correction_requests` (replaced by `violations.is_flagged`), `reschedule_requests` then `cover_requests` (the Need Cover / Volunteer workflow was built and then removed in favor of Admin Duty Reassignment — `duty_reassignments`, see §4), `otp_sessions` (Telegram OTP login was built and then abandoned in 2026-05, then rebuilt in 2026-07 as `otp_login_codes` with bcrypt hashing — see §4 Authentication and §3.19 version history), `telegram_login_tokens` (backed the magic-link login, 022 — feature removed 2026-07-19, table dropped the same day via migration `20260719200000_drop_telegram_login_tokens` — see §4 Authentication and §3.20/§3.21 version history)

### Key Schema Rules
- `admin_audit_log` — system-level actions only (password resets, account changes, hard deletes). Never mix with `violation_audit_log`
- `violations.is_flagged` — set by Faculty to request Admin review; resolved via `flag_resolved_by` + `flag_resolved_at`
- `violations.deleted_at` — soft-delete for the Delete action (§4 Violations); excluded from every read path across controllers, not just a display filter
- `violations.photo_path` / `violations.photo_expires_at` — foundation columns, not used in Phase 1
- `violations.record_status` — vestigial, same category as the photo columns above: the Hide action that used to write `hidden` here was removed (§4 Violations, replaced by Delete). No write path sets it to anything but the Prisma default (`active`) anymore, though several read paths still filter on it — kept rather than dropped since removing the column needs an accompanying migration
- `messages` — a faculty member cannot message another faculty member; only Admin↔Faculty and Admin↔Admin/Super Admin are permitted (`messages.controller.js` `sendMessage`, §3 Faculty)
- `duty_reassignments` — append-only history; the current owner of a slot is always `duty_slots.faculty_id`, and the latest reassignment row (if any) describes who it was moved from and by whom. Written by both reassignment methods (§4) — `reassigned_by` is the admin for Method 1, the accepting faculty for Method 2
- `duty_reassignment_requests` — mutable workflow state (`pending` → `approved`/`declined`/`cancelled`), not history. `status` is a plain string, not an enum, matching the Prisma model. Accepting one request auto-declines any other pending requests for the same `duty_slot_id`. `cancelled` is set only by the original requester, only while still `pending`
- `violation_types.is_system` — prevents deletion of built-in types
- `student_upload_log.errors` — JSONB array of failed rows with reason
- `calendar_config.working_days` — JSONB array of working days set by Admin before opening window
- `users.email` / `pending_invites.email` are now nullable (previously `NOT NULL @unique`) — `users.sims_id` / `pending_invites.sims_id` (`Int @unique`, range-checked by role via a DB `CHECK` constraint) are the new mandatory identifier. Migration `20260715103000_add_sims_id_series` backfilled existing rows in creation order and stops with an error rather than silently overflowing if a role's 100/8900-slot range is already exhausted
- `system_config` timing fields are session-scoped by naming convention (`{concept}_{morning,afternoon}_{hour,min}`) — there is no shared/default fallback field for any timing concept. Ordering (`session_start < late_threshold ≤ auto_checkout`, per session) is enforced at the application layer via `settingsService.findOrderingViolation`, not as a DB constraint — shared by every write path onto these fields (`PATCH /duty-timing-settings` and `PATCH /admin/settings`) so neither can write out-of-order values; any new code path that writes to `system_config` timing fields directly (bypassing this check) would skip it

---

## 6. API — 117 Endpoints Across 14 Modules

Counts verified directly against `server/routes/*.routes.js`. The Need Cover module (9 endpoints under `/cover-requests`) was removed; Duty Slots grew from 6 to 8 with the admin reassignment endpoints (`POST /duty-slots/:id/reassign`, `GET /duty-slots/reassigned-away/:year/:month`), then dropped to 7 when `DELETE /duty-slots/:id/unpick` was removed (P26 — faculty can no longer unpick a picked slot; Admin Duty Reassignment or Faculty-Requested Reassignment are now the only ways to change a picked slot's owner). Two modules were added since: Analytics (P24 Student Discipline Analytics Dashboard) and Duty Reassignment Requests (P27 Faculty-Requested Reassignment, §4 Method 2). Violations dropped from 10 to 9 endpoints (2026-07): `PATCH /:id/hide` and `GET /:id/audit-log` were removed (Hide and the per-violation Log view no longer exist anywhere in the app) and `DELETE /:id` was added (soft-delete, §4 Violations). Authentication grew 4→6 with OTP code-entry login endpoints (024-telegram-otp-login).

| Module | Count | Base Path |
|---|---|---|
| Authentication | 5 | `/auth` |
| Users & Accounts | 13 | `/users`, `/admin` |
| Students | 10 | `/students` |
| Duty Calendar | 8 | `/calendar` |
| Duty Slots | 7 | `/duty-slots` |
| Duty Attendance | 6 | `/attendance` |
| Duty Timing Settings | 2 | `/duty-timing-settings` |
| Violations | 9 | `/violations` |
| Violation Types | 6 | `/violation-types` |
| Messages | 6 | `/messages` |
| Invites | 4 | `/invites` |
| Reports | 24 | `/reports` |
| Analytics | 10 | `/analytics` |
| Duty Reassignment Requests | 6 | `/duty-reassignment-requests` |

Three module counts above were previously wrong, undercounting real endpoints that existed but were never folded into any changelog entry: **Duty Attendance 5→6** (`GET /attendance/mine/summary`, the personalized faculty attendance-dashboard endpoint), **Violation Types 5→6** (`PATCH /violation-types/:id/reactivate`), and **Reports 22→24** (below). **Users & Accounts** is unchanged at 13 here — it already reflects the `PATCH /admin/settings` restoration from v3.13.

Reports is 24 endpoints, not 22: two pre-existing JSON display routes, `GET /reports/student-violations/daily/:date` and `GET /reports/student-violations/weekly`, predate P28 and were never folded into any prior count in this file. Growth 17→24 overall: the Student Violation Report gained a `format=pdf`-equivalent sibling route (`GET /reports/student-violations/pdf`) alongside its existing `/export` (.xlsx), and the Daily and Weekly variants each gained their own `/export` (.xlsx) and `/pdf` routes (`GET /reports/student-violations/daily/:date/export`, `/daily/:date/pdf`, `/weekly/export`, `/weekly/pdf`) — fixing a bug where Daily/Weekly "Excel" downloads previously pointed at the JSON display endpoints and saved a corrupt file. All Student Violation Report exports (Excel and PDF, all five periods) exclude Fine Amount — the report is a discipline-tracking tool, not a financial one; fine amounts remain in the unrelated Pending Fines report.

Analytics (10): `GET /summary`, `/trend`, `/violation-types`, `/repeat-violators`, `/course-analysis`, `/year-analysis`, `/faculty-analysis`, `/heatmap`, `/export/counselling`, `/filter-options` — admin/super_admin only, backs the Student Discipline Analytics Dashboard (all 3 phases now built: summary/filters/repeat-violators, trend+course+year charts, faculty analysis + heatmap + Excel export; see `specs/004-student-analytics-dashboard/handoff.md`).

Duty Reassignment Requests (6): `POST /`, `GET /`, `GET /sent`, `GET /eligible-faculty/:dutySlotId`, `PATCH /:id`, `PATCH /:id/cancel` — faculty only. Implements Method 2 of §4 Duty Reassignment. `PATCH /:id/cancel` lets the requester withdraw their own still-pending request (distinct from `PATCH /:id`, which is the target faculty approving/declining).

Not counted above: `POST /bot/webhook/:secret` (`server/routes/bot.routes.js`) — a Telegram-facing webhook receiver, not part of the client-facing API surface this table describes.

**Authentication** is 5 endpoints: `POST /auth/login`, `/change-password`, `/logout`, and the OTP
pair `POST /auth/otp/request` + `POST /auth/otp/verify` (024-telegram-otp-login). The magic-link
endpoint `GET /auth/telegram/:token` (022-telegram-magic-link-login) was **removed 2026-07-19**
(§4), dropping the module 6→5 and the overall total 119→118.

Full endpoint definitions in `SIMS_API_Endpoints_v2.0.md` (v2.2) — **this file is now stale against the counts above and should be regenerated/updated to match.**

All endpoints return JSON. All errors follow the format:
```json
{ "error": true, "code": "ERROR_CODE", "message": "Human-readable message" }
```

---

## 7. Project Structure

Follow this folder structure exactly. Do not reorganise without updating this file.

```
/
├── client/                   # React frontend (Vite + Tailwind + TanStack Query)
│   ├── src/
│   │   ├── pages/            # One folder per role
│   │   ├── components/       # Shared UI components
│   │   ├── hooks/            # TanStack Query hooks
│   │   ├── utils/            # Utilities, constants
│   │   └── main.jsx
│   └── public/
│
├── server/                   # Node.js + Express backend
│   ├── routes/               # One file per module
│   ├── controllers/          # Business logic
│   ├── services/             # Reusable service functions
│   ├── middleware/           # Auth, validation (Zod), rate limit
│   ├── lib/                  # Telegram bot, cron jobs, helpers
│   └── index.js
│
├── prisma/                   # Prisma at root — CLI default, easier for migrations
│   ├── schema.prisma         # Single source of truth for DB schema
│   └── migrations/
│
├── db/                       # Seed data and setup scripts
├── specs/                    # Spec Kit — one spec per feature/week
├── CONSTITUTION.md           # This file — always read first
└── CLAUDE.md                 # Claude Code steering file
```

---

## 8. Development Phases

### Phase 1 — MVP (Weeks 1–4) ✅ Built
Auth, user accounts, students, duty calendar, slot picking, IN/OUT attendance, core violations.

### Phase 2 — Core Complete (Weeks 5–8) ✅ Built
Cover requests (Need Cover broadcast — later removed in favor of Admin Duty Reassignment, see §4), violation flags + audit trail, messaging, Super Admin panel.

### Phase 3 — Full System (Weeks 9–12) ✅ Built ← CURRENT (QA/UAT)
All 16 reports, role-based dashboards, Telegram notifications, PWA polish. Remaining before production launch: UAT with staff, production sign-off.

All three phases are functionally implemented in code (verified 2026-07: 24 report endpoints, Super Admin panel, PWA/Workbox config, and all 4 cron jobs (§9) are present and passing tests). "Built" here means the code exists and is tested — it does not by itself mean UAT/staff sign-off has happened. Update this line to "Launched" once production UAT is signed off.

---

## 9. Cron Jobs Required

These must be implemented by end of Phase 1 for the system to function correctly.

| Job | Schedule | Action |
|---|---|---|
| Auto clock-out | Every 10 minutes | For each session (Morning/Afternoon) whose Admin-configured auto clock-out time has passed, set `out_time`, `auto_out = true` for any unchecked-out faculty in that session — each session evaluated independently against its own configured time (see Duty Timing Settings, §3 Admin permissions) |
| No-show → absent | Every 10 minutes — runs at the end of the same tick as Auto clock-out (`markNoShowAbsent`, `server/lib/cron.js`), not a separate schedule | For each still-`scheduled` duty slot with no recorded attendance, once that session's auto clock-out time has passed: creates a `duty_attendance` row (`in_status = 'absent'`) and sets `duty_slots.status = 'absent'`. This is the sole path that produces absent records — reports and analytics depend on it |
| Calendar auto-close | 23:55 IST daily | Set `is_window_open = false` on the last day of the month |
| Daily Duty Digest | 08:00 IST daily | Sends one consolidated Telegram message per faculty member holding a scheduled duty slot that day, listing their session(s) (Morning/Afternoon/both) — a same-day heads-up ahead of the admin-configured session start time (`sendDailyDutyDigest`, `server/lib/cron.js`) |

> The former hourly **Cover request expiry** job was removed together with the Need Cover / Volunteer workflow (see §4 Admin Duty Reassignment).

---

## 10. What Claude Code Must Never Do

- Never use localStorage or sessionStorage for auth tokens — httpOnly cookie only
- Never use sequential integer IDs — UUID only
- Never use floats for money — DECIMAL(8,2) only
- Never physically delete records unless the caller is Super Admin using the hard-delete endpoint
- Never bypass Zod validation on any API input
- Never add a new table or column to the database without checking this constitution first
- Never use `console.log` in production code — use Winston logger
- Never expose the JWT secret, Telegram bot token, or database URL in code or comments
- Never create a new role or modify role names — system has exactly 3 roles: Super Admin, Admin, Faculty
- Never change the folder structure without explicit instruction
- Never hardcode a time-of-day threshold (session start, late cutoff, not-checked-in cutoff, auto clock-out) in application code — always read it from `system_config` via `settingsService.getSettings()`. This is exactly the anti-pattern the Duty Timing Settings feature (§3 Admin permissions, §4 Duty Attendance) was built to eliminate; reintroducing a hardcoded value in a new code path defeats it silently

---

## 11. Environment Variables Required

```
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=7d
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
NODE_ENV=development|production
PORT=3000
```

---

*Constitution version: 3.21 — Updated: July 2026 (**Dropped `telegram_login_tokens` table** — the
table backing the magic-link login (022, removed in v3.20 below) had been left dormant with no
writer or reader since that removal; migration `20260719200000_drop_telegram_login_tokens`
(`DROP TABLE IF EXISTS "telegram_login_tokens"`) retires it for good, same day as the code
removal. No other table has a foreign key into it, so this is a leaf-table removal with no
cascading impact. §5: total tables 19→18, `telegram_login_tokens` moved from the main table list
into the `> **Removed**` summary line. Prisma Client regenerated; server test suite unaffected
(143 passing). Password login and the Telegram OTP code-entry login (024, `otp_login_codes`) are
completely unaffected.)*
*Constitution version: 3.20 — Updated: July 2026 (**Removed Telegram magic-link login** —
022-telegram-magic-link-login. §2 Infrastructure, §4 Authentication, §5, §6: deleted the
`GET /auth/telegram/:token` endpoint + `telegramLogin` controller + its rate limiter and Zod
param schema, the `/login` (and `/start login` deep-link) bot command and `handleLoginRequest`
token issuer, and the login page's "Log in via Telegram" button + `telegram_error` banner. No
schema migration: the `telegram_login_tokens` table is retained but now dormant (no writer/reader)
pending a later drop. Password / SIMS-ID + password and the 6-digit OTP code (024) are the
remaining login methods; `TELEGRAM_LOGIN` audit actions are no longer produced. Authentication
module 6→5, total 119→118. Removed the 8 `telegramLogin` unit tests (server suite 151→143, still
green). Owner-requested; `specs/022-telegram-magic-link-login/` kept as historical record. Both
password and OTP logins are fully intact — this removes a redundant third method, it does not
weaken the password fallback.)*
*Constitution version: 3.19 — Updated: July 2026 (Telegram OTP code-entry login —
024-telegram-otp-login. §2 Infrastructure, §4 Authentication: a linked/verified user may now
log in via a typed 6-digit OTP code delivered to Telegram, enabling cross-device login (code
sent to phone can be entered on desktop), additive alongside password and magic-link logins —
neither is replaced. New table `otp_login_codes` (§5) mirrors `telegram_login_tokens`'s
single-use lifecycle, no `deleted_at`, with bcrypt-hashed code (not fast-hash — 1M possible
values in keyspace). New column `users.otp_locked_until` enforces per-account brute-force
protection: 5 failed code attempts lock the account for 15 minutes, self-healing cool-off, no
manual unlock. Two new endpoints `POST /auth/otp/request` and `POST /auth/otp/verify` (§6,
Authentication module 6→8, total 117→119). This reverses an earlier §4 sentence "No Telegram
OTP (the code-entry kind)" — the project previously abandoned an OTP table (`otp_sessions`) in
2026-05, then owner-requested a rebuild of the feature in 2026-07 for the cross-device gap the
magic link cannot fill. Both password and magic-link logins remain fully intact — this is
additive, not a replacement, preserving the unbreakable fallback when Telegram is unavailable.
See `specs/024-telegram-otp-login/` for the full spec, plan, research, data-model, and
contracts.)*
*Constitution version: 3.18 — Updated: July 2026 (SIMS Short ID series — §2 Infrastructure, §4
Authentication: every user/pending-invite gains a permanent 4-digit SIMS ID (`1000`–`1099`
admin/super_admin, `1100`–`9999` faculty), allocated by an atomic per-role counter
(`server/lib/simsId.js`, new `sims_id_counters` table). `POST /auth/login` now accepts a bare
4-digit SIMS ID or an email as the login identifier; `users.email`/`pending_invites.email` become
nullable so Telegram-first users can be invited and onboarded without an email address at all.
Existing email+password login is unchanged and still fully supported — this is additive, not a
replacement. Telegram activation/password-reset messages now show the SIMS ID, and linked users
can recover it via `/myid`. Does not touch the Telegram magic-link login (022) — both remain
available side by side. §5: new `sims_id_counters` table, total 17→18. No new endpoints (§6
Authentication stays at 4). See `SIMS_ID_IMPLEMENTATION.md` for the full number-range/deployment
notes.)*
*Constitution version: 3.17 — Updated: July 2026 (Telegram magic-link login —
022-telegram-magic-link-login. §2 Infrastructure, §4 Authentication: a linked/verified user may
now log in via a single-use, 10-minute Telegram link, issuing the identical httpOnly-cookie
JWT+CSRF session as password login, side by side with it — password login is unchanged and not
replaced. New table `telegram_login_tokens` (§5) mirrors `telegram_relink_tokens`'s lifecycle, no
`deleted_at`. New endpoint `GET /auth/telegram/:token` (§6, Authentication module 3→4, total
114→115). This deliberately reopens a decision an earlier version of this constitution recorded
as settled — the project previously built and abandoned a Telegram-OTP login table
(`otp_sessions`) in favor of password-only auth. That earlier decision was about a code-entry OTP
mechanism and a full replacement of password login; this feature is a single-use link, additive
only, and was explicitly requested and approved by the project owner before any spec work began —
not a silent reversal. See `specs/022-telegram-magic-link-login/` for the full spec, plan,
research, and contracts.)*
*Constitution version: 3.16 — Updated: July 2026 (login-flakiness fix + duplicate-feature
cleanup, no schema/endpoint changes. §4 Authentication: `POST /auth/login` is now CSRF-exempt
(a stale `sims_token` cookie could previously 403-block every login attempt); `authenticate`
middleware now clears both session cookies on any 401 instead of leaving a client-unreachable
httpOnly cookie behind; login/change-password audit-log writes are now best-effort so a
transient audit-insert error can no longer fail an otherwise-successful auth response. §4
Violations: flag resolution consolidated to the Flagged Violations page only — removed the
duplicate resolve flow from the Student Violations page and the Admin Dashboard's flagged
detail modal (which also duplicated Active Faculty and Reassignments detail modals, both also
removed in favor of linking to the Live Attendance and Reports pages). Faculty Dashboard's
embedded full violations table replaced with a summary + link; faculty Attendance page's
duplicate check-in/out buttons removed (check-in/out now lives only on the Dashboard). Several
sidebar/bottom-tab labels unified with their page titles (Student Violations, Violation Types,
Live Attendance) — see `specs/001-auth-user-accounts/handoff.md` (2026-07-14) for full detail.)*
*Constitution version: 3.15 — Updated: July 2026 (documentation-accuracy pass — no code changes. §9: added the previously-undocumented No-show → absent job (`markNoShowAbsent`, runs inside the same 10-min Auto clock-out tick) and Daily Duty Digest cron (08:00 IST). §4 Notifications: added the `/menu` and `/myid` Telegram bot commands. §6: corrected 3 wrong module counts — Duty Attendance 5→6, Violation Types 5→6, Reports 22→24 — total 110→114. §3/§5: documented the existing admin↔faculty-only messaging restriction (faculty cannot message other faculty). §5: flagged `violations.record_status` as vestigial dead weight (same category as the `photo_path` columns); corrected the blanket "every table has `created_at`" claim (`system_config` doesn't); corrected the false claim that `messages` omits `updated_at` because it's never mutated (it is — `is_read`, `read_at`, `deleted_by_sender`, `deleted_by_receiver` all change post-creation). §4 Students: clarified the "never deleted" claim is scoped to the Excel upload/reconciliation path, not a system-wide guarantee — Super Admin hard-delete is a real, separate exception. §8: fixed the Phase 3 verification note's stale counts (17→24 report endpoints, "3 required cron jobs"→4, matching the corrected §6/§9 figures above) — the "verified 2026-07" qualifier itself is still accurate and was left as-is.)*
*Constitution version: 3.14 — Updated: July 2026 (`PATCH /admin/settings` now enforces the same `session_start < late_threshold ≤ auto_checkout` ordering invariant as `PATCH /duty-timing-settings` — the check was extracted out of `duty-timing-settings.controller.js` into `settingsService.findOrderingViolation`, a single shared function both endpoints call, so the two can't drift apart on this rule again — §5)*
*Constitution version: 3.13 — Updated: July 2026 (restored `PATCH /admin/settings`, silently dropped in commit `42c2edb` as unrelated collateral damage — this file's own §3 line already claimed it existed. Re-registered Super-Admin-only, validated against the current `SystemConfig` shape via the existing `duty-timing-settings.schema.js` schema, since the original `settings.schema.js` it used to validate against had already gone stale — one of its fields, `auto_checkout_hour`/`auto_checkout_min`, stopped being real columns once auto-checkout was split per-session — and was deleted outright a day later. §6, Users & Accounts module 12→13 endpoints, total 109→110)*
*Constitution version: 3.12 — Updated: July 2026 (Faculty-Requested Reassignment gained requester-side cancel — `PATCH /duty-reassignment-requests/:id/cancel` lets the original requester withdraw their own still-`pending` sent request, distinct from the target faculty's existing approve/decline via `PATCH /:id`; target faculty notified via Telegram; `duty_reassignment_requests.status` gains a fourth value, `cancelled` — §4, §5, §6, Duty Reassignment Requests module 5→6 endpoints, total 108→109)*
*Constitution version: 3.11 — Updated: July 2026 (Faculty-Requested Reassignment notification gained inline Accept/Reject Telegram buttons, routed through the shared `respondToRequestCore` — §4 Notifications; `server/lib/telegram.js` gained `reply_markup` support plus `answerCallbackQuery`/`editMessageReplyMarkup`; `server/lib/bot.js` webhook now handles `callback_query` payloads. No new endpoints, no schema changes.)*
*Constitution version: 3.10 — Updated: July 2026 (Violation Delete + Flagged Review workflow — §4 Violations: replaced the Hide action and per-violation Log/Audit view with Delete (soft delete via `violations.deleted_at`, excluded from every read path); Admin can delete any violation, Faculty only their own; deletion tracked in `admin_audit_log` only. The Flagged Student Violations dashboard card gained a configurable show-count (3/5/10/20) and its review popup gained registration number/course/duty date detail plus a Delete action alongside the existing Mark as Reviewed. Added `users.title` / `pending_invites.title` (salutation shown in dashboard greetings, distinct from `designation`). Added an S.No column to the faculty Student Violations table and to the Student Violation Report's Excel/PDF exports — §5, §6, Violations module 10→9 endpoints, total 109→108)*
*Constitution version: 3.9 — Updated: July 2026 (P28 Enhanced Reports System — added PDF export via `pdfkit` alongside the existing Excel export for the Student Violation Report's five period variants (daily/weekly/monthly/yearly/overall); fixed a bug where Daily/Weekly "Excel" downloads saved a corrupt JSON-as-xlsx file; added Course/Academic Year/Violation Type/Faculty filters to the Student Violation Report, applied consistently across all five periods; closed a pre-existing gap where the Daily/Weekly report routes had no Zod query validation — §6, Reports module 17→22 endpoints, total 104→109)*
*Constitution version: 3.8 — Updated: July 2026 (removed faculty slot-unpick entirely — `DELETE /duty-slots/:id/unpick` and its UI dropped; a picked slot is now final and can only change owner via Admin Duty Reassignment or Faculty-Requested Reassignment, §3, §4, §6; Duty Slots module 8→7 endpoints, total 105→104)*
*Constitution version: 3.7 — Updated: July 2026 (dropped the unused `Student.section` column entirely — Year/Semester were already independent fields everywhere in the UI; removed the not-checked-in cutoff concept from Duty Timing Settings — §3, §4, §5 — a not-yet-checked-in faculty member now always shows "Not checked in" from session start to auto clock-out, no separate time-gated stage)*
*Constitution version: 3.6 — Updated: July 2026 (§6 Analytics module grew 5→10 endpoints as P24 Phases 2–3 were built — trend/course/year charts, faculty analysis, calendar heatmap, counselling-list Excel export; total 100→105)*
*Constitution version: 3.5 — Updated: July 2026 (added Faculty-Requested Reassignment as Method 2 alongside Admin Duty Reassignment — §3, §4, §5, §6; added `duty_reassignment_requests` table; added the Analytics module to §6, previously undocumented)*
*All decisions in this file were confirmed by the project owner across planning sessions.*
*Do not modify this file without project owner approval.*
