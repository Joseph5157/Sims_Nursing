# Tasks: Week 1 — Authentication & User Accounts

**Input**: Design documents from `/specs/001-auth-user-accounts/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Codebase Status

The project scaffold (Phase A from plan.md) is already complete — Express backend, React frontend, Prisma schema, Tailwind CSS, TanStack Query, and routing are all in place. Auth uses email/password (not Telegram OTP) as the **permanent** model (Option A2, confirmed 2026-07-03 — see `handoff.md`). Tasks below address completing, fixing, and polishing the Sprint 1 scope within the existing architecture.

---

## Phase 1: Setup (Shared Infrastructure)

**Status: OBSOLETE — superseded 2026-07-03.** The original T001–T004 below built Telegram-OTP
infrastructure (`otp_sessions` model, `otp.service.js`) that was built, then fully abandoned
in favor of the email/password model already running in production. None of these tasks
should be done. Kept here (struck through) for history only; do not implement.

- ~~[ ] T001 Add missing `otp_sessions` model to `prisma/schema.prisma` per Constitution §5~~ — **OBSOLETE**: `otp_sessions` was removed from the schema during the password migration (`7b33d90`) and will not be re-added. `CONSTITUTION.md` §5 still lists it as a table — see open question in `handoff.md`.
- ~~[ ] T002 [P] Create `server/services/otp.service.js`~~ — **OBSOLETE**: no OTP service exists or is needed.
- ~~[ ] T003 [P] Create `server/services/telegram.service.js` — `sendOTP(telegramId, otp)` and `sendMessage(telegramId, text)`~~ — **PARTIALLY OBSOLETE**: `server/lib/telegram.js` already exists and is used for notifications (`sendMessage` only). `sendOTP` is not needed — Telegram never delivers login credentials.
- ~~[ ] T004 Run `npx prisma migrate dev --name add-otp-sessions`~~ — **OBSOLETE**: no such migration should ever be created.

See Phase 8 (new, below) for the tasks that replace this phase: removing the other leftover
pre-migration subsystem (`PendingInvite`, `TelegramRelinkToken`, invite-based activation).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core auth infrastructure that MUST be complete before user story work

**Status**: Middleware (authenticate.js, authorize.js, validate.js) already exists and is functional. Focus is on gaps and hardening.

- [ ] T005 Verify `server/middleware/authenticate.js` — ensure JWT cookie `sims_token` is read, verified, user status checked (active, not deleted), session_version validated, and `req.user = { id, role }` attached correctly
- [ ] T006 [P] Verify `server/middleware/authorize.js` — ensure `authorize(...roles)` factory checks `req.user.role` against allowed roles, returns 403 FORBIDDEN if not
- [ ] T007 [P] Verify `server/middleware/validate.js` — ensure Zod schema runner returns 422 with field-level errors on validation failure
- [ ] T008 [P] Verify `server/lib/logger.js` — ensure Winston logger has console transport (dev) and file transport (prod), no `console.log` usage in server code
- [ ] T009 Verify CORS config in `server/index.js` — ensure `credentials: true` and `origin` matches `CORS_ORIGIN` env var, and cookie-parser is wired before routes

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Faculty Logs In via Email/Password (Priority: P1) MVP

**Goal**: A faculty member logs in with email + password, receives a JWT in an httpOnly cookie, and reaches their dashboard. Session persists across browser restarts within the 7-day JWT window.

**Independent Test**: Log in as a seeded faculty user → verify dashboard loads → close browser → reopen → verify session persists without re-login.

### Implementation for User Story 1

- [ ] T010 [US1] Verify `POST /auth/login` in `server/controllers/auth.controller.js` — email/password lookup, generic `401 INVALID_CREDENTIALS` (no account enumeration), bcrypt verify, JWT sign with `{ sub, role, session_version }`, httpOnly cookie set (`sims_token`, 7d, `sameSite=lax`, secure in prod), CSRF token issued
- [ ] T011 [US1] Verify `POST /auth/logout` in `server/controllers/auth.controller.js` — clears `sims_token` and `sims_csrf` cookies using matching options (path, domain, sameSite)
- [ ] T012 [US1] Verify `POST /auth/change-password` in `server/controllers/auth.controller.js` — validates current password (skips if `password_hash` is null for first-time set), hashes new password with bcrypt(12), sets `must_change_password = false`
- [ ] T013 [P] [US1] Verify Zod schemas in `server/schemas/auth.schema.js` — `loginSchema` validates `{ email: string().email(), password: string().min(8) }`, `changePasswordSchema` validates `{ current_password, new_password }`
- [ ] T014 [US1] Verify rate limiting on `POST /auth/login` in `server/routes/auth.routes.js` — 50 requests per 15 minutes per IP in production (1000 in development), no per-account lockout
- [ ] T015 [P] [US1] Verify `client/src/pages/auth/LoginPage.jsx` — email/password form, error states (invalid credentials, rate limited, service unavailable), SIMS branding, mobile-first layout
- [ ] T016 [P] [US1] Verify `client/src/hooks/useAuth.js` — `useCurrentUser()` fetches `GET /api/users/me`, `useLogin()` mutation calls `POST /api/auth/login`, `useLogout()` clears query cache on success
- [ ] T017 [US1] Verify auth redirect flow in `client/src/App.jsx` — unauthenticated users redirect to `/login`, authenticated users redirect to role-based dashboard, `must_change_password` forces redirect to `client/src/pages/auth/ChangePasswordPage.jsx`
- [ ] T018 [US1] Verify `client/src/components/ProtectedRoute.jsx` — loading spinner while checking auth, redirect to `/login` on 401, role check with 403 "Access Denied" UI, renders `<Outlet />` on success

**Checkpoint**: Faculty can log in, see dashboard, log out, session persists across browser restarts

---

## Phase 4: User Story 2 — Admin Invites and Manages User Accounts (Priority: P2)

**Goal**: Admin can invite new Faculty accounts (Super Admin can additionally invite Admin
accounts); invited people activate their own account via Telegram; Admin can view all users
with filters and deactivate/reactivate accounts. **`POST /users` direct creation is retired
(`410 GONE`) — this is not the live model, see T019 below.**

**Independent Test**: Log in as Admin → invite a new Faculty user (`POST /invites`) → as that
person, tap the generated Telegram link and confirm the bot creates the account with a temp
password → verify the new user appears in the users list → deactivate → verify they cannot
log in → reactivate → verify login works again. Separately: as Admin, attempt to invite an
Admin or Super Admin account and verify it is rejected.

### Implementation for User Story 2

- [x] T019 [US2] Verify `POST /invites` in `server/controllers/invites.controller.js` (`createInvite`) — already correctly implemented: role-scope guard (`req.user.role === 'admin' && role !== 'faculty'` → `403 FORBIDDEN`), checks for an existing active user *or* pending invite with the same email (`409 EMAIL_TAKEN`), generates a token + `https://t.me/<BOT_USERNAME>?start=invite_<token>` link, creates a `PendingInvite` (7-day expiry), fire-and-forget audit log (`CREATE_INVITE`), returns `201`.
- [x] T019a Verify `/start invite_<token>` handling in `server/lib/bot.js` (`handleInviteActivation`) — row-locks the `PendingInvite`, rejects if the tapping Telegram ID is already linked (`ALREADY_LINKED`) or the email now conflicts with an active user (`EMAIL_CONFLICT`), generates + hashes a temp password, creates the real `User` (`status: active`, `must_change_password: true`, `telegram_verified: true`), deletes the `PendingInvite`, and messages back the login email + temp password.
- [x] T019b Verify `POST /invites/:id/regenerate` and `DELETE /invites/:id` in `invites.controller.js` — same Admin-can-only-touch-faculty-invites guard as `createInvite`; regenerate issues a new token + expiry, cancel deletes the pending invite; both audit-logged.
- [ ] T020 [US2] Verify `GET /users` in `server/controllers/users.controller.js` — Admin-only, returns paginated list with optional filters (`role`, `status`, `department`), includes `limit`/`offset` pagination. Does **not** include pending invites — those come from `GET /invites`.
- [ ] T021 [US2] Verify `GET /users/:id` in `server/controllers/users.controller.js` — all authenticated users can view own profile; Admin+ can view any profile
- [ ] T022 [US2] Verify `PATCH /users/:id/profile` in `server/controllers/users.controller.js` — all authenticated users can update own profile (`name`, `phone`, `department`), Zod validated
- [ ] T023 [US2] Verify `PATCH /users/:id/deactivate` in `server/controllers/users.controller.js` — Admin-only, sets `status = inactive` + increments `session_version`, guards against self-deactivation (`403 FORBIDDEN`, "You cannot deactivate yourself.") and against deactivating a Super Admin (`403 FORBIDDEN`, "Super Admin cannot be deactivated.")
- [ ] T024 [P] [US2] Verify `PATCH /users/:id/reactivate` in `server/controllers/users.controller.js` — Admin-only, sets `status = active`
- [ ] T025 [US2] Verify Zod schema in `server/schemas/invites.schema.js` — `createInviteSchema` validates `{ name, email, phone?, role: 'admin' | 'faculty', department?, designation? }`. Note this schema makes it **structurally impossible** to invite a `super_admin` — that's the FR-016 known gap, not a bug to fix here (see `spec.md`).
- [x] T026 [US2] Verify `client/src/pages/admin/UsersPage.jsx` — already implemented: table of active/deactivated users with role badge/dept/status/actions; role + status filters; "+ Invite User" button opens the invite modal; separate "Pending Invites" section with Regenerate/Cancel row actions; per-row Deactivate/Reactivate on active users.
- [x] T027 Verify `client/src/hooks/useInvites.js` (`useInvites`, `useCreateInvite`, `useRegenerateInvite`, `useCancelInvite`) and `client/src/hooks/useUsers.js` (`useUsers`, `useDeactivateUser`, `useReactivateUser`) — already implemented, proper cache invalidation on each mutation.
- [ ] T028 [US2] Verify duplicate prevention — `POST /invites` rejects an email already belonging to an active user or another pending invite with `409 EMAIL_TAKEN`.

