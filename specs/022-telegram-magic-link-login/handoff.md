# Handoff Report

## task_id
022-telegram-magic-link-login / full implementation (T001–T022) (2026-07-14)

## status
complete

## completed
- **Schema**: `TelegramLoginToken` Prisma model + `User` back-relation (`prisma/schema.prisma`);
  migration `20260714141140_add_telegram_login_tokens` generated and applied; Prisma Client
  regenerated.
- **Validation**: `telegramLoginTokenParamSchema` added to `server/schemas/auth.schema.js`.
  `server/middleware/validate.js` generalized to take an optional `source` argument
  (`'body'`/`'params'`/`'query'`, defaults to `'body'` — every existing call site is unaffected)
  since the existing middleware only ever validated `req.body`.
- **Bot**: `handleLoginRequest(chatId)` in `server/lib/bot.js` — looks up the user by
  `telegram_id`, rejects not-linked/inactive accounts with a message directing them to password
  login + linking Telegram from Profile, throttles to 1 request per 30s per user (via the
  token table's own `created_at`, no new `User` column), supersedes any prior unused token
  (`deleteMany`) before creating a new one, sends an inline "Log in" button via
  `telegram.sendMessage`. Wired into the webhook dispatch for both `/login` and the
  `t.me/<bot>?start=login` deep link (`/start login`).
- **Claim endpoint**: `telegramLogin(req, res)` in `server/controllers/auth.controller.js` +
  `GET /auth/telegram/:token` in `server/routes/auth.routes.js` (public, own rate limiter,
  Zod-validated param). Atomic claim via a single conditional `updateMany` — no raw SQL, no
  explicit row lock. **Found and fixed a real TOCTOU bug during testing**: the original
  implementation did the diagnostic "why did this fail" lookup *before* attempting the claim,
  so a losing concurrent request's error message reflected stale pre-claim state instead of the
  winner's just-committed `used_at`, misreporting `not_found` instead of `used`. Fixed by
  reordering — claim first, diagnose only on failure — and updated
  `contracts/telegram-login-endpoint.md` to match. On success, issues the identical
  `sims_token`/`sims_csrf` cookies `POST /auth/login` sets, logs `TELEGRAM_LOGIN` to
  `admin_audit_log` (best-effort, mirrors `PASSWORD_LOGIN`'s non-fatal handling), redirects to
  `/`. On failure, redirects to `/login?telegram_error=<expired|used|inactive_account|not_found>`.
- **Client**: `client/src/pages/auth/LoginPage.jsx` gained a "Log in via Telegram" link
  (`https://t.me/${VITE_TELEGRAM_BOT_USERNAME}?start=login`, shown only if that env var is set)
  and a `telegram_error` query-param banner mapping each failure code to a plain-language
  message. `VITE_TELEGRAM_BOT_USERNAME` added to `client/.env.example` and this dev environment's
  `client/.env` (placeholder value — no real bot configured yet).
- **Tests**: 8 new Vitest cases in `server/tests/auth.test.mjs` (`describe('telegramLogin')`) —
  success + cookie-setting, audit logging, expired, used, inactive (deactivated), inactive
  (soft-deleted), not-found, and a genuine concurrency test (two simultaneous claims on one
  token, exactly one succeeds) that's what caught the TOCTOU bug above.
- **Full regression**: `npx vitest run` (server) — **106/106 pass**, zero failures, zero changes
  to any pre-existing test. `npm run build` (root/client) — builds clean, 0 errors (one
  pre-existing chunk-size warning, unrelated to this feature).
- **Live validation** (quickstart.md Path B, no real Telegram bot needed): inserted real token
  rows against the running local dev DB via a one-off script, then `curl`'d
  `GET /auth/telegram/:token` directly — confirmed a fresh token returns `302` to `/` with both
  `sims_token` (httpOnly) and `sims_csrf` cookies set; the same token reused returns
  `telegram_error=used`; an expired token returns `telegram_error=expired`; a nonexistent token
  returns `telegram_error=not_found`. Confirmed `POST /auth/login` still responds correctly
  (proper `INVALID_CREDENTIALS` JSON, not a crash) — full password-login regression proof lives
  in the Vitest suite itself (all pre-existing `login`/`changePassword` tests untouched and
  passing).
- **CONSTITUTION.md updated** (v3.16 → 3.17) — §2 Infrastructure Auth row, §4 Authentication (new
  subsection), §5 Database (new `telegram_login_tokens` row), §6 API (Authentication 3→4, total
  114→115), version history entry explaining this is an additive reopening of the earlier
  Telegram-OTP decision, not a silent reversal — owner-approved before spec work began.

## failed_or_blocked
- Nothing blocked. The only real defect found (the TOCTOU error-message ordering bug) was caught
  by the concurrency test itself during this session and fixed before completion — see
  `commands_run` for the before/after test run showing the failure and the fix.
- The live-bot round trip (Telegram actually delivering `/login` replies) was **not** exercised —
  `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` are still placeholders in this dev environment (no
  real bot created yet). Everything downstream of "a token exists" was validated directly against
  the running server and database instead (quickstart.md Path B).

## commands_run
```
npm run migrate -- --name add_telegram_login_tokens   # applies cleanly
npm run generate                                       # regenerated after stopping dev server (EPERM lock)
npx vitest run tests/auth.test.mjs                      # 1 failed (TOCTOU bug surfaced) -> fixed -> 22/22 pass
npx vitest run                                          # 106/106 pass (full suite, post-fix)
npm run build                                           # client build: 0 errors
node -e "...create TelegramLoginToken row..."           # x4, for manual curl validation
curl -i http://localhost:3000/auth/telegram/<token>     # x4 (fresh/reused/expired/not_found)
curl -X POST http://localhost:3000/auth/login ...       # confirms password login unaffected
```

## constraints_discovered
- `server/middleware/validate.js` only ever validated `req.body` — had to generalize it (backward
  compatible, default param) to validate a route param, since this feature's `:token` isn't in
  the body.
- npm workspace `dev` scripts hold an OS-level lock on the Prisma query engine DLL on Windows —
  `npm run generate` after a schema change fails with `EPERM` while the dev server is running.
  Had to stop it first (confirmed with the user before force-killing node processes, since a
  blanket PID kill is inherently risky) and restart afterward.
- Confirmed via `server/middleware/csrf.js` that `GET` requests are entirely outside CSRF
  enforcement (only `POST/PUT/PATCH/DELETE` are checked) — the new claim endpoint needed no CSRF
  handling at all, by construction.

## deviations_from_constitution
- The one already tracked throughout this feature: Telegram now used for login, not just
  notification. Now reconciled — CONSTITUTION.md itself has been updated (see `completed` above)
  so this is no longer a deviation from the document, just a documented capability.

## files_touched
- prisma/schema.prisma — `TelegramLoginToken` model + `User` back-relation
- prisma/migrations/20260714141140_add_telegram_login_tokens/ — NEW
- server/schemas/auth.schema.js — `telegramLoginTokenParamSchema`
- server/middleware/validate.js — generalized to accept a `source` param
- server/lib/bot.js — `handleLoginRequest`, `/login`/`/start login` dispatch wiring
- server/controllers/auth.controller.js — `telegramLogin`
- server/routes/auth.routes.js — `GET /telegram/:token` + dedicated rate limiter
- server/tests/auth.test.mjs — 8 new `telegramLogin` test cases
- client/src/pages/auth/LoginPage.jsx — "Log in via Telegram" link + `telegram_error` banner
- client/.env.example, client/.env — `VITE_TELEGRAM_BOT_USERNAME`
- CONSTITUTION.md — §2, §4, §5, §6, version history (v3.16 → 3.17)
- specs/022-telegram-magic-link-login/tasks.md — all 22 tasks marked `[X]`
- specs/022-telegram-magic-link-login/contracts/telegram-login-endpoint.md — corrected claim
  ordering (claim-then-diagnose, not diagnose-then-claim) to match the actual, fixed
  implementation
- specs/022-telegram-magic-link-login/handoff.md — this file

## open_questions_for_owner
- None blocking — feature is complete, tested, and documented. Only remaining step before this
  is usable in the real world is creating an actual Telegram bot and setting
  `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME`/`VITE_TELEGRAM_BOT_USERNAME` to real values (see
  `deploy/clone-checklist.md` step 2) — expected, not a defect of this feature.
