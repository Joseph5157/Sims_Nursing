---
description: "Task list for Telegram OTP Login (024)"
---

# Tasks: Telegram OTP Login

**Input**: Design documents from `specs/024-telegram-otp-login/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md — all present.

**Tests**: Included — `plan.md`'s Testing section explicitly calls for Vitest coverage including a
genuine concurrency test, and User Story 3 is entirely about security/rejection behavior. Not
boilerplate; several of these tests exist specifically to catch the landmines `research.md` and
`data-model.md` name (reset-on-lapse, leading zeros, the concurrent-claim race).

**Organization**: Tasks are grouped by user story (US1/US2/US3, matching `spec.md` priorities) so
each can be delivered and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to US1 / US2 / US3 from `spec.md`

---

## Phase 1: Setup

**Purpose**: Schema and constants groundwork shared by every story.

- [ ] T001 Add the `OtpLoginCode` model to `prisma/schema.prisma` per `data-model.md`: UUID `id`, `user_id` FK (relation `"OtpLoginCodes"`), `code_hash` varchar(255) (bcrypt — **not** unique-indexed, see the model's own doc comment on why a fast hash would be a real vulnerability at a 1,000,000-value keyspace), `expires_at`, nullable `used_at`, `created_at`, `@@index([user_id])`, `@@map("otp_login_codes")`. Also add `otp_locked_until DateTime?` (nullable, no default) and the `otpLoginCodes OtpLoginCode[] @relation("OtpLoginCodes")` back-relation to `User` — leave the existing `otp_failed_attempts` field exactly as-is, it is being reactivated, not redefined
- [ ] T002 Generate and apply the migration: `npm run migrate -- --name add_otp_login_codes` (creates `prisma/migrations/<timestamp>_add_otp_login_codes/`). Confirm the generated SQL only *adds* — a new table and one nullable column with no default that changes existing rows — per `data-model.md`'s "no backfill, no data migration" note
- [ ] T003 [P] Run `npm run generate` to regenerate the Prisma Client so `prisma.otpLoginCode` and `user.otp_locked_until` are available (stop the dev server first if running — Windows locks the Prisma engine DLL, per `specs/022-telegram-magic-link-login/handoff.md`)
- [ ] T004 [P] Create `server/lib/otp.js` with `generateOtpCode()` — returns a 6-digit numeric **string** (not a number: preserve leading zeros, `research.md` §1's keyspace point applies here too — use `crypto.randomInt(0, 1000000)` then `String(n).padStart(6, '0')`, never `Math.random()`) — and named constants for the five policy values this feature needs in one place: `OTP_TTL_MS` (5 min), `OTP_LOCKOUT_THRESHOLD` (5), `OTP_COOLOFF_MS` (15 min), `OTP_REQUEST_THROTTLE_MS` (60s). Per `research.md` §3's rationale, nothing outside this module should hardcode any of these four numbers

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Validation, rate-limiting, and CSRF scaffolding every story's implementation tasks need.

**⚠️ CRITICAL**: Complete before starting any user story phase.

- [ ] T005 [P] Add `otpRequestSchema` (Zod: `sims_id` — string matching `/^\d{4}$/`) and `otpVerifySchema` (Zod: `sims_id` — same; `code` — string matching `/^\d{6}$/`, **not** `z.number()`, per `contracts/otp-login-endpoints.md`'s leading-zero warning) to `server/schemas/auth.schema.js`
- [ ] T006 [P] Add two `express-rate-limit` instances to `server/routes/auth.routes.js` for the new routes — same shape as the existing `authLimiter` (50 req/15min/IP prod, relaxed in dev), one for `/otp/request` and one for `/otp/verify` (contract requires both endpoints rate-limited independently of the per-account counter added in Phase 5)
- [ ] T007 Add `/auth/otp/request` and `/auth/otp/verify` to the CSRF exemption in `server/middleware/csrf.js` (same `if (req.path === ...)` shape as the existing `/auth/login` line), per `contracts/otp-login-endpoints.md`'s CSRF section — these are unauthenticated credential endpoints with no ambient authority to forge, and the same class of stale-cookie lockout the `/auth/login` exemption already exists to prevent is reachable here too, just via a narrower path (`sims_token` present, `sims_csrf` cleared by something else, since only the latter is non-httpOnly)

**Checkpoint**: Schema, constants, validation, rate-limiting, and CSRF scaffolding ready — user
story work can begin.

---

## Phase 3: User Story 1 - Log in on a desktop using a code from my phone (Priority: P1) 🎯 MVP

**Goal**: A user with a linked, verified Telegram account can request a code, receive it in
Telegram, and enter it on any device to get the identical session password login issues today.

**Independent Test**: Using `quickstart.md` Path B (no live bot token needed) — plant a known code
via a one-off script, `curl` `/otp/verify` with it, confirm a `200` with both cookies set and a
body shaped like `POST /auth/login`'s response.

### Tests for User Story 1

- [ ] T008 [P] [US1] Add Vitest cases to `server/tests/auth.test.mjs` for `requestOtp`: valid active user with linked Telegram → generic `200`, one `OtpLoginCode` row created with a bcrypt-shaped `code_hash` (assert it does NOT equal the plaintext and does NOT look like a fast-hash digest); requesting again immediately → still `200`, no second row (60s throttle, T004's constant)
- [ ] T009 [P] [US1] Add Vitest cases to `server/tests/auth.test.mjs` for `verifyOtp` happy path: correct unexpired unused code → `200`, response body shape matches `login()`'s (`safeUser(user)` + `must_change_password`), `sims_token` cookie has `HttpOnly`, `sims_csrf` does not, JWT payload contains `sub`/`role`/`session_version` matching the user row
- [ ] T010 [P] [US1] Add a Vitest case verifying a code with leading zeros (e.g. `"048291"`) round-trips correctly end to end — plant it, submit the exact string, expect `200` (guards the `research.md` §1 / contract leading-zero footgun directly, not just via type-checking)
- [ ] T011 [P] [US1] Add a Vitest case for `must_change_password` propagation: a user with `must_change_password: true` who logs in via OTP gets that value `true` in the response body, matching what password login would return for the same user (FR-011)

### Implementation for User Story 1

- [ ] T012 [US1] Implement `requestOtp(req, res)` in `server/controllers/auth.controller.js`: resolve `sims_id` → user via `prisma.user.findUnique`; **always** perform one `bcrypt.hash` call regardless of outcome (real code if deliverable, a discarded throwaway otherwise) so the dominant cost is uniform across branches (`research.md` §4); if user is missing, `deleted_at` set, `status !== 'active'`, no `telegram_id`/not `telegram_verified`, or the 60s per-account throttle (T004's constant, keyed off the existing code row's `created_at` per `research.md` §5) trips — do nothing further; otherwise `deleteMany` the user's unused codes then `create` a new `OtpLoginCode` (`expires_at = now + OTP_TTL_MS`) and fire the Telegram send **without awaiting it** (`research.md` §4 — awaiting turns delivery latency into a timing oracle); return the same generic `200` body on every single path, with no branch depending on `await` for the send (depends on T001–T004)
- [ ] T013 [US1] Implement `verifyOtp(req, res)` in `server/controllers/auth.controller.js` — happy-path shape only in this phase (lock-checking and attempt-counting are Phase 5): resolve `sims_id` → user; `findFirst` the live `OtpLoginCode` (`user_id`, `used_at: null`, `expires_at: { gt: new Date() }`); `bcrypt.compare` the submitted code against `code_hash`; on match, atomically claim via `prisma.otpLoginCode.updateMany({ where: { id: row.id, used_at: null }, data: { used_at: new Date() } })` and proceed **only if `count === 1`** (per `research.md` §2 — this update is the sole authorization decision, nothing about the earlier read is reported to the caller); re-check the user is still active/not deleted (state can change between issue and redemption); on success issue `sims_token`/`sims_csrf` with the same `authCookieOptions()`/`csrfCookieOptions()` and JWT payload shape `login()` uses, write a best-effort `logAction({ action: 'OTP_LOGIN', actorId: user.id, targetId: user.id, targetType: 'user' })` in a try/catch that never turns a succeeded login into an error response (mirrors `login()`'s existing audit-write pattern exactly), and return `{ ...safeUser(user), must_change_password }` (depends on T001–T004)
- [ ] T014 [US1] Add `POST /otp/request` and `POST /otp/verify` to `server/routes/auth.routes.js` — both public (no `authenticate` middleware), using the rate limiters from T006 and `validate(otpRequestSchema)` / `validate(otpVerifySchema)` from T005, calling `ctrl.requestOtp` / `ctrl.verifyOtp` (depends on T005, T006, T007, T012, T013)
- [ ] T015 [US1] Rewrite `client/src/pages/auth/LoginPage.jsx` as the two-step OTP flow: step 1 asks only for the 4-digit SIMS ID and posts to `/auth/otp/request`; on response, advance to step 2 (6-digit code entry, posting to `/auth/otp/verify`); on success, follow the exact same post-login redirect logic the current password flow uses (role-based landing, `must_change_password` → `/change-password`). Preserve the existing `?telegram_error=` banner handling and the 022 "Log in via Telegram" link — both stay on this page (depends on T014)

**Checkpoint**: User Story 1 is fully functional and independently testable — code-based login
works end to end via Path B now; the live cross-device round trip (the feature's actual reason for
existing, per `quickstart.md` Path A) needs a real bot token but nothing about the flow itself is
blocked.

---

## Phase 4: User Story 2 - Get in when Telegram is unavailable (Priority: P1)

**Goal**: Password login remains fully functional at a distinct, stable, discoverable URL — proven
to work even with the Telegram bot completely switched off.

**Independent Test**: With the bot token unset/invalid, navigate to `/login/password`, log in with
a known SIMS ID and password, confirm a normal session — independent of anything in Phase 3.

### Implementation for User Story 2

- [ ] T016 [US2] Create `client/src/pages/auth/PasswordLoginPage.jsx` by moving the existing SIMS-ID+password form out of `LoginPage.jsx` **verbatim** (same fields, same `POST /auth/login` call, same error handling, same post-login redirect logic) — do not rewrite it, only relocate it, so `FR-020`/`FR-021`'s "zero behavior change" is satisfied structurally rather than by careful re-implementation
- [ ] T017 [US2] Add the `/login/password` route to `client/src/App.jsx`, rendering `PasswordLoginPage` — a plain top-level route, not nested under `/login`, so it works independently of the OTP page's health (depends on T016)
- [ ] T018 [P] [US2] Add a visible, discoverable link/button on `client/src/pages/auth/LoginPage.jsx` (from Phase 3) pointing to `/login/password`, satisfying FR-018 — must not require the user to already know or guess the URL (depends on T015, T017)
- [ ] T019 [P] [US2] Run the full existing `server/tests/auth.test.mjs` `login()` test suite unmodified and confirm 100% pass — zero regression, since `POST /auth/login`'s controller code is untouched by this feature (depends on T012, T013 existing alongside it, not replacing anything)

**Checkpoint**: US1 + US2 — code-based login is the default, and password login survives at its own
address, provably independent of Telegram's availability.

---

## Phase 5: User Story 3 - Be protected from someone guessing my code (Priority: P2)

**Goal**: An account locks after 5 consecutive wrong codes, the lock cannot be extended by
continued guessing, it lifts on its own after 15 minutes with a clean slate, and it can never
become permanent.

**Independent Test**: Repeatedly submit wrong codes for a test account and confirm the lock trips
at exactly 5, that a 6th attempt (even with the correct code) is rejected as locked, that a fresh
code request during cool-off is suppressed entirely, and — the one most likely to be silently wrong
— that a single failure *after* the cool-off has elapsed resets the counter to 1, not 6.

### Tests for User Story 3

- [ ] T020 [P] [US3] Add a Vitest case: 5 consecutive wrong codes for one user → the 5th response is a normal `401 INVALID_OTP`, but `user.otp_failed_attempts === 5` and `user.otp_locked_until` is set to roughly `now + OTP_COOLOFF_MS` afterward; a 6th attempt **with the correct code** → `401 OTP_LOCKED`, code is NOT consumed (`used_at` still `null`)
- [ ] T021 [P] [US3] Add a Vitest case: while `otp_locked_until` is in the future, `POST /otp/request` for that user → still the generic `200`, but **no new `OtpLoginCode` row is created** (`research.md` §6 — suppressed, not sent)
- [ ] T022 [P] [US3] Add the **reset-on-lapse** Vitest case directly from `data-model.md`'s worked example — this is the one most likely to look correct while being wrong: set `otp_locked_until` to one minute in the *past* directly via Prisma, plant a fresh code, submit **one wrong** code, then assert `otp_failed_attempts === 1` and `otp_locked_until === null`. If the implementation only clears the timestamp and not the counter, this test must fail (assert both fields explicitly, not just that verify was rejected)
- [ ] T023 [P] [US3] Add a Vitest case: successful verify resets `otp_failed_attempts` to `0` and `otp_locked_until` to `null`, even after some prior non-locking failures (e.g. 2 wrong attempts, then the correct code) — FR-014
- [ ] T024 [P] [US3] Add the **concurrency** Vitest case, mirroring 022's own concurrency test that caught a real TOCTOU bug there: plant one code, fire two simultaneous `verifyOtp` calls via `Promise.all`, assert exactly one resolves with a new session and the other is rejected — never both succeeding (FR-008, SC-008)

### Implementation for User Story 3

- [ ] T025 [US3] In `verifyOtp` (`server/controllers/auth.controller.js`), add the lock check as the **first** thing that happens after resolving the user — before any code lookup or attempt counting: if `otp_locked_until` is in the future, return `401 OTP_LOCKED` immediately, with **no** increment to `otp_failed_attempts` (per `data-model.md`'s ordering rule — counting attempts against an already-locked account would let continued guessing hold the lock open indefinitely, turning a bounded cool-off into unbounded denial of service) (depends on T013)
- [ ] T026 [US3] In the same function, add the **lapsed-lock** branch immediately after the lock check: if `otp_locked_until` is set but has already passed, clear **both** `otp_locked_until = null` **and** `otp_failed_attempts = 0` before continuing to the normal code-lookup flow — clearing only the timestamp is the specific bug T022's test exists to catch (depends on T025)
- [ ] T027 [US3] Add the failure-counting branch: on a `bcrypt.compare` mismatch, `increment` `otp_failed_attempts`; if the new value reaches `OTP_LOCKOUT_THRESHOLD` (T004's constant, 5), set `otp_locked_until = now + OTP_COOLOFF_MS` in the same update (depends on T013, T026)
- [ ] T028 [US3] Add the suppress-during-cool-off branch to `requestOtp` (`server/controllers/auth.controller.js`): if `otp_locked_until` is in the future, skip code generation and Telegram delivery entirely, still returning the generic `200` (depends on T012, T025)

**Checkpoint**: All three user stories are independently functional. Feature is feature-complete —
code login works, password fallback works, and brute-force is bounded and self-healing.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Wrap-up spanning all three stories — done only after US1–US3 are verified working.

- [ ] T029 Run `npx vitest run` (from `server/`) and `npm run build` (client) — confirm 0 failures, 0 build errors, and specifically confirm the pre-existing `auth.test.mjs`/`bot.test.mjs` suites (password login, magic-link login, invite flows) are untouched and still passing
- [ ] T030 Run `quickstart.md` end to end — Path B at minimum (no bot token needed), Path A if a real `TELEGRAM_BOT_TOKEN` is available, **specifically including the cross-device step** (code read on phone, entered on a desktop that has never touched Telegram) since that is the feature's actual reason for existing, not just "does login work"
- [ ] T031 [P] Update root `CONSTITUTION.md` per `data-model.md`'s "Constitution impact" table — §2 Infrastructure Auth row (third login method), §4 Authentication (new subsection; amend, do not delete, the "No Telegram OTP (the code-entry kind)" sentence to record the reversal), §5 Database (17→18... **18→19** tables, new `otp_login_codes` row, note on `otp_failed_attempts` going from dormant to live, note on `otp_locked_until`), §6 API (Authentication 4→6, total 115→117), and a new version-history entry (v3.18→v3.19) explicitly recording this as deliberate and owner-approved, following the precedent 022 set (FR-022) — only after T029/T030 pass, since the constitution must describe what's actually shipped, not what's planned
- [ ] T032 Update `specs/024-telegram-otp-login/handoff.md` to reflect implementation completion, per `CLAUDE.md`'s handoff convention

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T005/T006/T007 are meaningful once T001–T004 exist, though could technically be drafted in parallel). Blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational. Independent of US1's *implementation* — `PasswordLoginPage.jsx` only needs the existing `login()` controller, which nothing in this feature touches — but T018 (the discoverable link) depends on `LoginPage.jsx` existing in its Phase 3 form.
- **User Story 3 (Phase 5)**: Depends on Foundational + US1 (hardens `verifyOtp`/`requestOtp`, which US1 creates). Independent of US2.
- **Polish (Phase 6)**: Depends on US1, US2, and US3 all being complete.

### Parallel Opportunities

- T003, T004 (Setup) can run in parallel with each other.
- T005, T006, T007 (Foundational) can run in parallel with each other — different files/concerns.
- T008–T011 (US1 tests) can be drafted in parallel with each other and, per TDD convention, before T012/T013 exist (expected to fail first).
- T020–T024 (US3 tests) are independent of each other and can all be drafted in parallel.
- T016 (US2) can proceed in parallel with all of Phase 3, since it only touches the existing, untouched `login()` path.

---

## Parallel Example: User Story 1

```bash
# Once Foundational (Phase 2) is done, these can proceed in parallel:
Task: "Add Vitest cases for requestOtp in server/tests/auth.test.mjs"          # T008
Task: "Add Vitest cases for verifyOtp happy path in server/tests/auth.test.mjs" # T009, T010, T011
# T012-T014 are sequential (controller functions → route wiring, each depending on the last)
# T015 (client) can start once T014's routes exist
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (US1) — the core code-based login flow.
3. **STOP and VALIDATE** using `quickstart.md` Path B.
4. This alone is demoable — but see the note below before calling it shippable.