**Checkpoint**: Admin can invite (Faculty-only) and manage users; Super Admin can additionally
invite Admin accounts; invited people self-activate via Telegram

---

## Phase 5: User Story 3 — Super Admin Resets a User's Password (Priority: P3)

**Goal**: Super Admin can reset any user's password, restoring their ability to log in without database intervention. All resets are logged in the audit trail and the user is notified via Telegram.

**Independent Test**: As Super Admin, trigger a password reset on a test account → verify a temp password is generated and sent via Telegram → verify the user can log in with it and is immediately forced to change it → verify an audit log entry was created.

### Implementation for User Story 3

- [x] T029 **[REWRITE, not verify] [US3]** `POST /admin/users/:id/reset-login` in `server/controllers/users.controller.js` (`resetUserLogin`, ~line 370) is currently **broken**: it calls `prisma.otpSession.deleteMany(...)`, but the `OtpSession`/`otp_sessions` model no longer exists in `prisma/schema.prisma` — this throws at runtime the instant the endpoint is called. It also unconditionally sets the target user's `status` to `pending_telegram` and unlinks their Telegram, which has nothing to do with password reset. **Rewrite this function in place (same endpoint, do not create a new one)**: generate a temporary password, hash it with bcrypt (cost 12), set `password_hash` + `must_change_password = true`, increment `session_version` (revokes existing sessions), send the temp password to the user via `server/lib/telegram.js`'s `sendMessage`, write an `admin_audit_log` entry with `{ actorId, action: 'RESET_USER_LOGIN', targetId, targetType: 'user', metadata: { ... } }` (keep the existing action name, update `metadata` to no longer claim `telegram_reset: true`). Keep the existing guard blocking reset of a Super Admin's own account. Note: `TelegramRelinkToken` is live, load-bearing code (used by `/start relink_<token>` in `bot.js`) — this rewrite must stop using it for password reset, but must not remove or break the model itself, since it still backs the separate Telegram-relink flow. This is an *additional* recovery path alongside the self-service `/resetpassword` bot command (T019a-adjacent, see Phase 5 goal) — for when a user has lost Telegram access too, not just their password.
- [x] T029a **[NEW] [US3]** Decide and implement the Telegram-unreachable-during-reset behavior (currently an OPEN question in `spec.md` Edge Cases): either the reset still succeeds and returns the temp password in the API response as a fallback for the Super Admin to relay manually, or the whole reset fails if the Telegram send fails. Update `spec.md`'s Edge Cases entry once decided.
- [ ] T030 [US3] Verify `server/services/audit.service.js` — `logAction({ actorId, action, targetId, targetType, metadata })` writes immutable row to `admin_audit_log`, fire-and-forget with error logging (audit failure never blocks main response)
- [ ] T031 [US3] Verify `GET /admin/audit-logs` in `server/controllers/users.controller.js` — Super Admin only, paginated list from `admin_audit_log`, filters: `actor_id`, `action`, `target_id`, date range
- [ ] T032 **[REWRITE, not verify] [US3]** There is no `SessionResetPage.jsx` and no separate `/super-admin/sessions` route in the current app — add a "Reset Password" row action to `client/src/pages/admin/UsersPage.jsx`, visible only when the logged-in user is Super Admin and hidden on their own row; confirmation dialog explaining a temp password will be sent via Telegram; on success, toast confirmation. `client/src/pages/super-admin/AuditLogsPage.jsx` already exists for viewing the resulting audit entries.
- [ ] T033 **[REWRITE, not verify] [US3]** `client/src/hooks/useUsers.js` already exports `useResetUserLogin()` calling `POST /admin/users/:id/reset-login` — confirmed it currently has **zero callers anywhere in the client**. Wire it up from the new UsersPage action in T032, with cache invalidation on success.
- [ ] T034 [US3] Verify authorization — only `super_admin` role can access `POST /admin/users/:id/reset-login` and `GET /admin/audit-logs`; Admin and Faculty get 403; verify the endpoint also rejects resetting a Super Admin's own account

