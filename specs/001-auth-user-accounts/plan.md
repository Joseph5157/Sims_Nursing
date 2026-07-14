# Implementation Plan: Week 1 — Authentication & User Accounts

**Feature Branch**: `001-auth-user-accounts`
**Spec**: `spec.md` — Week 1
**Constitution Version**: 2.9
**Plan Created**: 2026-06-06
**Plan Updated**: 2026-07-03 — rolled forward to the permanent email/password auth model
(Option A2). Telegram OTP login and the Telegram Login Widget were built, then abandoned;
Telegram remains in scope for notifications only. See `handoff.md` for the full history.

---

## Overview

This plan scaffolds the full SIMS DMS project and implements the Week 1 scope: email +
password login, JWT session management, role-based access control, and Admin user account
management. Telegram is used for notifications only (duty window open, cover requests,
reminders, admin-triggered password resets) — never for login. By end of week the system
must be live enough for a real faculty member to log in and an Admin to manage accounts.

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Project layout | Monorepo — `client/` + `server/` + `prisma/` at root | Per Constitution §7 |
| Auth mechanism | Email + password | Per Constitution §4 — permanent model (Option A2) |
| Token storage | httpOnly cookie + CSRF cookie/header | Per Constitution §10 — never localStorage |
| Password hash | bcrypt, cost factor 12 | Per Constitution §4 |
| Forced logout | `session_version` embedded in JWT, checked every request | Per Constitution §4 |
| Forced password change | `must_change_password` flag on new/reset accounts | Per Constitution §4 |
| Brute-force defense | IP rate limiting only (50 req/15min prod) — no per-account lockout | Per Constitution §4 |
| Password recovery | Super Admin-triggered reset — temp password + Telegram notify | Per Constitution §3/§4 |
| Notifications | Telegram Bot only, decoupled from login | Per Constitution §4 |
| Audit log | `admin_audit_log` table (JSONB, immutable) | Per FR-015 / Constitution §4 |
| Validation | Zod on every POST/PATCH input | Per Constitution §2 |
| Logging | Winston (app/error), Morgan (HTTP) | Per Constitution §2, §10 |
| Self-registration | Disabled — accounts only come from an Admin/Super Admin invite, activated by the invited person via Telegram | Per spec Assumptions, FR-009/FR-016/FR-018 |
| Account creation | `POST /invites` → `PendingInvite` → Telegram deep link → bot activates on `/start invite_<token>` | `POST /users` is retired (`410 GONE`) — not the live path |
| First Super Admin | DB seed script (`prisma/seed.js`, generates/accepts a real password) — no path to create a 2nd Super Admin currently (FR-016 known gap) | Per spec Assumptions |

---

## Folder Structure to Scaffold