### Incremental Delivery

1. Setup + Foundational → schema, constants, validation, CSRF exemption ready.
2. US1 → core flow works → validate via Path B → demo.
3. US2 → password fallback proven independent → validate with the bot switched off → demo.
4. US3 → brute-force bounded and self-healing → validate via the reset-on-lapse and concurrency
   tests specifically → demo.
5. Polish → full test/build pass, then (only then) update `CONSTITUTION.md` and `handoff.md`.

### A note on what "MVP" safely means here

Unlike a typical feature, **shipping US1 to production without US2 is a real operational risk**,
not just an incomplete feature. The moment `LoginPage.jsx` becomes the OTP flow, Telegram is the
front door for every user. US2 is what makes that survivable — it should be treated as part of the
same release as US1, not a nice-to-have that follows later. US3 (lockout) is smaller in scope but
is a precondition of shipping at all, not optional hardening — a 6-digit code with no attempt limit
is a solved brute-force puzzle, not a login system.

## Notes

- The atomic-claim logic in T013 already necessarily includes the used/expired/active checks (it
  cannot function securely without them) — T020–T024 add the *specific* hardening test coverage
  (lockout, suppression, reset-on-lapse, concurrency) rather than the first working version of the
  checks themselves.
- T025–T027's **ordering** is the substance of Phase 5, not an implementation detail: lock-check,
  then lapse-check, then failure-count, in that exact sequence, each explained in `data-model.md`'s
  state-transition diagram. Reordering any two of them reopens the exact bugs their tests exist to
  catch.
- Constitution update (T031) is deliberately last — per 022's own precedent, it should describe
  what's actually shipped and verified, not what's planned.