**Checkpoint**: Super Admin can reset any user's password, the user is notified via Telegram and forced to change it, all resets appear in audit log

---

## Phase 6: User Story 4 — Role-Based Access Control Enforced on All Routes (Priority: P2)

**Goal**: Every authenticated user can only access screens and API endpoints permitted for their role. Unauthorized access results in a clear denial, not a crash or blank screen.

**Independent Test**: Log in as Faculty → attempt to navigate to `/admin/users` → verify "Access Denied" is shown. Log in as Admin → attempt to navigate to `/super-admin/audit-logs` → verify denial.

### Implementation for User Story 4

- [ ] T035 [US4] Verify all backend routes use `authorize()` middleware — every route in `server/routes/users.routes.js` and `server/routes/auth.routes.js` has appropriate role guards matching plan.md endpoint table
- [ ] T036 [US4] Verify frontend `ProtectedRoute` wrappers in `client/src/App.jsx` — Admin routes wrapped with `requiredRole={['admin', 'super_admin']}`, Super Admin routes with `requiredRole={['super_admin']}`, Faculty routes with `requiredRole={['faculty']}`
- [ ] T037 [P] [US4] Verify 403 "Access Denied" UI in `client/src/components/ProtectedRoute.jsx` — shows clear message with user's current role, provides link back to their own dashboard
- [ ] T038 [US4] Verify expired JWT handling — when `sims_token` cookie expires, next API call returns 401, frontend intercepts and redirects to `/login` automatically via Axios interceptor in `client/src/utils/api.js`
- [ ] T039 [US4] Verify `GET /users/me` endpoint returns correct user profile including role — this is the session check endpoint used by `useCurrentUser()` hook