```
/
├── client/
│   ├── public/
│   │   └── manifest.json                  # PWA manifest
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.jsx          # Email + password login form
│   │   │   │   └── ChangePasswordPage.jsx # Forced change when must_change_password=true
│   │   │   ├── admin/
│   │   │   │   └── UsersPage.jsx          # User list, create, deactivate, trigger password reset
│   │   │   ├── faculty/
│   │   │   │   └── DashboardPage.jsx      # Stub — Week 1 placeholder
│   │   │   └── super-admin/
│   │   │       └── AuditLogsPage.jsx      # Super Admin audit log viewer
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx         # JWT guard + role gate
│   │   │   ├── RoleGuard.jsx              # Inline role check wrapper
│   │   │   └── layout/
│   │   │       └── AppShell.jsx           # Nav shell per role
│   │   ├── hooks/
│   │   │   ├── useAuth.js                 # TanStack Query — /auth/me
│   │   │   └── useUsers.js                # TanStack Query — /users
│   │   ├── utils/
│   │   │   ├── api.js                     # Axios instance — withCredentials
│   │   │   └── constants.js               # Roles enum, route names
│   │   ├── App.jsx                        # Router + ProtectedRoute wiring
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/
│   ├── routes/
│   │   ├── auth.routes.js                 # /auth/* — 3 endpoints
│   │   ├── users.routes.js                # /users/* + /admin/* — account mgmt + Super Admin ops (POST /users etc. retired, 410 GONE)
│   │   └── invites.routes.js              # /invites/* — 4 endpoints, the real account-creation entrypoint
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── users.controller.js
│   │   └── invites.controller.js          # createInvite, listInvites, regenerateInvite, cancelInvite
│   ├── services/
│   │   ├── telegram.service.js            # Send message via Bot API (notifications only)
│   │   └── audit.service.js               # Write to admin_audit_log
│   ├── middleware/
│   │   ├── authenticate.js                # JWT cookie → req.user
│   │   ├── authorize.js                   # Role check factory
│   │   └── validate.js                    # Zod schema runner
│   ├── lib/
│   │   ├── logger.js                      # Winston instance
│   │   └── bot.js                         # Telegram webhook: invite activation, relink, /resetpassword, /myid
│   ├── schemas/
│   │   ├── auth.schema.js                 # Zod — login, change-password
│   │   ├── users.schema.js                # Zod — update profile, etc. (no create — see invites.schema.js)
│   │   └── invites.schema.js              # Zod — createInviteSchema: { name, email, phone?, role: 'admin'|'faculty', department?, designation? }
│   └── index.js                           # Express app entry point
│
├── prisma/
│   ├── schema.prisma                      # Full 13-table schema + admin_audit_log
│   └── seed.js                            # Super Admin seed
│
├── db/
│   └── seed-super-admin.js                # Standalone seed runner
│
├── .env.example
├── .gitignore
└── package.json                           # Root scripts (dev, migrate, seed)
```

---

## Phase Breakdown

### Phase A — Project Scaffold (Day 1)

**Goal**: Runnable skeleton. `npm run dev` starts both client and server with no errors.

#### A1 — Root Setup
- [ ] Initialise root `package.json` with workspaces (`client`, `server`)
- [ ] Add `.env.example` with all 7 required variables from Constitution §11
- [ ] Add `.gitignore` (node_modules, .env, dist, prisma migrations auto-generated)
- [ ] Add root scripts: `dev`, `build`, `migrate`, `seed`

#### A2 — Backend Scaffold
- [ ] `cd server && npm init`
- [ ] Install: `express cookie-parser cors helmet morgan express-rate-limit jsonwebtoken bcryptjs zod winston axios dotenv`
- [ ] Install dev: `nodemon`
- [ ] Create `server/index.js` — Express app with Helmet, CORS (credentials + origin), Morgan, rate limiter, JSON body parser, cookie-parser
- [ ] Wire `/health` endpoint returning `{ status: "ok", timestamp }`
- [ ] Create `server/lib/logger.js` — Winston with daily-rotate or file transport for errors, console for dev
- [ ] Stub all route files — each returns `501 Not Implemented` for now

#### A3 — Prisma Setup
- [ ] `cd prisma && npx prisma init`
- [ ] Write full `schema.prisma` — all 13 tables + `admin_audit_log` matching `SIMS_Database_Schema_v2.0.md` exactly
  - Enums: `Role`, `UserStatus`, `SessionType`, `SlotStatus`, `AttendanceInStatus`, `AttendanceOutStatus`, `ViolationType`, `ChangeType`, `CoverStatus`, `RecordStatus`
  - All FK relations with correct `onDelete` behaviour
  - All UUID `@default(uuid())`
  - `@updatedAt` on every `updated_at` field
- [ ] Run `npx prisma migrate dev --name init`
- [ ] Verify all tables created in Railway PostgreSQL

#### A4 — Frontend Scaffold
- [ ] `npm create vite@latest client -- --template react`
- [ ] Install: `tailwindcss postcss autoprefixer @tanstack/react-query axios react-router-dom`
- [ ] Configure Tailwind — `tailwind.config.js` + `index.css`
- [ ] Configure `vite.config.js` — proxy `/api` → `http://localhost:3000` for dev
- [ ] Create `src/utils/api.js` — Axios instance with `baseURL=/api`, `withCredentials: true`
- [ ] Create `src/App.jsx` — React Router v6 with route stubs

---

