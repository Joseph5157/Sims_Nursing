# SIMS DMS — API Endpoint Reference
**SIMS College of Pharmacy — Discipline Management System**
Version 2.2 | REST API | Node.js + Express | JWT Auth

> **Cloning this system for another department?** The endpoint shapes, roles, and
> business rules below are identical for any department — only the institution
> name/branding differ (see `deploy/clone-checklist.md`). Update the title line
> above and this changelog's institution references in your cloned copy; leave
> this file as-is for the Pharmacy production instance.

> **Changes from v1.0:**
> - Coordinator role removed — all Coordinator access merged into Admin
> - Module 9 rewritten: Reschedule Requests → Need Cover broadcast
> - Module 10 (Correction Requests) removed — replaced by `violations.is_flagged` flag endpoints in Module 7
> - Photo endpoint kept in Module 7 as foundation for v2 — not implemented in Phase 1
> - Self-registration removed — Admin creates accounts directly (`POST /users`). `POST /users/register`, `GET /users/pending`, `PATCH /users/:id/approve` removed.

> **Changes from v2.0 (2026-07-03 — synced against a full code audit):**
> - Module 1 (Authentication) corrected: the account model changed again after v2.0 was
>   written. Login is now email + password (`POST /auth/login`, `POST /auth/change-password`),
>   not Telegram OTP. `POST /auth/request-otp` and `POST /auth/verify-otp` never existed in
>   the current auth model and are removed from this doc.
> - `POST /users` (direct account creation, described in v2.0's own changelog above) was
>   itself later retired — it now returns `410 GONE`/`404`. The real, current creation path is
>   the new **Module 11 — Invites**, added below. v2.0's premise ("Admin creates accounts
>   directly") is superseded; account creation is invite + Telegram-activation based.
> - Added **Module 11 — Invites** (4 endpoints) and **Module 12 — Reports** (17 endpoints) —
>   both existed in the live codebase but were never documented.
> - Added several endpoints that existed in code but were missing from Modules 2–3, 4, 9, 10
>   (see each module's notes below).
> - Corrected the summary table: the v2.0 body said "63 endpoints" while its own summary
>   table header said "66" — both were wrong. See the corrected summary at the bottom.
> - **2026-07-03, same day**: removed `DELETE /cover-requests/:id` and
>   `POST /cover-requests/:id/reject-volunteer` — confirmed duplicates of
>   `PATCH /:id/cancel` and `PATCH /:id/reject` respectively (same controller function,
>   unused by the frontend). Total corrected 97 → 95.

> **Changes from v2.2 (2026-07-14 — login-flakiness fix):**
> - `POST /auth/login` marked CSRF-exempt in Module 1 — a stale `sims_token` cookie could
>   previously 403-block every login attempt (the double-submit CSRF check ran even though
>   login isn't an authenticated-session action). No endpoint added/removed; behavior-only fix.
> - `authenticate` middleware now clears `sims_token`/`sims_csrf` on every 401 instead of
>   leaving them for the client (which cannot clear the httpOnly `sims_token` itself).
> - Login/change-password audit logging (`admin_audit_log`) is now best-effort — no longer
>   fails the auth response on a transient audit-insert error.
> - See `specs/001-auth-user-accounts/handoff.md` (2026-07-14) for full detail.

---

## Legend & Global Rules

- All endpoints require JWT in httpOnly cookie unless marked **Public**
- `:id` = UUID
- All responses return JSON
- All errors: `{ "error": true, "code": "ERROR_CODE", "message": "..." }`

**Roles**: Super Admin · Admin · Faculty · All Auth

---

## Module 1 — Authentication (3 endpoints)

> Email + password login. JWT + CSRF token issued and stored in httpOnly cookies on success.
> Telegram plays no role in login — see Module 11 for how Telegram is used (account
> activation) and Module 2 for the Super Admin password-reset notification channel.
>
> **Login is CSRF-exempt** (2026-07-14 fix) — it authenticates by credentials, not by an
> existing session, so a stale `sims_token` cookie from a previous session can never 403-block
> a fresh login. Any 401 from `authenticate` middleware (expired JWT, revoked session) clears
> both auth cookies server-side, since `sims_token` is httpOnly and client JS cannot clear it.
> Audit-log writes on login/change-password are best-effort — a transient audit-insert failure
> no longer fails an otherwise-successful login or password change.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /auth/login | Public (CSRF-exempt) | Authenticate with email + password → issue JWT + CSRF cookies |
| POST | /auth/change-password | All Auth | Change own password (skips current-password check on first-time set) |
| POST | /auth/logout | All Auth | Clear JWT + CSRF cookies and invalidate session |

---

## Module 2 — Users & Accounts (10 endpoints)

> Accounts are **not** created directly through this module — see Module 11 (Invites). This
> module covers session/profile lookup, listing, deactivation/reactivation, and Super
> Admin-level account operations. `POST /users`, `GET /users/pending`, and
> `POST /users/:id/regenerate-invite` (documented in v2.0) are retired and return `404`.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /users/me | All Auth | Get the current authenticated user's own profile |
| GET | /users | Admin | List all users with filters (role, status, dept) |
| GET | /users/:id | All Auth | Get a single user profile |
| PATCH | /users/:id/profile | All Auth | Update own profile (name, phone, dept) |
| PATCH | /users/:id/deactivate | Admin | Deactivate an active user account (cannot deactivate self or a Super Admin) |
| PATCH | /users/:id/reactivate | Admin | Reactivate a deactivated user account |
| DELETE | /users/:id | Super Admin | Soft-delete a user (`deleted_at` set) — distinct from the permanent hard-delete below |
| GET | /admin/audit-logs | Super Admin | View all system audit logs |
| POST | /admin/users/:id/reset-login | Super Admin | Reset a user's password — generates a temp password, forces change on next login, notifies via Telegram (cannot target a Super Admin) |
| DELETE | /admin/hard-delete/:resource/:id | Super Admin | Permanently delete any record by resource type and ID |
| GET | /admin/settings | Super Admin | View system-wide configuration |
| PATCH | /admin/settings | Super Admin | Update system-wide configuration |

---

## Module 3 — Students (10 endpoints)

> Excel upload uses upsert logic — `registration_number` is the unique key. Existing records updated, new ones created, missing ones deactivated.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /students/upload | Admin | Upload student Excel file (upsert by reg. number) |
| GET | /students/upload-template | Admin | Download the expected Excel upload template |
| GET | /students/upload-logs | Admin | View history of all Excel uploads including error rows |
| GET | /students | Admin | List all students with filters (course, year, status) |
| GET | /students/:id | Admin | Get a single student record |
| GET | /students/search | All Auth | Search students by name or reg. number (violation form autocomplete) |
| PATCH | /students/bulk/promote | Admin | Bulk-promote multiple students to the next semester/year in one request |
| PATCH | /students/bulk/deactivate | Admin | Bulk-deactivate multiple student records in one request |
| PATCH | /students/:id/promote | Admin | Promote a single student to next semester or year |
| PATCH | /students/:id/deactivate | Admin | Deactivate a single student record |

---

## Module 4 — Duty Calendar (8 endpoints)

> Admin manually controls the scheduling window. Faculty notified via Telegram when window opens. Window auto-closes on last day of month or Admin closes early.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /calendar/:year/:month | All Auth | Get calendar config (blocked dates, window status, sessions per faculty) |
| POST | /calendar/:year/:month/open | Admin | Open the scheduling window — triggers Telegram notification to all faculty |
| POST | /calendar/:year/:month/close | Admin | Manually close the scheduling window early |
| PATCH | /calendar/:year/:month/blocked-dates | Admin | Update blocked holiday dates for the month |
| PATCH | /calendar/:year/:month/working-days | Admin | Set which days of the month are working days, before opening the window |
| PATCH | /calendar/:year/:month/sessions-per-faculty | Admin | Set how many sessions each faculty must pick this month |
| GET | /calendar/:year/:month/unassigned-faculty | Admin | List faculty who have not picked their slots after window closes |
| POST | /calendar/:year/:month/assign/:facultyId | Admin | Admin manually assigns slots to a faculty who missed the window |

---

## Module 5 — Duty Slots (6 endpoints)

> Faculty can only pick slots while the calendar window is open. Admin can assign at any time.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /duty-slots/:year/:month | All Auth | Get all duty slots for a month (Admin sees all; Faculty sees own) |
| GET | /duty-slots/available/:year/:month | Faculty | Get available (unpicked) slots for the open window |
| POST | /duty-slots/pick | Faculty | Faculty picks a duty slot during open window |
| DELETE | /duty-slots/:id/unpick | Faculty | Faculty unpicks a slot (only while window is still open) |
| POST | /duty-slots/admin-assign | Admin | Admin assigns a specific slot to a specific faculty |
| GET | /duty-slots/:id | All Auth | Get details of a single duty slot |

---

## Module 6 — Duty Attendance (5 endpoints)

> Faculty check IN and OUT via the app. System auto-clocks out at 4:30 PM. Late IN flagged automatically. Admin can override records.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /attendance/:dutySlotId/check-in | Faculty | Faculty clocks in for their duty slot |
| POST | /attendance/:dutySlotId/check-out | Faculty | Faculty clocks out of their duty slot |
| GET | /attendance/live | Admin | Real-time IN/OUT status of all faculty on duty today (polling) |
| GET | /attendance/:dutySlotId | All Auth | Get attendance record for a specific duty slot |
| PATCH | /attendance/:dutySlotId/override | Admin | Override an attendance record with reason |

---

## Module 7 — Violations (10 endpoints)

> Faculty record violations during their duty slot. Faculty can flag their own records for Admin review. Photo endpoint is a foundation placeholder — not implemented in Phase 1.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /violations | Faculty | Record a new student violation |
| GET | /violations | Admin | List all violations with filters (student, faculty, date, type, status) |
| GET | /violations/my | Faculty | Faculty views their own recorded violations |
| GET | /violations/:id | All Auth | Get a single violation record |
| PATCH | /violations/:id | Faculty | Edit own violation record (only before flag is submitted) |
| PATCH | /violations/:id/hide | Admin | Hide a violation record from standard views |
| PATCH | /violations/:id/flag | Faculty | Flag own violation record for Admin review (sets is_flagged = true) |
| PATCH | /violations/:id/resolve-flag | Admin | Resolve a flagged violation with a note (logged in audit log) |
| GET | /violations/:id/photo | Admin | ⚠ Foundation only — not implemented in Phase 1 |
| GET | /violations/:id/audit-log | Admin | View full change history for a violation |

---

## Module 8 — Violation Types (5 endpoints)

> System-locked types (e.g. 'Others') cannot be deleted — `is_system = true` protects them.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /violation-types | All Auth | List all active violation types |
| POST | /violation-types | Admin | Create a new violation type with default fine |
| PATCH | /violation-types/:id | Admin | Update a violation type name or default fine |
| PATCH | /violation-types/:id/deactivate | Admin | Deactivate a violation type (hides from selection, not deleted) |
| DELETE | /violation-types/:id | Admin | Delete a violation type (fails if is_system = true) |

---

## Module 9 — Need Cover (9 endpoints)

> Replaces Reschedule Requests. Faculty post an open broadcast — any faculty can volunteer. Admin confirms the cover assignment. Broadcasts auto-expire after 48 hours.
>
> **Resolved 2026-07-03**: v2.1 previously flagged `DELETE /:id` vs `PATCH /:id/cancel`, and
> `POST /:id/reject-volunteer` vs `PATCH /:id/reject`, as possible duplicates under review.
> Confirmed both `DELETE /:id` and `POST /:id/reject-volunteer` routed to the exact same
> controller functions as their `PATCH` counterparts, were unused by the frontend, and (for
> the cancel pair) were a strict subset of the `PATCH` route's role access. Both dead routes
> removed from the codebase; this table reflects the endpoints that remain.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /cover-requests | Faculty | Post a Need Cover broadcast for a duty slot |
| GET | /cover-requests | Admin | List all cover requests with filters (status, faculty, month) |
| GET | /cover-requests/open | Faculty | View open broadcasts available to volunteer for |
| GET | /cover-requests/my | Faculty | View own posted and volunteered requests |
| POST | /cover-requests/:id/volunteer | Faculty | Volunteer to cover a broadcast slot |
| PATCH | /cover-requests/:id/cancel | Faculty, Admin, Super Admin | Cancel a cover request (Faculty: own only; Admin/Super Admin: any) |
| PATCH | /cover-requests/:id/reject | Admin | Reject a volunteer for a cover request — clears the volunteer, keeps the request open |
| PATCH | /cover-requests/:id/confirm | Admin | Confirm a volunteer — finalises the cover assignment |
| PATCH | /cover-requests/config | Admin | Set max cover requests allowed per duty slot |

---

## Module 10 — Messages (6 endpoints)

> Two-way internal messaging between any two users. Soft delete — deleting from one side does not delete from the other.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /messages | All Auth | Send a message to another user |
| GET | /messages/inbox | All Auth | Get received messages (unread first) |
| GET | /messages/sent | All Auth | Get sent messages |
| GET | /messages/:id | All Auth | View a single message |
| PATCH | /messages/:id/read | All Auth | Explicitly mark a message as read |
| DELETE | /messages/:id | All Auth | Soft-delete a message from own view |

---

## Module 11 — Invites (4 endpoints) — NEW, added 2026-07-03

> The real account-creation mechanism. Admin/Super Admin invites a person by email; the
> system creates a `PendingInvite` and a Telegram deep link (`https://t.me/<bot>?start=invite_<token>`,
> 7-day expiry). The invited person taps the link and messages the bot, which creates the
> real `User` account with a system-generated temporary password (`must_change_password = true`).
> There is no direct account-creation endpoint (see Module 2's note on `POST /users`).

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /invites | Admin, Super Admin | Create a pending invite (Admin: `role` must be `faculty`; Super Admin: `faculty` or `admin` — `super_admin` is not an accepted role here, see known gap in `spec.md` FR-016) |
| GET | /invites | Admin, Super Admin | List all pending (not yet activated) invites |
| POST | /invites/:id/regenerate | Admin, Super Admin | Generate a new token + link for an existing pending invite (same role-scope guard as create) |
| DELETE | /invites/:id | Admin, Super Admin | Cancel a pending invite (same role-scope guard as create) |

---

## Module 12 — Reports (17 endpoints) — NEW, added 2026-07-03

> All report endpoints are Admin/Super Admin only (`router.use(authenticate, authorize('admin','super_admin'))`).
> Most take `year`/`month` query params; a few take entity-specific filters.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /reports/monthly-attendance | Admin | Monthly attendance summary |
| GET | /reports/late-arrivals | Admin | Late-arrival report for the month |
| GET | /reports/absent-faculty | Admin | Faculty who missed assigned duty slots |
| GET | /reports/auto-clockout | Admin | Records auto-clocked-out by the cron job |
| GET | /reports/attendance-overrides | Admin | Log of Admin attendance overrides |
| GET | /reports/student-violations | Admin | Student violation history (filterable) |
| GET | /reports/student-violations/export | Admin | Export student violation history (same filters as above) |
| GET | /reports/faculty-activity | Admin | Faculty violation-recording activity |
| GET | /reports/violation-types | Admin | Breakdown of violations by type for the month |
| GET | /reports/pending-fines | Admin | Summary of unpaid/pending violation fines |
| GET | /reports/flagged-violations | Admin | All violations currently flagged for review |
| GET | /reports/duty-coverage | Admin | Monthly duty slot coverage summary |
| GET | /reports/unassigned-faculty | Admin | Faculty who never picked/were assigned a slot |
| GET | /reports/cover-requests | Admin | Need Cover request summary for the month |
| GET | /reports/completion-rate | Admin | Overall session completion rate |
| GET | /reports/upload-history | Admin | Student Excel upload history |
| GET | /reports/active-students | Admin | Active student roster (filterable) |

---

## Summary — 95 Endpoints Across 12 Modules

| # | Module | Count | Base Path |
|---|--------|-------|-----------|
| 1 | Authentication | 3 | `/auth` |
| 2 | Users & Accounts | 10 | `/users`, `/admin` |
| 3 | Students | 10 | `/students` |
| 4 | Duty Calendar | 8 | `/calendar` |
| 5 | Duty Slots | 6 | `/duty-slots` |
| 6 | Duty Attendance | 5 | `/attendance` |
| 7 | Violations | 10 | `/violations` |
| 8 | Violation Types | 5 | `/violation-types` |
| 9 | Need Cover | 9 | `/cover-requests` |
| 10 | Messages | 6 | `/messages` |
| 11 | Invites | 4 | `/invites` |
| 12 | Reports | 17 | `/reports` |
| | **TOTAL** | **95** | |

Not counted above: the Telegram webhook (`POST /bot/webhook/:secret`) — internal bot
integration, not a REST endpoint intended for frontend consumption.

---

*API Reference version: 2.2 — Updated: 2026-07-03 (synced against a full code audit, then
same-day resolved the two Module 9 duplicate-route entries; see
`specs/001-auth-user-accounts/handoff.md` for the audit that produced these revisions)*
*Supersedes SIMS_API_Endpoints_v1.0.docx, v2.0, and v2.1*