**Checkpoint**: All routes enforce RBAC, unauthorized access shows clear denial, expired sessions redirect to login

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, seed data, deployment readiness

- [x] T040 [P] `prisma/seed.js` — creates Super Admin user from env vars (`BOOTSTRAP_SUPER_ADMIN_EMAIL`, `BOOTSTRAP_SUPER_ADMIN_PASSWORD` optional), generates a real password hash with bcrypt(12) (uses the env password if set, otherwise generates one and prints it to console once — never hardcoded), sets `status = active`, **`must_change_password = true`** (fixed 2026-07-03 — was incorrectly `false`, which is what caused T040's original bug: no way to log in with a known password on a fresh install)
- [ ] T041 [P] Verify `.env.example` — required env vars documented: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `NODE_ENV`, `PORT`, `CORS_ORIGIN`, `BOOTSTRAP_SUPER_ADMIN_EMAIL`, and the new optional `BOOTSTRAP_SUPER_ADMIN_PASSWORD`
- [ ] T042 [P] Verify `server/index.js` health endpoint — `GET /health` returns `{ status: "ok", timestamp }`, `GET /health/db` verifies Prisma connection
- [ ] T043 Verify cookie security — in production (`NODE_ENV=production`), `sims_token` cookie has `secure: true`, `sameSite: lax`, `httpOnly: true`
- [ ] T044 [P] Verify error response format — all API errors follow `{ error: true, code: "ERROR_CODE", message: "Human-readable message" }` per Constitution §6
- [ ] T045 Edge case: Admin (or Super Admin) attempting to deactivate own account returns `403 FORBIDDEN` ("You cannot deactivate yourself.")
- [ ] T046 Edge case: Inviting a user with an email that already belongs to an active user or another pending invite returns `409 EMAIL_TAKEN` (`invites.controller.js`)
- [ ] T047 [P] Verify no `console.log` in server code — all logging uses Winston logger per Constitution §10
- [ ] T048 Acceptance criteria sign-off: full login flow works end-to-end, all 3 roles independently accessible, no cross-role data leakage, Admin can only invite Faculty accounts (Super Admin can additionally invite Admin), admin CRUD on users works in ≤3 clicks, every password reset logged in audit

---

## Phase 8: Remove Actually-Dead Code (CORRECTED 2026-07-03 — inverted from original Phase 8)

**Purpose**: The original version of this phase (below, struck through) was based on a wrong
premise — it called `PendingInvite`, `TelegramRelinkToken`, `invites.controller.js`, and the
`server/lib/bot.js` invite/relink/reset handlers "dead code." They are not: they're the live
account-creation and password-recovery system (confirmed by reading `users.routes.js`, which
returns `410 GONE` for `POST /users`/`GET /users/pending`/`POST /users/:id/regenerate-invite`
and tells callers to use `/invites` instead). The **actually** dead code was the unreachable
handlers behind those three retired routes, plus the retired route stubs themselves.

- [x] T053 (redefined) Removed unreachable dead code confirmed to have zero callers:
  `createUser`, `getPendingUsers`, and `regenerateInvite` functions in
  `server/controllers/users.controller.js` (the latter two also referenced
  `telegram_invite_token`/`telegram_invite_expires_at` columns already dropped from the
  schema in an earlier migration — triple-dead: unreachable, schema-invalid, and superseded).
  Also removed the now-unused `createUserSchema` from `server/schemas/users.schema.js`.
- [x] T054 (redefined) Removed the three `410 GONE` stub routes from `server/routes/users.routes.js`
  (`POST /users`, `GET /users/pending`, `POST /users/:id/regenerate-invite`) along with the
  dead handlers they never actually called. **Behavior change**: hitting those URLs now
  returns a plain `404` (no matching route) instead of an explicit `410 GONE` with a redirect
  message. Confirmed via `node --check` that all three edited files still parse correctly.
- [ ] T055 Double-check no client code, tests, or docs still call the removed
  `POST /users` / `GET /users/pending` / `POST /users/:id/regenerate-invite` (grep confirmed
  no client callers at the time of removal; recheck after any future frontend changes).

~~Struck-through original (wrong-premise) tasks — do not implement:~~
- ~~T053-orig Remove `invites.controller.js`, `useInvites.js`, and the `PendingInvite`/`TelegramRelinkToken` webhook handlers in `bot.js`~~ — **wrong**: these are live, load-bearing code (real account creation + self-service password reset). Do not remove.
- ~~T054-orig Remove `PendingInvite`/`TelegramRelinkToken` models from `prisma/schema.prisma`~~ — **wrong**, same reason.
- ~~T055-orig Create a Prisma migration dropping those tables~~ — **wrong**, same reason; no such migration should be created.
- ~~T056-orig Remove/update `server/tests/invites.test.mjs`~~ — **wrong**; that test file covers live functionality and should stay.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: OBSOLETE — no dependencies, nothing to do
- **Foundational (Phase 2)**: No longer depends on Phase 1 (no `otp_sessions` migration needed)
- **User Stories (Phases 3–6)**: All depend on Phase 2 completion
  - US1 (Login) can start after Phase 2 — no dependencies on other stories
  - US2 (User Management) can start after Phase 2 — may share user lookup logic with US1
  - US3 (Password Reset) depends on US1 being testable (need login to test reset)
  - US4 (RBAC) depends on US1 and US2 (need login + user creation to test role enforcement)
- **Polish (Phase 7)**: Depends on all user stories being verified
- **Dead subsystem removal (Phase 8)**: Independent of Phases 2–7, but T029 (Phase 5) depends
  on T053/T054 removing `TelegramRelinkToken` cleanly first if the rewrite touches shared code

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **US2 (P2)**: Can start after Phase 2 — Independent of US1 at the API level
- **US3 (P3)**: Needs US1 working to test reset-then-login flow
- **US4 (P2)**: Cross-cutting — verifies all stories enforce roles correctly

### Within Each User Story

- Backend verification before frontend verification
- Controller logic before schema/validation checks
- Core flow before edge cases

### Parallel Opportunities

- All Phase 2 tasks marked [P] can run in parallel (T006, T007, T008)
- Within each user story, tasks marked [P] can run in parallel
- US1 and US2 can be worked on in parallel once Phase 2 is complete

---

## Parallel Example: User Story 1

```bash
# Launch Zod schema + frontend verifications in parallel:
Task: "Verify Zod schemas in server/schemas/auth.schema.js"  (T013)
Task: "Verify LoginPage in client/src/pages/auth/LoginPage.jsx"  (T015)
Task: "Verify useAuth hook in client/src/hooks/useAuth.js"  (T016)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (verify middleware) — Phase 1 is obsolete, skip it
2. Complete Phase 3: User Story 1 (login flow)
3. **STOP and VALIDATE**: Test full login flow end-to-end
4. Deploy/demo if ready

### Incremental Delivery

1. Complete Foundational -> Foundation ready
2. Add US1 (Login) -> Test independently -> Working auth (MVP!)
3. Add US2 (User CRUD, including the T019a role-restriction fix) -> Test independently -> Admin can manage users
4. Add US3 (Password Reset, rewriting the broken `resetUserLogin`) -> Test independently -> Super Admin can recover locked-out accounts
5. Add US4 (RBAC) -> Test independently -> All roles properly enforced
6. Polish -> Edge cases, seed, deployment readiness
7. Phase 8 -> Remove the other leftover dead subsystem (invites/relink), on its own schedule

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- "Verify" tasks mean: read the existing code, test it works, fix any bugs found
- Tasks marked **[REWRITE, not verify]** or **[NEW — FIX, not verify]** are confirmed broken
  or missing, not just undocumented — treat them as build tasks, not read-and-confirm tasks
- Each user story should be independently completable and testable
- Stop at any checkpoint to validate story independently