### Phase B — Authentication Backend (Day 2)

**Goal**: Email + password login → JWT + CSRF cookies. Forced password change on first login
or after an Admin-triggered reset. Fully working in Postman/curl.

#### B1 — Telegram Service (notifications only)
- [x] `server/services/telegram.service.js` (`server/lib/telegram.js`)
  - `sendMessage(telegramId, text)` — calls `https://api.telegram.org/bot{TOKEN}/sendMessage`
  - Returns `{ ok: true }` or throws `TelegramError`
  - Logs failure via Winston — does NOT throw to caller if Telegram is down (returns error object)
  - Used only for notifications (duty window open, cover requests, reminders, password
    resets) — never called from the login path

#### B2 — Auth Routes & Controller
- [x] `POST /auth/login`
  - Zod: `{ email: string().email(), password: string().min(8) }`
  - Look up `users` by `email`
  - Generic `401 INVALID_CREDENTIALS` if: user not found, `deleted_at` set, `status !== active`,
    or `password_hash` is null — never reveals which case (no account enumeration)
  - `bcrypt.compare(password, password_hash)` — wrong password → same generic `401`
  - On success: sign JWT `{ sub: userId, role, session_version }`, set httpOnly cookie
    (`sims_token`, 7d, sameSite=lax, secure in prod) + `sims_csrf` cookie
  - Log `PASSWORD_LOGIN` to audit
  - Return `200` with user profile including `must_change_password`
  - Rate limit: 50 requests / 15 min per IP (relaxed for shared college Wi-Fi); no
    per-account failed-attempt lockout

- [x] `POST /auth/change-password`
  - Requires valid JWT (authenticate middleware)
  - Zod: `{ current_password?, new_password: string().min(8) }`
  - If `password_hash` exists: verify `current_password` first — wrong → `401 INVALID_CURRENT_PASSWORD`
  - If `password_hash` is null (first-time set): skip current-password check
  - Hash `new_password` (bcrypt, cost 12), set `must_change_password = false`
  - Log `PASSWORD_CHANGED` to audit
  - Return `200 { message: "Password changed successfully." }`

- [x] `POST /auth/logout`
  - Requires valid JWT (authenticate middleware)
  - Clear `sims_token` and `sims_csrf` cookies
  - Return `200 { message: "Logged out successfully." }`

#### B3 — JWT + CSRF Middleware
- [x] `server/middleware/authenticate.js`
  - Read `req.cookies.sims_token`
  - Verify with `JWT_SECRET`
  - Reject if `payload.session_version !== user.session_version` (forced logout) — `401 SESSION_REVOKED`
  - Attach `req.user = { id, role }` to request
  - If missing/invalid/expired: `401 UNAUTHORIZED`

- [x] `server/middleware/authorize.js`
  - Factory: `authorize(...roles)` → middleware
  - Checks `req.user.role` is in allowed roles
  - If not: `403 FORBIDDEN`

- [x] CSRF middleware — validates `X-CSRF-Token` header against `sims_csrf` cookie
  (timing-safe compare) on every mutating request; exempt for `/bot` webhook and `/health`

---

### Phase C — User Accounts Backend (Day 2–3)

**Goal**: Admin/Super Admin can invite, list, and deactivate accounts; invited people activate
via Telegram; Super Admin can reset passwords. `POST /users` (direct creation) is retired.

