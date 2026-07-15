# Implementation Plan: Telegram OTP Login

**Branch**: `024-telegram-otp-login` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-telegram-otp-login/spec.md`

## Summary

Add a **third** login path — a typed 6-digit code delivered over Telegram — and make it the face of
`/login`. The user enters only their 4-digit SIMS ID; the server issues a bcrypt-hashed,
single-use, 5-minute code into a new `otp_login_codes` table and fires it to their linked Telegram
without awaiting delivery; the page advances to a code-entry step; a correct code issues the
**identical** httpOnly-cookie JWT + CSRF session `POST /auth/login` issues today.

Nothing is removed. The existing password login moves — unchanged, same server code path — to
`/login/password` as a break-glass door for when Telegram is unavailable. The 022 magic link stays
as-is. No user re-enrols, resets, or migrates anything.

Two guarantees carry the design: **(1)** the code is bcrypt-hashed, because at a 1,000,000-value
keyspace any fast hash is equivalent to plaintext; **(2)** exactly one session can ever come out of
one code, enforced by a conditional `updateMany` on the row's id — the same atomicity 022 uses,
re-keyed because a bcrypt hash cannot be matched in a `WHERE` clause.

## Technical Context

**Language/Version**: Node.js (CommonJS, Express) + React 18 (Vite, JSX) — existing stack, no
version changes.

**Primary Dependencies**: Express, Prisma, `jsonwebtoken`, `bcryptjs`, Node's built-in `crypto`,
`express-rate-limit`, Zod, TanStack Query — all already in use. **No new dependency.**

**Storage**: PostgreSQL via Prisma. One new table (`otp_login_codes`, shaped almost identically to
the existing `telegram_login_tokens`) plus one new nullable column on `users`
(`otp_locked_until`). The dormant `users.otp_failed_attempts` column is put back into service
rather than replaced.

**Testing**: Vitest (`server/tests/*.test.mjs`), following `auth.test.mjs` conventions — including
a genuine two-concurrent-redemptions test, which is what caught 022's TOCTOU bug.

**Target Platform**: Same Railway-hosted Node server + PWA client.

**Project Type**: Web application (existing monolith: `client/` + `server/` + `prisma/` at root).

**Performance Goals**: Full login under 60s (spec SC-001), dominated by Telegram delivery, not
server work. Deliberate ~250ms bcrypt cost on both request and verify — see Constraints.

**Constraints**:
- No raw SQL (Constitution §2/§10); all inputs Zod-validated.
- Single-use enforcement must not rely on an explicit row lock the ORM doesn't expose.
- **Zero behaviour change to the existing password-login and magic-link paths.**
- Code-request responses must not leak whether a SIMS ID exists — including via timing
  (`research.md` §4, which also records the honest residual).
- bcrypt's slowness is load-bearing here, not incidental: it is what makes a 20-bit secret
  survivable. It must not be "optimised" to a fast hash later.

**Scale/Scope**: ~20–30 faculty per department instance. Live code rows at any instant: a handful.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> Read from root `CONSTITUTION.md` (v3.18) — **not** `.specify/memory/constitution.md`, which is a
> stale, unsynced mirror describing a 4-role, 14-table, 55-endpoint, Telegram-OTP-only system that
> has not existed for a long time. 022's plan flagged this same drift; it is still unfixed. Per
> `CLAUDE.md`, root `CONSTITUTION.md` is the single source of truth. (Amusing wrinkle worth stating
> once: the stale mirror describes *OTP-only auth* — i.e. it accidentally describes something
> closer to this feature than the real constitution does. It is still not authoritative, and its
> "no passwords" claim is explicitly **not** what this feature does.)

| Gate | Status | Notes |
|---|---|---|
| Tech stack is locked (§2) | PASS | No new stack, no new dependency. |
| Auth: password + magic link; **"No Telegram OTP (the code-entry kind)"** (§2, §4) | **Approved deviation** | This is the feature. Owner-approved before spec work; see Complexity Tracking. Additive — password login and the magic link both survive untouched. |
| Roles are fixed — exactly 3 (§3) | PASS | No role changes. |
| Soft deletes (`deleted_at`), UUID PKs, `DECIMAL(8,2)` money (§4, §10) | PASS | `otp_login_codes` uses a UUID PK; no monetary fields. **No `deleted_at`** — deliberately mirrors the accepted `telegram_login_tokens` / `telegram_relink_tokens` precedent for ephemeral self-superseding token tables (`used_at` is the only mutation, no purge job). Not a new exception; consistency with two existing ones. |
| No raw SQL except complex reports (§2, §10) | PASS | Atomic claim is a conditional Prisma `updateMany` (`research.md` §2). |
| Zod validation on all API inputs (§2, §10) | PASS | Both new endpoints get schemas. |
| Never expose secrets (§10) | PASS | Code is bcrypt-hashed at rest (`research.md` §1); the plaintext exists only in memory and in the Telegram message. Never logged. |
| No hardcoded time thresholds (§10) | PASS | TTL (5min), cool-off (15min), attempt cap (5), request throttle (60s) are named constants in one module — **not** `system_config`. These are security parameters, not the duty-timing thresholds §10 governs; the magic link's 10-minute TTL set this precedent. |
| Audit trail for security events (§4) | PASS | New distinct `OTP_LOGIN` action; best-effort write per the v3.16 rule (never fail a succeeded login on an audit hiccup). |

**Post-Phase-1 re-check**: PASS — no gate moved. Design added no dependency, no raw SQL, no role
change, and no new soft-delete exception. The one deviation is unchanged and remains the
owner-approved reason the feature exists.

## Project Structure

### Documentation (this feature)

```text
specs/024-telegram-otp-login/
├── plan.md                  # This file
├── spec.md                  # Input
├── research.md              # Phase 0 output
├── data-model.md            # Phase 1 output
├── quickstart.md            # Phase 1 output
├── contracts/               # Phase 1 output
│   └── otp-login-endpoints.md
├── checklists/
│   └── requirements.md
├── handoff.md
└── tasks.md                 # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                              # + model OtpLoginCode; + User.otp_locked_until
└── migrations/<ts>_add_otp_login_codes/       # new migration (additive; nullable column, no backfill)

server/
├── lib/
│   └── otp.js                    # NEW — generateOtpCode(), constants (TTL/cool-off/cap/throttle)
├── controllers/
│   └── auth.controller.js        # + requestOtp(), verifyOtp()  (login/telegramLogin untouched)
├── routes/
│   └── auth.routes.js            # + POST /otp/request, POST /otp/verify (public, rate-limited)
├── schemas/
│   └── auth.schema.js            # + otpRequestSchema, otpVerifySchema
├── services/
│   └── audit.service.js          # reused as-is — new action string 'OTP_LOGIN'
└── tests/
    └── auth.test.mjs             # + OTP request/verify cases incl. concurrency + lock-lapse

client/
└── src/
    ├── App.jsx                                # + route /login/password
    └── pages/auth/
        ├── LoginPage.jsx                      # REWRITTEN — two-step OTP flow + link to fallback
        └── PasswordLoginPage.jsx              # NEW — the existing password form, moved verbatim
```

**Structure Decision**: A strict addition inside the existing monolith — no new top-level
directories, no new services, no new dependency. The only file whose *existing* behaviour changes
is `LoginPage.jsx`, and its old contents are preserved by being moved to `PasswordLoginPage.jsx`
rather than rewritten (`research.md` §7). Every server-side path that exists today is left
byte-for-byte alone; `requestOtp`/`verifyOtp` are new siblings of `login`, not modifications to it.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **Telegram OTP (the code-entry kind), which Constitution §4 explicitly forbids** — "No Telegram OTP (the code-entry kind), no SMS, no email OTP" | The owner explicitly asked for it and, when the conflict was surfaced, explicitly approved reopening the decision. There is a concrete capability gap behind the ask: the 022 magic link logs you in **on whatever device you tap it on**. A faculty member reading Telegram on their phone cannot use it to reach a desktop session. A typed code crosses that device boundary; a tapped link cannot. Password login and the magic link are both **kept**, so this is additive. FR-022 requires the constitution be amended with a version-history entry recording the reversal as deliberate — the same way 022 handled reopening this same broader question. | **The magic link (022)** — rejected: it is already shipped and it structurally cannot serve the cross-device case, which is the entire ask. **Doing nothing** — rejected by the owner. **Replacing password login outright**, which was the owner's *original* ask — rejected during spec: it would make Telegram a single point of failure with no way back in (revoked bot token, Telegram outage, network block, lost account → every user locked out, Super Admin included). Owner agreed; hence the break-glass fallback, and hence this feature is additive rather than a replacement. |
| **One new nullable column (`users.otp_locked_until`)** despite the owner's brief saying to reuse `otp_failed_attempts` and add nothing | FR-016's time-based cool-off needs a moment to count from. `otp_failed_attempts` is a bare `SmallInt` — it records *how many* failures, never *when*. The count alone cannot answer "has the cool-off elapsed?". The existing column **is** still reused, for the count. | **Deriving from an `otp_last_failed_at` column instead** — rejected: pushes both policy constants (5, 15min) into every read site; Constitution v3.14 exists precisely because a rule reimplemented in two places drifted apart. **A separate `otp_lockouts` table** — rejected: a whole table and a join on every login attempt, to hold one nullable timestamp per user. See `research.md` §3. |
