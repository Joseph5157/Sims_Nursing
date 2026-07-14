# SIMS DMS — Full System Audit

**Date:** 2026-07-07 · **Scope:** entire codebase (server, client, schema, cron, PWA, deploy config, repo hygiene) · **Method:** manual end-to-end code review of all ~17,000 lines of source. **No code was changed.**

Severity legend: 🔴 Critical (broken/security) · 🟠 High (wrong behavior users will hit) · 🟡 Medium (quality/consistency/perf) · ⚪ Low (polish/hygiene)

---

## 0. Executive Summary

The system is in genuinely good shape for its scale: auth (JWT httpOnly + CSRF + session_version) is solid, Zod validation is nearly universal, cron jobs are IST-aware and defensive, race conditions on slot picking are handled with real transactions and DB constraints, and the design-token system is disciplined. But the audit found **6 critical issues**, **~15 high issues**, and a long tail of dead code, constitution drift, and mobile/UX gaps.

The five findings I'd fix before UAT sign-off:

1. **No-shows are never marked absent** — nothing sets `duty_slots.status='absent'` or `in_status='absent'` automatically, so the Absent Faculty report and all "absent" counts stay 0 forever unless an admin manually overrides each record. (§2.1)
2. **`PATCH /admin/settings` is broken and bypasses validation** — its schema still has fields that no longer exist in the DB (500 on use) and it skips the timing-ordering check. (§2.2)
3. **Password change/reset doesn't revoke existing sessions** — `session_version` is not incremented on self-change or bot reset, so a stolen session survives a password change. (§3.1)
4. **The Telegram `/resetpassword` bot command is a self-service password reset the constitution explicitly says must not exist.** (§4.1)
5. **Sensitive data persists on shared devices after logout** — a localStorage cache of the full user list (emails, phones, Telegram IDs) and the Workbox API cache are never cleared on logout. (§3.3)

---

## 1. What's Working Well (keep it)

- Auth core: bcrypt-12, generic login errors, `session_version` forced-logout on deactivate/reactivate/delete/admin-reset, `must_change_password` flow, timing-safe CSRF + webhook secret comparison, morgan redaction of the webhook secret.
- `pickSlot` / `adminAssign` / `assignSlots`: transaction + `@@unique(duty_date, session_type)` as final guard, clean 409 mapping for `P2002`.
- `lib/time.js` IST helpers are correct and well-commented; cron auto clock-out handles missed runs and per-session cutoffs atomically.
- `handleInviteActivation` / relink: `SELECT … FOR UPDATE` inside a transaction — the one justified raw-SQL exception, done right.
- Duty Timing Settings: merged-row ordering validation, admin/super-admin split, audit logged, UI clean.
- Student upload: dry-run support, scoped deactivation guard against mass-deactivation, per-row error capture, memory-only multer with size/mime limits.
- Design tokens (`index.css @theme` + dark overrides + Mantine ramp sync) are a real system, not decoration.
- `sendWithRetryOrFlag` — retrying unrecoverable Telegram notifications and flagging `activation_notification_failed` for admin follow-up is thoughtful failure design.

---

## 2. Broken / Incomplete Functionality

### 2.1 🔴 Faculty no-shows are never recorded as absent
Nothing in the codebase ever writes `duty_slots.status = 'absent'` or `duty_attendance.in_status = 'absent'` except a manual admin override. There is no cron and no code path that closes out a past `scheduled` slot with no attendance.
- `reports.controller.js:75-89` (Absent Faculty), `:48` (monthly summary absent count), `:290` (duty coverage) all query for a state that is never produced.
- Past no-show slots stay `scheduled` forever; duty-coverage "completion rate" denominators include them but they never resolve.
**Fix direction:** extend the existing 10-minute cron — after a session's auto clock-out time passes, mark that day's attended-nothing slots `absent` (and optionally create an `in_status='absent'` attendance row).