#### C1 — Zod Schemas
- `server/schemas/invites.schema.js` — `createInviteSchema`: `{ name, email, phone?, role: 'admin' | 'faculty', department?, designation? }`. **Note**: `role` does not accept `'super_admin'` at all — this is the FR-016 known gap (no invite path can ever create a Super Admin, regardless of who's inviting).
- `server/schemas/users.schema.js` — `updateProfileSchema`: `{ name?, phone?, department? }` (all optional). No `createUserSchema` — account creation goes through `invites.schema.js` instead.

#### C2 — Invites Controller (`server/controllers/invites.controller.js`) — the real account-creation path

- [x] `POST /invites` — Admin or Super Admin. Role-scope guard: if actor is Admin, `role` must be `faculty` (else `403 FORBIDDEN`); Super Admin may additionally invite `admin`. Checks for an existing active user *or* existing pending invite with the same email (`409 EMAIL_TAKEN` either way). Generates a token, builds `https://t.me/<BOT_USERNAME>?start=invite_<token>`, creates a `PendingInvite` row (7-day expiry), fire-and-forget audit log (`CREATE_INVITE`). Returns `201` with the invite and the link.
- [x] `GET /invites` — Admin or Super Admin. Lists all pending invites (never exposes the raw token), including who invited them.
- [x] `POST /invites/:id/regenerate` — Admin or Super Admin (same faculty-only guard for Admin). New token + new 7-day expiry. Audit log (`REGENERATE_INVITE`).
- [x] `DELETE /invites/:id` — Admin or Super Admin (same guard). Deletes the pending invite. Audit log (`CANCEL_INVITE`).

#### C2b — Telegram Bot Activation (`server/lib/bot.js`) — completes account creation

- [x] `/start invite_<token>` handler (`handleInviteActivation`): looks up the `PendingInvite` by token with row-level locking (`SELECT ... FOR UPDATE` — the sole non-report raw-SQL exception, per an existing constitution note), checks the tapping Telegram ID isn't already linked to another user and the email hasn't since been taken, generates a temporary password, hashes it, **creates the real `User` row** (`status: active`, `telegram_id` = the tapper's chat ID, `telegram_verified: true`, `must_change_password: true`), deletes the `PendingInvite`, and replies in Telegram with the login email + temporary password.
- [x] `/start relink_<token>` handler (`handleRelinkActivation`): re-links an existing user's Telegram via `TelegramRelinkToken` (used by the Super Admin `reset-login` flow — see Phase C3).
- [x] `/resetpassword` handler (`handlePasswordReset`): **self-service** password reset already live — looks up the user by their linked `telegram_id`, rate-limited to 1/hour via `last_password_reset_at`, generates + hashes a temp password, sets `must_change_password = true`, logs `PASSWORD_RESET_VIA_BOT`, texts the temp password back. This is a **different, additional** recovery path from the Super Admin-triggered one in C3 — this one is self-service and requires the user to still have Telegram access; C3 is for when they don't.
- [x] `/myid` — replies with the sender's Telegram chat ID (used for bootstrap setup).

#### C3 — Users Controller (`server/controllers/users.controller.js`) — account management, not creation

**Admin endpoints:**

- [ ] `PATCH /users/:id/deactivate` — Admin. Set `status=inactive`, increment `session_version`. Guard: cannot deactivate own account or a Super Admin (FR-017).
- [ ] `GET /users` — Admin. List all users with optional query filters: `role`, `status`, `department`. Paginate (limit/offset). Pending invites are a separate list (`GET /invites`), not mixed into this one.
- [ ] `GET /users/:id` — All Auth. Own profile always allowed; other profiles allowed for Admin+.
- [ ] `PATCH /users/:id/profile` — All Auth. Own profile only (non-Admin). Zod validated.
- [x] `POST /users`, `GET /users/pending`, `POST /users/:id/regenerate-invite` — **retired**, return `410 GONE` pointing callers at the `/invites` equivalents. The underlying `createUser` function in the controller is unreachable dead code (see Phase 8 in `tasks.md`).

**Super Admin endpoints:**

- [ ] `GET /admin/audit-logs` — Super Admin. Paginated list from `admin_audit_log`. Filters: `actor_id`, `action`, `target_id`, date range.
- [ ] `POST /admin/users/:id/reset-login` — Super Admin. **Rewrite in place** (see `handoff.md` —
  current implementation still calls the removed `otp_sessions` model and is broken).
  New behavior: generate a temporary password, hash it (bcrypt, cost 12), set
  `password_hash` + `must_change_password = true`, increment `session_version` (revokes
  existing sessions), send the temp password to the user via `telegram.service.js` (no email/SMS),
  write `RESET_USER_LOGIN` to `admin_audit_log`. Guard: cannot reset a Super Admin's own
  password through this endpoint (matches existing guard — see open question in `handoff.md`
  re: last-Super-Admin recovery). This is additional to, not a replacement for, the
  self-service `/resetpassword` bot command in C2b — it exists for when the user has lost
  Telegram access too, not just their password.
- [ ] `DELETE /admin/hard-delete/:resource/:id` — Super Admin. Permanent delete by resource type. Requires `resource` to be a known table name (whitelist). Log to audit.
- [ ] `GET /admin/settings` — Super Admin. Return system settings row.
- [ ] `PATCH /admin/settings` — Super Admin. Update settings.

#### C4 — Audit Service
- [ ] `server/services/audit.service.js`
  - `logAction({ actorId, action, targetId, targetType, metadata })` — writes to `admin_audit_log`
  - Called after invite create/regenerate/cancel, password reset, hard delete, deactivation
  - Fire-and-forget with error logging — audit failure never blocks the main response

---

### Phase D — Authentication Frontend (Day 3)

**Goal**: Login page working end-to-end in browser. Faculty can log in with email + password.

#### D1 — Login Page (`src/pages/auth/LoginPage.jsx`)

Single-step form:
- Inputs: Email, Password
- Button: "Log In"
- Calls `POST /api/auth/login`
- On success: update `['currentUser']` query cache; if `must_change_password` is true,
  redirect to `ChangePasswordPage`; otherwise redirect to role dashboard
- Error states: invalid credentials (generic — no account enumeration), rate limited, service unavailable

**Design notes:**
- Mobile-first, full-screen layout
- SIMS branding — college name in header
- Clear error messaging for all failure modes
- No Telegram ID / OTP field anywhere on this page

#### D1b — Change Password Page (`src/pages/auth/ChangePasswordPage.jsx`)
- Shown when `must_change_password === true` — on first login, or after a Super
  Admin-triggered password reset
- Inputs: Current Password (skipped if this is a first-time set — no `password_hash` yet),
  New Password, Confirm New Password
- Calls `POST /api/auth/change-password`
- On success: `must_change_password` cleared, redirect to role dashboard

#### D2 — Auth Hook (`src/hooks/useAuth.js`)
- `useCurrentUser()` — TanStack Query fetching `GET /api/users/me`
- `useLogin()` — mutation for `POST /auth/login`
- `useChangePassword()` — mutation for `POST /auth/change-password`
- `useLogout()` — mutation for logout, clears query cache on success

#### D3 — Protected Route (`src/components/ProtectedRoute.jsx`)
- Wraps `useCurrentUser()`
- If loading: show spinner
- If no user / 401: redirect to `/login`
- If `requiredRole` prop provided: check role, show 403 page if mismatch
- Renders `<Outlet />` on success

#### D4 — App Router (`src/App.jsx`)
```
/ → redirect to /login (if unauth) or /dashboard (if auth)
/login → LoginPage (public)
/dashboard → ProtectedRoute → role-based redirect
/admin/users → ProtectedRoute (Admin+) → UsersPage (includes password-reset action for Super Admin)
/super-admin/audit-logs → ProtectedRoute (Super Admin) → AuditLogsPage
/faculty/dashboard → ProtectedRoute (Faculty) → DashboardPage (stub)
```

---

### Phase E — User Management Frontend (Day 4)

**Goal**: Admin can invite, list, and deactivate users from the UI; pending invites are
tracked separately until Telegram-activated.

#### E1 — Users Page (`src/pages/admin/UsersPage.jsx`) — already implemented, matches this model
- [x] Table: all active/deactivated users — name, role badge, dept, status, created date, actions
- [x] Filters: role dropdown, status dropdown
- [x] "+ Invite User" button → modal form (not "Create User" — no direct-create form exists)
- [x] Separate "Pending Invites" section: name, email, role, expiry, per-row Regenerate/Cancel menu
- Per-row actions on active users: Deactivate/Reactivate
- Role badge colours: Super Admin = red, Admin = amber, Faculty = blue

#### E2 — Invite Form
- Fields: Name, Email, Phone, Department, Designation, Role (Faculty only if actor is Admin; Faculty or Admin if actor is Super Admin — **never Super Admin**, the schema forbids it)
- Zod validation mirrored client-side (`createInviteSchema`)
- Submit → `POST /api/invites`
- On success: invalidate `invites` + `users` queries, close modal, show toast; regenerate/cancel actions call their respective `/invites/:id/*` endpoints

#### E3 — Password Reset Action (within `UsersPage.jsx`, Super Admin only)
- Per-row "Reset Password" action, visible only to Super Admin, hidden for the actor's own row
- Confirmation dialog before reset (explains a temp password will be sent via Telegram)
- Calls `POST /api/admin/users/:id/reset-login` (`useResetUserLogin()` — must be wired up;
  currently exported from `useUsers.js` but has no caller anywhere in the client)
- On success: toast confirming the user was notified via Telegram
- `AuditLogsPage.jsx` (`super-admin/`) shows the resulting `RESET_USER_LOGIN` audit entries

#### E4 — Hooks
- `src/hooks/useUsers.js`: `useUsers(filters)` — paginated list; `useDeactivateUser(id)`;
  `useReactivateUser(id)`; `useResetUserLogin(id)` — mutation (exists; needs a UI caller — see E3)
- `src/hooks/useInvites.js` — already implemented: `useInvites()` (list), `useCreateInvite()`,
  `useRegenerateInvite(id)`, `useCancelInvite(id)`, each invalidating the relevant queries on success

---

### Phase F — Seed, Testing & Polish (Day 5)

#### F1 — Database Seed
- [x] `prisma/seed.js` — creates Super Admin user from `BOOTSTRAP_SUPER_ADMIN_*` env vars,
  including a real `password_hash` (from `BOOTSTRAP_SUPER_ADMIN_PASSWORD` if set, otherwise a
  generated password printed to console once — never hardcoded, never written to disk),
  `must_change_password = true`. `telegram_id` still required (used for notifications).
- [ ] Add `prisma.seed` to `package.json` → `node prisma/seed.js`
- [ ] Document: "Run seed before first use"

#### F2 — Environment & Deploy
- [ ] Verify all `.env` variables documented in `.env.example`
- [ ] Test Railway deployment — `npm run build` + `npm start`
- [ ] Confirm `NODE_ENV=production` sets cookie `secure: true`
- [ ] Add `CORS_ORIGIN` env var and validate in server

#### F3 — Edge Case Handling
- [x] Rate limit `POST /auth/login`: 50 per 15min per IP (production)
- [ ] Admin deactivating own account → blocked (FR-017)
- [ ] Admin inviting an Admin or Super Admin account → blocked (FR-009); Super Admin inviting a Super Admin account → blocked at the schema level (FR-016 known gap)
- [ ] Only Super Admin account locked/forgets password → no in-app recovery; manual DB
  intervention documented (see spec.md Assumptions)
- [ ] Super Admin-triggered password reset when Telegram send fails → decide whether reset
  still succeeds with the temp password shown in the API response as a fallback, or fails
  outright (open question — see `handoff.md`)

#### F4 — Acceptance Criteria Sign-off Checklist
- [ ] SC-001: Full login flow under 60 seconds ✓
- [ ] SC-002: Invalid credentials always rejected with a generic error (no account enumeration) ✓
- [ ] SC-003: Super Admin-triggered password reset revokes the session and forces a change on next login, no bypass ✓
- [ ] SC-004: All 3 roles independently accessible, no cross-role leakage ✓
- [ ] SC-005: Admin invites a Faculty account, deactivates/lists any account, in ≤ 3 clicks; Admin inviting Admin/Super Admin always rejected ✓
- [ ] SC-006: 100% protected routes reject unauthenticated requests ✓
- [ ] SC-007: Every Super Admin password reset logged in audit table ✓

---

## API Endpoints Implemented This Week

| Method | Endpoint | Controller | Auth |
|---|---|---|---|
| POST | /auth/login | auth.controller | Public |
| POST | /auth/change-password | auth.controller | All Auth |
| POST | /auth/logout | auth.controller | All Auth |
| GET | /users/me | users.controller | All Auth |
| POST | /invites | invites.controller | Admin, Super Admin |
| GET | /invites | invites.controller | Admin, Super Admin |
| POST | /invites/:id/regenerate | invites.controller | Admin, Super Admin |
| DELETE | /invites/:id | invites.controller | Admin, Super Admin |
| PATCH | /users/:id/deactivate | users.controller | Admin |
| GET | /users | users.controller | Admin |
| GET | /users/:id | users.controller | All Auth |
| PATCH | /users/:id/profile | users.controller | All Auth |
| GET | /admin/audit-logs | users.controller | Super Admin |
| POST | /admin/users/:id/reset-login | users.controller | Super Admin |
| DELETE | /admin/hard-delete/:resource/:id | users.controller | Super Admin |
| GET | /admin/settings | users.controller | Super Admin |
| PATCH | /admin/settings | users.controller | Super Admin |
| ~~POST~~ | ~~/users~~ | ~~users.controller~~ | **410 GONE — retired, use `/invites`** |
| ~~GET~~ | ~~/users/pending~~ | ~~users.controller~~ | **410 GONE — retired, use `GET /invites`** |
| ~~POST~~ | ~~/users/:id/regenerate-invite~~ | ~~users.controller~~ | **410 GONE — retired, use `/invites/:id/regenerate`** |

Total: **17 live endpoints** (14 functional + `/users/me` for frontend session, replacing the
previous count that included the now-retired `POST /users` trio)

---

## Database Tables Used This Week

| Table | Operations |
|---|---|
| `users` | SELECT, INSERT (only via bot invite activation), UPDATE |
| `pending_invites` | SELECT, INSERT, UPDATE (regenerate), DELETE (cancel/activate) |
| `telegram_relink_tokens` | SELECT, INSERT, UPDATE (used by Super Admin reset-login rewrite) |
| `admin_audit_log` | INSERT (immutable) |

> `admin_audit_log` handles system-level actions (password resets, invite create/regenerate/cancel, account changes). Kept separate from `violation_audit_log` which is scoped to violation records only.

---

## Packages to Install

### Server
```
express cookie-parser cors helmet morgan express-rate-limit
jsonwebtoken bcryptjs
@prisma/client prisma
zod
winston
axios
dotenv
nodemon (dev)
```

### Client
```
react react-dom
vite @vitejs/plugin-react
tailwindcss postcss autoprefixer
@tanstack/react-query
axios
react-router-dom
```

---

## Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Telegram Bot not set up yet | Notifications degrade gracefully if unreachable (fire-and-forget, logged); login is unaffected since it no longer depends on Telegram |
| Railway PostgreSQL cold start | Add retry logic on Prisma connect in `server/index.js` |
| Password brute-force | IP rate limiting only (50/15min prod) — no per-account lockout; revisit if abuse is observed |
| httpOnly cookie not sent in dev | Vite proxy `/api` → localhost:3000 handles CORS; `withCredentials: true` on Axios |
| First Super Admin chicken-and-egg | Seed script creates the account directly with a real password (env-provided or generated-and-shown-once) |
| Only Super Admin account locked/password lost | No in-app recovery path exists — documented as requiring direct DB intervention (spec.md Assumptions) |
| Invited person never taps their Telegram link | No account is created; invite sits `pending` until 7-day expiry or is regenerated/cancelled by Admin/Super Admin |
| No way to create a 2nd Super Admin | `createInviteSchema` only accepts `role: 'admin' \| 'faculty'` — known gap (FR-016), unresolved |

---

## What Is NOT in This Week

- Duty calendar, duty slots, attendance — Week 2
- Violations — Week 3
- Cover requests, messaging — Phase 2
- Reports — Phase 3
- Photo attachments — foundation only, not implemented
- Email/SMS notifications — never, Telegram only

---

*Plan version: 3.0 — Generated: 2026-06-06, revised 2026-07-03 for Option A2 (permanent
email/password auth), revised again 2026-07-03 to describe the real invite-based account
creation flow (`POST /users` retired) instead of direct creation*
*Implements: spec.md Week 1 | Constitution v2.9*
