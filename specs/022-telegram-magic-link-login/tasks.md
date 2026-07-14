---
description: "Task list for Telegram Magic-Link Login (022)"
---

# Tasks: Telegram Magic-Link Login

**Input**: Design documents from `specs/022-telegram-magic-link-login/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md — all present.

**Tests**: Included — the spec's User Story 2 is explicitly about rejection/security behavior, so
test tasks are appropriate here (not purely optional boilerplate).

**Organization**: Tasks are grouped by user story (US1/US2/US3, matching `spec.md` priorities) so
each can be delivered and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to US1 / US2 / US3 from `spec.md`

---

## Phase 1: Setup

**Purpose**: Schema groundwork shared by every story.

- [X] T001 Add the `TelegramLoginToken` model and the `User` back-relation to `prisma/schema.prisma`, per `data-model.md` (UUID `id`, `user_id` FK, unique `token` varchar(100), `expires_at`, nullable `used_at`, `created_at`, `@@index([user_id])`, `@@map("telegram_login_tokens")`)
- [X] T002 Generate and apply the migration: `npm run migrate` (creates `prisma/migrations/<timestamp>_add_telegram_login_tokens/`)
- [X] T003 [P] Run `npm run generate` to regenerate the Prisma Client so `prisma.telegramLoginToken` is available

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Validation and rate-limiting scaffolding every story's implementation tasks need.

**⚠️ CRITICAL**: Complete before starting any user story phase.

- [X] T004 Add `telegramLoginTokenParamSchema` (Zod) to `server/schemas/auth.schema.js` validating the `:token` route param (non-empty string, bounded max length, hex-charset only)
- [X] T005 [P] Add a dedicated `express-rate-limit` instance for the Telegram-login claim route in `server/routes/auth.routes.js` (separate from the existing `authLimiter` on `/auth/login`; same shape — 50 req/15min/IP in production, relaxed in development)
- [X] T006 [P] Add `VITE_TELEGRAM_BOT_USERNAME` to `client/.env.example` (and this dev environment's `client/.env`) — needed by the client to build the `t.me/<bot_username>?start=login` deep link

**Checkpoint**: Schema, validation, and rate-limit scaffolding ready — user story work can begin.

---

## Phase 3: User Story 1 - Log in with a Telegram link instead of a password (Priority: P1) 🎯 MVP

**Goal**: A user with linked, verified Telegram can request a link and land on their dashboard,
fully authenticated, with no password.

**Independent Test**: Using `quickstart.md` Path B (works without a live bot token in this
environment), insert a token row directly for a known active user, `curl` the claim endpoint, and
confirm a `302` to `/` with `sims_token`/`sims_csrf` cookies set.

### Implementation for User Story 1

- [X] T007 [US1] Implement `handleLoginRequest(chatId)` in `server/lib/bot.js`: look up the user by `telegram_id = String(chatId)`; if not linked or not active, send a generic "can't log in this way" reply (wording refined in US3); otherwise create a `TelegramLoginToken` (32-byte random hex, `expires_at = now() + 10 min`) and send a message with an inline "Log in" button (`reply_markup`, same mechanism as the existing Accept/Reject buttons) linking to `${APP_URL}/auth/telegram/<token>`, delivered via the existing `sendWithRetryOrFlag` retry pattern
- [X] T008 [US1] Wire `/login` (bare command) and `/start login` (deep-link payload) message matching into `bot.js`'s existing dispatch, alongside the current `/resetpassword` / `/start invite_.../relink_...` handling, routing both to `handleLoginRequest` (depends on T007)
- [X] T009 [US1] Implement `telegramLogin(req, res)` in `server/controllers/auth.controller.js`: read-only `findUnique` by token (for error-message purposes only), then atomic claim via `prisma.telegramLoginToken.updateMany({ where: { token, used_at: null, expires_at: { gt: new Date() }, user: { status: 'active', deleted_at: null } }, data: { used_at: new Date() } })`; on `count === 1`, fetch the user, issue `sims_token`/`sims_csrf` cookies with the same `authCookieOptions()`/`csrfCookieOptions()` and JWT payload shape `login()` uses, write a best-effort `logAction({ action: 'TELEGRAM_LOGIN', actorId: user.id, targetId: user.id, targetType: 'user' })`, and `302` redirect to `/`; on `count === 0`, redirect to `/login?telegram_error=<code>` per `contracts/telegram-login-endpoint.md`'s code table (depends on T001–T003)
- [X] T010 [US1] Add `GET /telegram/:token` to `server/routes/auth.routes.js` — public route (no `authenticate` middleware), using the rate limiter from T005 and `validate(telegramLoginTokenParamSchema)` from T004, calling `ctrl.telegramLogin` (depends on T004, T005, T009)
- [X] T011 [P] [US1] Add a "Log in via Telegram" link to `client/src/pages/auth/LoginPage.jsx`, pointing at `https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME}?start=login` (depends on T006)

**Checkpoint**: User Story 1 is fully functional and independently testable — link-based login
works end to end (live-bot round trip pending a real `TELEGRAM_BOT_TOKEN`; claim logic itself
fully provable now via `curl`).

---

## Phase 4: User Story 2 - Expired or reused links are rejected (Priority: P2)

**Goal**: Expired, already-used, raced, or superseded links are all safely rejected, and
request-spam is throttled.

**Independent Test**: Generate a link, use it once, then try again — confirm the second attempt is
rejected and the first session is unaffected; let a link sit past 10 minutes and confirm rejection;
fire two claims at the same token concurrently and confirm exactly one succeeds.

### Tests for User Story 2

- [X] T012 [P] [US2] Add Vitest cases to `server/tests/auth.test.mjs`: expired token → `telegram_error=expired`; already-used token → `telegram_error=used`; two concurrent claim attempts on the same valid token (via `Promise.all`) → exactly one succeeds, the other rejected (depends on T009)

### Implementation for User Story 2

- [X] T013 [US2] In `handleLoginRequest` (`server/lib/bot.js`), before creating a new token, `deleteMany` any existing unused (`used_at: null`) token for that `user_id`, per `research.md` §2 (depends on T007)
- [X] T014 [US2] Add a 30-second per-user rate-limit check to `handleLoginRequest`: query the most recently created token for that user; if `created_at` is within the last 30 seconds, reply "you already have a login link — check the message above" instead of issuing a new one (depends on T007, T013)
- [X] T015 [P] [US2] Add a `telegram_error` query-param banner to `client/src/pages/auth/LoginPage.jsx`, mapping `expired` / `used` / `inactive_account` / `not_found` to the plain-language messages from `contracts/telegram-login-endpoint.md` (depends on T011)

**Checkpoint**: US1 + US2 — link-based login is now safe against expiry, replay, races, and spam.

---

## Phase 5: User Story 3 - Accounts that can't or shouldn't use this method fall back safely (Priority: P3)

**Goal**: Users without linked Telegram keep using password login unaffected; deactivated/deleted
accounts can never complete a pending login, even with an unexpired token.

**Independent Test**: Confirm a user with no linked Telegram gets a clear "use your password"
reply from the bot with no token issued; confirm deactivating a user after a token was issued
blocks that token's claim even though it hasn't expired; confirm existing password-login tests are
untouched.

### Tests for User Story 3

- [X] T016 [P] [US3] Add Vitest cases to `server/tests/auth.test.mjs`: deactivating (or soft-deleting) a user after token issuance causes the claim to fail with `telegram_error=inactive_account` even though the token itself is still unexpired and unused (depends on T009)
- [X] T017 [P] [US3] Run the full existing `server/tests/auth.test.mjs` password-login suite unmodified and confirm 100% pass — zero regression (depends on T009, T010)

### Implementation for User Story 3

- [X] T018 [US3] Refine `handleLoginRequest`'s not-linked/inactive reply text in `server/lib/bot.js` to explicitly direct the user to password login and linking Telegram from their Profile page first, per `contracts/bot-commands.md` (depends on T007)

**Checkpoint**: All three user stories are independently functional. Feature is feature-complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Wrap-up that spans all three stories — done only after US1–US3 are verified working.

- [X] T019 Run `npx vitest run` (from `server/`) and `npm run build` (client) — confirm 0 failures, 0 build errors
- [X] T020 Run `quickstart.md` end to end (Path A if a real `TELEGRAM_BOT_TOKEN` is available by then, otherwise Path B) and record the outcome
- [X] T021 [P] Update root `CONSTITUTION.md` §2 Infrastructure (Auth row) and §4 Authentication to document Telegram magic-link login as an accepted, current, additive login method — only after T019/T020 pass, per the project owner's own instruction to update the constitution once the feature is actually built, not before
- [X] T022 Update `specs/022-telegram-magic-link-login/handoff.md` to reflect implementation completion, per `CLAUDE.md`'s handoff convention

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (needs the Prisma Client from T003 for T004/T005 to be meaningful, though T004–T006 could technically be written before T003 finishes generating). Blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational + US1 (hardens the claim/request logic US1 builds — `handleLoginRequest` and `telegramLogin` must exist first).
- **User Story 3 (Phase 5)**: Depends on Foundational + US1 (refines the same `handleLoginRequest` and re-tests the same `telegramLogin`). Independent of US2 — could be built in either order relative to it.
- **Polish (Phase 6)**: Depends on US1, US2, and US3 all being complete.

### Parallel Opportunities

- T003, T005, T006 can run in parallel with each other (different files/concerns).
- T011 (client link) can run in parallel with T009/T010 (backend claim endpoint) once T006 is done.
- T012, T015 (US2) and T016, T017 (US3) are all independent test/verification tasks on different concerns and can run in parallel once their respective dependencies (T009, T011, T013) are met.

---

## Parallel Example: User Story 1

```bash
# Once Foundational (Phase 2) is done, these can proceed in parallel:
Task: "Add VITE_TELEGRAM_BOT_USERNAME + 'Log in via Telegram' link in client/src/pages/auth/LoginPage.jsx"   # T006 + T011
Task: "Implement handleLoginRequest in server/lib/bot.js"                                                     # T007
# T008-T010 are sequential (dispatch wiring → controller → route, each building on the last)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (US1) — the core link-based login flow.
3. **STOP and VALIDATE** using `quickstart.md` Path B (no live bot token needed).
4. This alone is demoable: a manually-inserted token can be claimed, issuing a real session.

### Incremental Delivery

1. Setup + Foundational → schema and validation ready.
2. US1 → core flow works → validate via Path B → demo.
3. US2 → hardens against expiry/replay/races/spam → validate via new Vitest cases → demo.
4. US3 → confirms safe fallback + zero regression on password login → validate via Vitest → demo.
5. Polish → full test/build pass, then (only then) update `CONSTITUTION.md` and the feature's `handoff.md`.

## Notes

- The atomic-claim logic in T009 already necessarily enforces expiry/used/active checks (it can't
  function securely without them) — US2/US3 add the *specific hardening and test coverage* for
  those paths (superseding, rate-limiting, precise error messaging, regression proof), not the
  first working version of the checks themselves.
- Constitution update (T021) is deliberately last — it should describe what's actually shipped and
  verified, not what's planned.
