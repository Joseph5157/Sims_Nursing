# Implementation Plan: Telegram Magic-Link Login

**Branch**: `022-telegram-magic-link-login` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-telegram-magic-link-login/spec.md`

## Summary

Add a second, optional login path — a Telegram magic link — alongside the existing email+password
login. A user with a linked, verified Telegram account sends `/login` to the bot (or taps a
"Log in via Telegram" deep link on the web login page, which opens the same bot command). The bot
issues a single-use, 10-minute token and sends back a link. Opening the link hits a new public
`GET /auth/telegram/:token` endpoint that atomically claims the token (Prisma conditional
`updateMany`, no raw SQL, no explicit row lock needed), verifies the account is still active and
not deleted, issues the identical httpOnly-cookie JWT + CSRF session `POST /auth/login` issues
today (same `session_version` embedding), and redirects into the SPA root — the existing
`GET /users/me` bootstrap (`useCurrentUser`) then routes the user to their role's dashboard exactly
as it does after a fresh page load. Password login is untouched.

## Technical Context

**Language/Version**: Node.js (CommonJS, Express) + React 18 (Vite, JSX) — existing stack, no
version changes.

**Primary Dependencies**: Express, Prisma, `jsonwebtoken`, `bcryptjs`, Node's built-in `crypto`,
`express-rate-limit`, Zod, TanStack Query — all already in use; no new dependency required.

**Storage**: PostgreSQL via Prisma. One new table, `telegram_login_tokens`, shaped almost
identically to the existing `telegram_relink_tokens`.

**Testing**: Vitest (`server/tests/*.test.mjs`), matching the existing `auth.test.mjs` and
`bot.test.mjs` patterns.

**Target Platform**: Same Railway-hosted Node server + PWA client this app already runs on.

**Project Type**: Web application (existing monolith: `client/` + `server/` + `prisma/` at root).

**Performance Goals**: Request-to-dashboard under 15s under normal network conditions (spec
SC-001) — dominated by Telegram message delivery latency, not server processing.

**Constraints**: No raw SQL (Prisma only, per Constitution §2/§10); all inputs Zod-validated;
single-use enforcement must not depend on an explicit DB row lock the ORM doesn't naturally
expose; zero behavior change to the existing password-login path.

**Scale/Scope**: Same ~20–30 faculty per department instance this system already targets — token
volume is trivially small (at most a handful of live tokens system-wide at any moment).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> Read from root `CONSTITUTION.md` (v3.16) — **not** `.specify/memory/constitution.md`, which is
> a stale, unsynced mirror still describing a 4-role, Telegram-OTP-only, 14-table v2.0 system.
> That drift is a pre-existing housekeeping issue unrelated to this feature and is called out
> separately; it is not treated as authoritative here per `CLAUDE.md`'s instruction that root
> `CONSTITUTION.md` is the single source of truth.

| Gate | Status | Notes |
|---|---|---|
| Tech stack is locked (§2) | PASS | No new stack/dependency introduced. |
| Auth: email+password, Telegram notification-only (§2, §4) | Approved deviation | See Complexity Tracking below — explicitly surfaced to and approved by the project owner before spec work began. Password login is kept, not replaced. |
| Roles are fixed — exactly 3 (§3) | PASS | No role changes. |
| All deletes soft (`deleted_at`), UUID PKs, `DECIMAL(8,2)` money (§4 Data & Safety, §10) | PASS | New table uses a UUID PK; no monetary fields. No soft-delete field is added — see `research.md` "Token row lifecycle," which mirrors the already-accepted `telegram_relink_tokens` precedent (no `deleted_at`, rows persist with `used_at` as the mutation marker) rather than introducing a new exception. |
| No raw SQL except complex reports (§2, §10) | PASS | Single-use enforcement uses a conditional Prisma `updateMany` (see `research.md`), not raw SQL. |
| Zod validation on all API inputs (§2, §10) | PASS | New `:token` route param validated. |
| No hardcoded time thresholds (§10) | PASS | Token TTL is a named constant in one place (`server/lib/bot.js`), not scattered; this is a security TTL, not a duty-timing threshold the Duty Timing Settings feature governs — no `system_config` involvement. |

## Project Structure

### Documentation (this feature)

```text
specs/022-telegram-magic-link-login/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── bot-commands.md
│   └── telegram-login-endpoint.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                                   # + model TelegramLoginToken
└── migrations/<ts>_add_telegram_login_tokens/       # new migration

server/
├── lib/
│   └── bot.js                    # + /login and /start login handling, handleLoginRequest()
├── controllers/
│   └── auth.controller.js        # + telegramLogin(req, res)
├── routes/
│   └── auth.routes.js            # + GET /telegram/:token (public, rate-limited)
├── schemas/
│   └── auth.schema.js            # + telegramLoginTokenParamSchema
├── services/
│   └── audit.service.js          # reused as-is — new action string 'TELEGRAM_LOGIN'
└── tests/
    └── auth.test.mjs             # + Telegram-login test cases (mirrors existing login tests)

client/
└── src/pages/auth/
    └── LoginPage.jsx              # + "Log in via Telegram" deep link + ?telegram_error= banner
```

**Structure Decision**: This is a strict addition inside the existing monolith — no new
top-level directories, no new services. It touches exactly the files listed above plus one new
Prisma migration.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Telegram used for login, not just notification (Constitution §2 Infrastructure Auth row, §4 Authentication) | The project owner explicitly requested passwordless Telegram login as a convenience for users who already have Telegram linked, and explicitly approved overriding this specific locked decision (confirmed via direct question before any spec work began — see `spec.md`'s deviation note and `specs/022-telegram-magic-link-login/handoff.md`). Password login is kept in full, so this is additive, not a replacement of the locked mechanism. | Not applicable — this was a scope decision made directly by the project owner, not a technical shortcut. The constitution itself will be updated post-implementation (per owner's own answer) so it stops describing a narrower reality than the shipped code. |