### 2.2 🔴 `PATCH /admin/settings` — stale schema, 500s, bypasses ordering validation
- `server/schemas/settings.schema.js` still allows `auto_checkout_hour` / `auto_checkout_min` — columns that **do not exist** in `SystemConfig` since the per-session split → Prisma throws → 500.
- It's missing all `not_checked_in_*` and per-session `auto_checkout_*` fields (`.strict()` rejects them), so it can't set half of the real fields.
- `users.controller.js updateSettings` calls `settingsService.updateSettings()` directly — **skipping `findOrderingViolation`** in `duty-timing-settings.controller.js`. Exactly the bypass the constitution (§5 note) warns about.
- No client page calls this endpoint at all. **Recommend:** delete the endpoint + schema, or rewrite it to delegate through the duty-timing controller.

### 2.3 🔴 Notification system is dead scaffolding wired into live UI
- `useNotifications.js` — query `enabled: false`, SSE fully commented out (SSE would also violate the constitution's "no SSE" rule). `/api/notifications/*` endpoints don't exist.
- `NotificationBell.jsx:75,199` — message items link to **`/messages`, a route that doesn't exist** (falls through the `*` route back to the dashboard). Should be role-aware `/admin/messages` / `/faculty/messages`.
- `NotificationBell.jsx:161` — clicking an unread message calls `markAsRead('msg-<id>')` → `PATCH /api/notifications/msg-…/read` → nothing. The real endpoint `PATCH /messages/:id/read` is never used, so bell items never clear until the message is opened.
- `NotificationBell.jsx:130` — `isConnected` is always `false`, so the dropdown header **permanently shows an "Offline" badge**.
- On mobile the bell navigates to `/notifications` — a full page that renders only "Notifications Not Yet Available." A primary header button leading to a dead end.
- `window.location.href` navigation causes a full app reload instead of `navigate()`.
**Recommend:** strip the notifications module entirely and make the bell a pure unread-messages bell (it already has the inbox data), or build the backend module. Don't ship the halfway state.

### 2.4 🟠 Excel upload can never deactivate missing students
`useUploadStudents` (client) never sends `deactivate_missing=true` (or `dry_run`), so the server's entire scoped-deactivation and dry-run machinery is unreachable from the UI. The constitution says "missing ones deactivated"; the drawer subtitle even says "syncs and replaces current records", and the success toast prints "X deactivated" — which is always 0. Either add the toggle + dry-run preview to `UploadStudentsDrawer`, or change the copy.

### 2.5 🟠 Admin dashboard numbers are wrong past 20 users
`AdminDashboardPage.jsx:32,47` — "Active Faculty" is computed by client-filtering `useUsers({status:'active'})`, which returns **one page (20 rows)**. Same bug for Faculty/Admin counts on `SuperAdminDashboardPage.jsx:533-534`. With 21+ users the numbers silently undercount. Fetch with `role=faculty` and read `meta.total`, or add a stats endpoint.

### 2.6 🟠 Completion-rate trend chip can never render
`AdminDashboardPage.jsx:41-45` — `/reports/completion-rate` ignores `year`/`month` params and returns `{data: [...]}` (array); the code reads `crThis?.data?.completion_rate` → always `undefined` → `rateDelta` always `null` → the "▲ vs last mo" chip is dead code, plus two wasted API calls every dashboard load.

### 2.7 🟠 Admin email-update is dead code (validation strips it)
`validate()` replaces `req.body` with the Zod-parsed object. `updateProfileSchema` has no `email` key, so Zod strips it → the `'email' in req.body` branch in `users.controller.js:141` can never fire. **Admins cannot actually change a user's email anywhere in the system.** The "sensitive fields rejection" block (`:146-155`) is equally unreachable. Either add validated `email` to the schema (admin-only) or delete both branches.

### 2.8 🟠 Violation-type deactivation is one-way
There is no reactivate endpoint and `updateViolationTypeSchema` doesn't accept `is_active`. Once deactivated, a type can only be deleted (and only if unused). UI shows deactivated types but offers no way back.

### 2.9 🟠 Mobile users can't perform admin actions
- `UsersPage.jsx` mobile card list (`:206-232`) renders **no row menu** — deactivate/reactivate/reset-password/delete are desktop-table-only.
- `ViolationsPage.jsx` mobile cards (`:325-351`) have **no Resolve / Hide / Log actions** — flags can't be resolved from a phone.
This contradicts the mobile-first mandate; admins on phones hit a wall on the two most action-heavy pages.

### 2.10 🟡 Faculty violation edit has no UI
`PATCH /violations/:id` (faculty edit, with full audit-log support) exists server-side but no client screen calls it. Either intentional (then remove endpoint) or a missing feature.

### 2.11 🟡 Attendance override UI is a fraction of the API
`AttendanceLivePage.jsx` OverrideModal only sends `in_status` + reason. The server supports overriding `in_time`, `out_time`, `out_status`. Admins can't fix a wrong check-out time from the UI. Also: the override writes **no `admin_audit_log` entry** (server gap — `overrideAttendance` in `attendance.controller.js` never calls `logAction`), and there's no validation that `in_time < out_time`.

### 2.12 🟡 Misc broken/odd
- `useChangePassword` hook (useAuth.js) is unused **and buggy** — its `onSuccess` would write `{message: …}` into the `currentUser` cache. ChangePasswordPage correctly bypasses it. Delete the hook.
- `ChangePasswordPage` updates the query cache but not the sessionStorage mirror (`saveUserToStorage`), so a reload right after a mandatory change briefly redirects back to /change-password.
- `api.js:33-35` — the login-retry hack "clears" `sims_token` via `document.cookie`, but that cookie is **httpOnly**; the line is a no-op.
- `CalendarPage.jsx:280-312` — the legend describes green "working day" cells that the calendar never renders (only red/default exist).
- `AuditLogsPage.jsx` action filter is exact-match on the server (`where.action = action`) but presented as free-text search — typing "delete" finds nothing.
- `SuperAdminDashboardPage.jsx:501-515` — `ACTION_LABELS` keys (USER_CREATED, SESSION_RESET, …) match almost none of the actions the server actually writes (DEACTIVATE_USER, RESET_USER_LOGIN, HARD_DELETE, PASSWORD_LOGIN…). The mapping table is effectively dead.
- `pendingFinesSummary` (`reports.controller.js:239-252`) caps at 200 rows but labels the sum "Total outstanding" — wrong once >200 pending fines.
- "Pending approval" status UI (UsersPage filter, both dashboards' alerts) belongs to a removed approval flow — the invite flow creates users directly `active`; `pending` should never occur.

---

## 3. Security

### 3.1 🔴 Password change/reset does not revoke existing sessions
- `auth.controller.js changePassword` — no `session_version: { increment: 1 }`. After a user changes a (possibly compromised) password, any attacker-held session stays valid up to 7 days.
- `bot.js handlePasswordReset` — same omission for the Telegram reset (worse: this is the "I think something's wrong" path).
- Contrast: `resetUserLogin` (admin reset) *does* increment. Make all three consistent. (If you increment on self-change, reissue the JWT cookie in the same response so the user isn't logged out of their current session.)

### 3.2 🔴 `GET /users/:id` leaks contact data to any authenticated user
Route allows all roles (`users.routes.js:25`); the controller returns `safeUser`, which includes `email`, `phone`, and `telegram_id`. The `/users/directory` endpoint deliberately hides exactly these fields from faculty — this endpoint undoes that. Restrict to admin+ (or return the directory-level field set for faculty callers).

### 3.3 🔴 Client-side data persistence survives logout on shared devices
- `lib/cache.js` + `useUsers.js` — the full admin user list (names, emails, phones, telegram_ids) is cached in **localStorage** under `cache_USERS_*`. `clearAllCache()` exists but is **never called** — not even on logout.
- Workbox `sims-api` runtime cache (vite.config.js) stores API responses (students, violations, users) for 5 minutes in Cache Storage; logout doesn't purge it.
- `useLogout` clears only sessionStorage. On shared college computers, the next person at the login screen can read the previous admin's data from devtools.
**Fix:** call `clearAllCache()` + `caches.delete('sims-api')` in `useLogout`, and reconsider whether the localStorage user-list cache is worth having at all (React Query already caches in memory).

### 3.4 🟠 Constitution privilege violations
- **Admins can permanently hard-delete students** (`DELETE /students/:id`, `DELETE /students/bulk`) — constitution §4 "All deletes are soft deletes… except Super Admin hard delete" and §10 "Never physically delete records unless the caller is Super Admin using the hard-delete endpoint". The violation-count guard is good, but role/doc must be reconciled (either super-admin-only or amend the constitution).
- **Admins can deactivate other admins** (`deactivateUser` blocks only super_admin targets) — constitution assigns admin-account management to Super Admin.
- **Admins can edit other admins' / the super admin's profile** via `PATCH /users/:id/profile` (only faculty are restricted to self).
- `deleteViolationType` and `cancelInvite` are physical deletes by admin — pragmatic, but undocumented exceptions (only the messages exception is documented).
- Meanwhile `/admin/hard-delete/:resource/:id` — the one endpoint *named* hard-delete — actually **soft-deletes** and logs `HARD_DELETE` in the audit trail. Misleading in both directions.

### 3.5 🟡 Hardening nits
- `changePasswordSchema` / `loginSchema`: no `.max()` on passwords — a 90 KB password goes to bcrypt (slow-hash DoS lever). Add `.max(128)`.
- `fine_amount` / `default_fine`: `z.number().nonnegative()` with no max — values ≥ 10^6 overflow `DECIMAL(8,2)` → Prisma error → 500. Add `.max(999999.99)` (and ideally `.multipleOf(0.01)`).
- `generateTempPassword` uses `bytes[i] % 57` — slight modulo bias. Negligible at 12 chars, but `crypto.randomInt(57)` removes it.
- `getAuditLogs` — `new Date(from)` on unvalidated query strings; garbage input → Invalid Date → Prisma 500. Same for `listStudents` `year=abc` → `where.year = NaN` → 500. Use `validateQuery` (already exists) on these routes.
- `sendMessageSchema.body` has no max length — up to the 100 KB body limit per message row.
- Prod catch-all `app.get('*')` (index.js:152) returns index.html **with 200** for unknown GET API paths (e.g., typo'd endpoints "succeed" with HTML). Exclude paths with an `Accept: application/json`/prefix check, or 404 known API prefixes first.
- The user object (role, must_change_password) is mirrored in sessionStorage and used as `initialData` — tampering only affects client routing (server re-checks), but be aware it's spoofable UI state.
- `GET /calendar/:year/:month` **creates** a CalendarConfig row for any authenticated user (faculty included) for any of 1,200 possible months — a GET with write side effects. Make row creation admin-only (or on `/open` only).

---

## 4. Constitution / Documentation Drift

| # | Drift | Where |
|---|---|---|
| 4.1 🔴 | **Telegram `/resetpassword` self-service reset exists**; constitution §4 says admin-triggered reset "is the system's only 'forgot password' recovery path; there is no self-service reset." Decide: remove the command, or amend the constitution (and then also fix §3.1 for it). | `server/lib/bot.js:101-134, 293-346` |
| 4.2 🟠 | Student **hard delete by Admin** contradicts §4/§10 (see §3.4). | students routes/controller |
| 4.3 🟡 | Constitution says **14 tables**; schema has **16 models** (`pending_invites`, `telegram_relink_tokens` undocumented). | `prisma/schema.prisma` |
| 4.4 🟡 | "Every table has `created_at` and `updated_at`" — `SystemConfig` has no `created_at`; `Message`, `TelegramRelinkToken`, `DutyReassignment`, both audit logs have no `updated_at` (fine for immutable rows, but the rule as written is false). | schema |
| 4.5 🟡 | `users.otp_failed_attempts` is a leftover column from the removed OTP flow — never read or written. Candidate for a cleanup migration. | schema:75 |
| 4.6 🟡 | `SIMS_API_Endpoints_v2.0.md` is stale (constitution itself flags this). ~25 planning/audit .md files + 2 .docx at repo root are historical; move to `/docs/archive` or delete. | repo root |
| 4.7 ⚪ | `db/` directory is empty though the constitution's structure lists it for seed data (seeds live in `prisma/`). | — |

---

## 5. Hardcoded Values That Must Be Dynamic

| # | Hardcode | Where | Why it's wrong |
|---|---|---|---|
| 5.1 🔴 | `sessionEndHour = morning ? 13 : 18` for the "remember to clock out" warning | `faculty/DashboardPage.jsx:94` | Direct §10 violation. `timingSettings` (with the real `auto_checkout_*` values, default 16:30) is **already loaded in this component**. The warning fires at the wrong times whenever the admin changes settings. |
| 5.2 🟠 | Fallback labels `'9:00 AM'`/`'2:00 PM'` while settings load | `DashboardPage.jsx:219`, `SlotPickerPage.jsx:49-52` | Don't match server defaults (8:00/13:00). Show a skeleton or the real defaults. |
| 5.3 🟡 | `getUTCHours() < 12 ? 'morning' : 'afternoon'` session guess | `RecordViolationModal.jsx` | Should derive from configured session start times (cosmetic pre-fill only). |
| 5.4 🟡 | `@SimsPharmacybot` bot username hardcoded twice in the invite panel | `CreateUserDrawer.jsx` | Server has `TELEGRAM_BOT_USERNAME`; the invite response could include it (it's already in the link — parse it). |
| 5.5 🟡 | `https://sims-dms.railway.app` fallback APP_URL in two bot messages | `bot.js:34,106`, `users.controller.js:332` | Wrong-host links if env var missing; better to fail loudly. |
| 5.6 ⚪ | Sidebar/drawer dark `#0f172a`, bottom-bar `rgba(255,255,255,…)` inline colors | `Layout.jsx:201,265` | The "evergreen dark sidebar" is a design choice, but the values should be tokens (they exist in `Layout.module.css` already). |
| 5.7 ⚪ | Section filter offers `D` while schema documents sections A–C | `StudentsPage.jsx:303` vs schema comment | Pick one. |

---

## 6. Dead / Unused / Unnecessary Code

**Client**
- `hooks/useSyncQueue.js` — unused anywhere, and **fundamentally broken**: it persists `mutationFn` functions into localStorage via `JSON.stringify`, which drops functions — a reloaded queue can never replay. Delete it. Related: `OfflineBanner` promises *"changes will sync when connection returns"* — nothing implements that; soften the copy.
- `hooks/useNotifications.js` + `NotificationsPage.jsx` (250 lines) — disabled feature scaffolding incl. commented-out SSE (see §2.3).
- `components/ui/PageHeader.jsx` — never imported (every page uses the `PageHeader` exported from `Layout.jsx`). Delete one.
- `useChangePassword` — unused + buggy (§2.12).
- Vite dev proxy block — the dev client calls `http://localhost:3000` directly (`api.js` baseURL), so the entire proxy config is unused; it's also missing `/duty-timing-settings` and `/invites`, proving nobody depends on it.
- Workbox Google-Fonts runtime caching rules — fonts are self-hosted via `@fontsource`; the rules never match.
- Workbox API route list omits `/duty-timing-settings` — inconsistent with the other API prefixes.
- Unused deps: `@mantine/notifications`, `@fontsource-variable/geist` (grep: zero imports). Two icon libraries (`@tabler/icons-react` **and** `lucide-react`) are both in active use — consolidating to one would trim the bundle and the visual language.
- `STATUS_COLORS` contains `invited`/`invite_expired`/`open` states no longer rendered anywhere (`open` is referenced but not defined — `Badge status="open"` in AttendanceLivePage/StudentDetailsDrawer silently falls back to the gray default).

**Server**
- `PATCH /calendar/:year/:month/working-days` — no client hook or caller; and `updateBlockedDates` recomputes/overwrites `working_days` anyway, so any manual working-days value would be silently clobbered. Remove or wire up.
- `GET/PATCH /admin/settings` — broken and unused (§2.2).
- `settingsService.invalidateCache()` — exported, never called.
- `console.error` in `invites.controller.js:94` — constitution requires Winston.
- Duplicate Telegram senders: `lib/telegram.js` (axios) vs `bot.js sendTelegramMessage` (fetch). One implementation, please.

**Repo root**
- `CreateUserDrawer.jsx` — a stale duplicate of the client component, tracked at repo root.
- `check-admin.sql`, `mobile-nav-preview.html`, `test-invite-flow.js`, `splash-test*.png`, `client/SIMS-design-fix.zip`, `client/dev-dist/` (generated SW output), two `.docx` problem files, and ~20 historical planning `.md`s — archive or delete.
- Duplicate migrations `20260613114022_add_last_password_reset_at` and `20260613173500_add_last_password_reset_at` — verify the second is a no-op before touching, but it signals migration hygiene drift.

---

## 7. UI/UX and Responsiveness

**Mobile**
- 🟠 Admin actions missing on mobile (Users, Violations) — see §2.9.
- 🟡 Mobile bell → dead notifications page (§2.3).
- 🟡 `UsersPage` "Pending Invites" section has no mobile card variant — relies on horizontal table scroll while the users list above got a card layout; inconsistent.
- 🟡 `StudentsPage` search input sets background but no text color → potential invisible text in dark mode (`StudentsPage.jsx:272-278`; UsersPage got this right).
- ⚪ Faculty dashboard `next7Days` builds day keys with `toISOString()` (UTC) while "today" uses the IST helper — between 00:00 and 05:30 IST the 7-day strip labels shift by one day (`DashboardPage.jsx:25-27,143-148`).

**Feedback & errors**
- 🟠 **422 validation errors surface as bare "Failed."** everywhere — `validate()` returns `{errors:[…]}` with no `message`, and every page reads `err.response?.data?.message`. Either add a top-level `message` to the 422 payload (one-line server fix that improves every form), or parse `errors[0]` in a shared client error helper.
- 🟠 LoginPage collapses **all** failures to "Invalid email or password" — including 429 rate-limit and 503. Branch on status code.
- 🟡 Three different confirm patterns coexist: `ConfirmDialog` (most pages), native `confirm()` (`ViolationTypesPage:446`, `MessagesPage ThreadPanel`), and none. Standardize on `ConfirmDialog`.
- 🟡 "Record Student Violation" button shows whenever today's slot is `scheduled` — but the server rejects unless checked-in-and-not-out. Gate the button on attendance state to avoid a guaranteed 409 (`DashboardPage.jsx:127`).
- ⚪ Toast IDs use `Date.now()` — two toasts in the same millisecond share an ID.

**Copy & consistency**
- 🟡 UsersPage search placeholder says "name or Telegram ID" — server searches name/email.
- 🟡 "New chat-style experience coming soon" pill hardcoded in the Messages header — don't ship promises in production chrome. Also: **no Reply action** in the thread panel; users must open Compose and re-pick the recipient.
- 🟡 CalendarPage legend describes states that don't exist (§2.12).
- ⚪ Time display inconsistency: `AttendancePage` uses `toLocaleTimeString()` with seconds; everywhere else uses hour/minute.
- ⚪ `NotificationsPage` uses `en-US` date format; the rest of the app uses `en-IN`.
- ⚪ Heavy inline `style={{}}` blocks alternate with Tailwind classes across admin pages — one page often uses both mid-file. Works, but it's the main maintainability tax in the client. Pick Tailwind-first and migrate opportunistically.

---

## 8. Performance

- 🟡 Faculty dashboard fires ~7 queries on load (slots, violations, inbox, reassigned-away, timing settings, attendance, directory) — fine at this scale, but the directory fetch (`useMessageRecipients`) is only needed when the reassign-request drawer opens; lazy-load it.
- 🟡 `AdminDashboardPage` double `useCompletionRate` calls are wasted (§2.6); `useUsers({status:'pending'})` + `pending_telegram` + `active` = 3 list queries for counters — a `/reports` or `/users/stats` counter endpoint would collapse them.
- 🟡 `sessionCompletionRate` runs 12 sequential awaited queries in a loop — `Promise.all` them (`reports.controller.js:412-425`).
- 🟡 `uploadStudents` runs one `UPDATE` per existing row inside a single interactive transaction — a re-upload of 800 students risks the 5 s default transaction timeout on Railway. Raise `timeout` in `$transaction` options or chunk.
- 🟡 `bulkPromoteStudents`/`bulkDeleteStudents` do per-row `findUnique` + write inside the transaction — same concern for large selections.
- ⚪ Two icon libraries + Mantine + Tailwind in one bundle (see §6); consider `manualChunks` or at least one icon set.
- ⚪ `flaggedViolationsReport` and `activeStudentRoster` are unbounded `findMany`s — fine at college scale, worth a `take` for safety.
- ✅ 30-second polling (live attendance, inbox) is constitution-mandated and correctly scoped; the global rate limiter comment shows the NAT math was done. No action.

## 8b. Timezone Consistency (latent bugs)

`lib/time.js` gets IST right, but several modules build month ranges with **server-local** `new Date(year, month-1, 1)`:
- `attendance.controller.js:23-28`, `duty-slots.controller.js:23-28`, `reports.controller.js:4-16`, `calendar.controller.js:23-25,265`.
- `pickSlot` derives year/month via `date.getFullYear()` (local) on a UTC-midnight date.
These are only correct because Railway runs TZ=UTC (matching `@db.Date` UTC-midnight storage). If `TZ` is ever set (e.g., to Asia/Kolkata — a plausible "fix" someone might apply), month boundaries shift and slots leak across months. Also:
- 🟡 `facultyViolationActivity` / `violationTypeBreakdown` bucket by `created_at` with these local-time ranges — violations recorded 00:00–05:30 IST on the 1st land in the *previous* month; inconsistent with `studentViolationWhere`, which correctly uses `duty_date`.
- 🟡 Report default "current month" uses server-local `new Date()` — on the 1st of a month before 05:30 IST, admins see last month by default. Use `nowInIST()`.
**Recommend:** one shared `monthDateRangeUTC()` in `lib/time.js`, used everywhere.

---

## 9. Data-Integrity Edge Cases

- 🟡 `editViolation`: setting `fine_amount > 0` on a violation whose `is_warning_only` stays true (not in the PATCH body) produces a warning-only record with a fine. Enforce the invariant server-side.
- 🟡 `adminAssign` doesn't check target faculty `status === 'active'` (reassign does), doesn't validate against working days/blocked dates, and allows past dates; `assignSlots` additionally never validates that the posted slots fall inside the URL's `:year/:month`. An admin can silently assign slots on holidays or in other months.
- 🟡 `adminAssign` writes no audit-log entry (both `assignSlots` and `reassignSlot` do).
- 🟡 `overrideAttendance` writes no audit-log entry and allows `out_time < in_time` (§2.11).
- 🟡 Blocking dates while the window is open regenerates `working_days` but leaves already-picked slots on the now-blocked date — probably intended, but nothing warns the admin of the conflict.
- ⚪ `checkIn` concurrent double-tap: `findUnique` → `create` race surfaces as an unhandled P2002 → 500 instead of the friendly 409 (`attendance.controller.js:97-125`).
- ⚪ Excel `String(cell.value)` renders rich-text/formula cells as `[object Object]` → row errors with confusing reasons. Handle `val.richText` / `val.result`.
- ⚪ `parseWorkbook` accepts any `academic_year` string while `promoteSchema` enforces `^\d{4}-\d{2,4}$` — the two entry points disagree.

---

## 10. Testing & Production Readiness

- 🟠 Server tests cover 7 areas (attendance, auth, bot, cron, csrf, duty-slots, invites). **Zero coverage** for: students upload (the riskiest data path), violations + audit log, reports, messages, users controller (deactivate/delete/reset), duty-timing ordering validation. No client tests at all.
- 🟡 No CI config detected — tests only run when someone remembers.
- 🟡 Winston file transports write to `logs/` on Railway's ephemeral filesystem — files vanish on redeploy and can fill the container. Console-only in production (Railway captures stdout) is simpler and safer.
- 🟡 `logger.error('msg:', err)` pattern (bot.js, many places) — the dev printf format prints only the first arg; error objects are silently dropped from dev logs. Use `logger.error(\`msg: ${err.message}\`, err)` consistently or add a splat format.
- ⚪ `railway.toml` + `nixpacks.toml` both define builds (railway.toml wins; the duplication invites drift).
- ⚪ `notifyAllFaculty(year, month)` is fire-and-forget without a `.catch` — a DB error there becomes an unhandledRejection (caught globally, but noisy).
- ✅ Health checks, migrate-on-deploy, restart policy, trust proxy, helmet CSP are all in place.

---

## 11. Prioritized Action Plan

**P0 — before UAT sign-off (correctness & security)**
1. Cron: mark past no-show slots/attendance `absent` (§2.1).
2. Increment `session_version` on self password change and bot reset (§3.1).
3. Decide `/resetpassword` bot command: remove or legitimize in the constitution (§4.1).
4. Restrict `GET /users/:id` contact fields to admin+ (§3.2).
5. Purge localStorage cache + Workbox `sims-api` cache on logout (§3.3).
6. Delete or fix `PATCH /admin/settings` (§2.2).
7. Reconcile student hard-delete + admin-deactivating-admin with the constitution (§3.4).

**P1 — first post-audit sprint (user-visible correctness)**
8. Fix faculty clock-out warning to use `auto_checkout_*` settings (§5.1) + fallback labels (§5.2).
9. Fix dashboard counts (meta.total) and remove the dead completion-rate chip (§2.5, §2.6).
10. Add mobile actions to Users and Violations pages (§2.9).
11. Strip the notifications scaffolding; make the bell a real unread-messages bell with correct role-aware links + `PATCH /messages/:id/read` (§2.3).
12. Add `deactivate_missing` + dry-run preview to the upload drawer, or fix the copy (§2.4).
13. Surface 422 validation errors properly; fix login error branching (§7).
14. Add violation-type reactivate; add audit logs to `overrideAttendance` and `adminAssign`.

**P2 — hardening & hygiene**
15. Centralize month-range helpers on IST-safe utilities (§8b); fix created_at-based report bucketing.
16. Zod `.max()` on passwords, fines, message body; `validateQuery` on audit-log/students list filters.
17. Fix email-update dead code decision (§2.7); add Reply to messages; standardize ConfirmDialog.
18. Delete dead code (§6), archive stale root docs, remove duplicate root `CreateUserDrawer.jsx`, drop `otp_failed_attempts`.
19. Tests: students upload, violations audit trail, timing-ordering validation, users lifecycle; wire up CI.
20. Update CONSTITUTION.md + API doc to match reality (16 tables, endpoint counts, delete-policy exceptions).

---

*Audit performed by Claude Code (read-only). Every finding above cites the file (and where useful, line) it was observed in; line numbers reflect the working tree at commit `06c2485` on branch `005-duty-reassignment`.*
