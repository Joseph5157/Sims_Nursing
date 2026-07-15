# Handoff Report

## task_id
024-telegram-otp-login / `/speckit-specify` + `/speckit-plan` + `/speckit-tasks` — design only (2026-07-15)

## status
complete — **for the specify, plan, and tasks phases only**. No code has been written. Next step is
`/speckit-implement`.

## completed
- **Confirmed owner intent before any work**: the owner explicitly asked to replace password login
  with a typed Telegram OTP. Surfaced that this reverses `CONSTITUTION.md` §4 ("No Telegram OTP
  (the code-entry kind)") — a decision the project made after building and abandoning an
  `otp_sessions` table — and got explicit approval to reopen it, mirroring how 022 handled its own
  reopening of the same broader question.
- **Talked the owner out of a full password removal.** The original ask was "replace password login
  with OTP" outright. Flagged that password login is currently the only fallback that makes
  Telegram-dependency survivable: a revoked bot token, a Telegram outage, a college-network block,
  or a lost Telegram account would lock out *every* user including the Super Admin, with no way
  back in. Owner chose instead to keep password login intact but hidden behind a separate URL as a
  break-glass path. Scope went from destructive to additive as a result.
- **Feature branch** `024-telegram-otp-login` created via the mandatory `before_specify` git hook
  (`speckit.git.feature`, sequential numbering → 024).
- **`spec.md` written** — 3 prioritised user stories (P1 cross-device OTP login, P1 break-glass
  fallback, P2 brute-force protection), 24 functional requirements, 9 success criteria, 11 edge
  cases, plus a "Context: Why This Reopens a Settled Decision" section recording the reversal and
  its justification (the magic link logs you in on the device you tap it on; a typed code can cross
  from phone to desktop, which is the one thing no existing login method does).
- **One clarification asked and resolved** (`FR-016`, lockout recovery). Owner chose **time-based
  cool-off only** — no admin unlock, no password-login shortcut. Encoded as FR-016/016a/016b with
  matching acceptance scenarios, a success criterion, and two edge cases.
- **`checklists/requirements.md` written**, validated across two iterations. All items now pass.
- **`.specify/feature.json`** repointed from `022-telegram-magic-link-login` to
  `024-telegram-otp-login` so downstream speckit commands resolve the right folder.

### Plan phase (`/speckit-plan`)

- **`plan.md`** — Constitution Check run against root `CONSTITUTION.md` v3.18: 8 of 9 gates PASS,
  1 approved deviation (the feature itself). Complexity Tracking justifies both the deviation and
  the one new column.
- **`research.md`** — 9 decisions, each with rationale and rejected alternatives. The three that
  actually shape the build:
  1. **The code must be bcrypt-hashed, and 022's pattern does not transfer.** 022 stores its
     magic-link token in plaintext, which is fine for 32 bytes of `randomBytes`. A 6-digit code has
     1,000,000 possible values — every SHA-256 of that space is precomputable in under a second, so
     a fast hash at rest is worth roughly nothing. bcrypt cost 12 is what makes a 20-bit secret
     survivable, and its slowness is load-bearing rather than incidental.
  2. **Which forces a different atomic-claim shape.** A bcrypt hash can't be matched in a `WHERE`,
     so 022's `updateMany({ where: { token, used_at: null } })` can't be copied. Re-keyed onto the
     row's `id`: read the row → `bcrypt.compare` → `updateMany({ where: { id, used_at: null } })`.
     Same one-winner guarantee, same reason (Postgres executes the `UPDATE` atomically), no raw SQL.
  3. **No user enumeration means attacking the timing, not just the wording.** The bcrypt runs
     unconditionally (real code or throwaway) and the Telegram send is never awaited, so the two
     dominant costs are uniform across all branches. The honest residual — one indexed user lookup
     still happens on one branch only — is recorded rather than papered over.
- **`data-model.md`** — `otp_login_codes` (near-twin of `telegram_login_tokens`, no `deleted_at`,
  matching that accepted precedent) + `users.otp_locked_until`. Full state-transition diagrams for
  both the request and verify paths.
- **`contracts/otp-login-endpoints.md`** — `POST /auth/otp/request`, `POST /auth/otp/verify`.
  Auth module 4 → 6 endpoints; total 115 → 117.
- **`quickstart.md`** — Path A (real bot) and Path B (no bot needed, drive the endpoints directly),
  mirroring how 022 was validated. Includes the concurrency check, the reset-on-lapse check, and a
  full regression list.
- **Agent context updated** — `CLAUDE.md`'s `<!-- SPECKIT -->` block repointed from the 022 plan to
  this one.

### Tasks phase (`/speckit-tasks`)

- **`tasks.md`** — 32 tasks (T001–T032), verified sequential with no gaps or duplicates. Split
  US1: 8, US2: 4, US3: 9, plus 4 Setup, 3 Foundational, 4 Polish. Every one of `spec.md`'s 24
  functional requirements traces to at least one task (some via an explicit `FR-xxx` tag, others
  structurally — e.g. FR-001's "SIMS ID only" is T015's whole premise rather than a line inside it,
  matching how 022's own `tasks.md` tagged selectively rather than exhaustively).
- **Deliberately flagged the MVP boundary as misleading for this feature** — added a note directly
  in `tasks.md`'s Implementation Strategy: shipping US1 (the OTP flow) without US2 (the password
  fallback) live in production is a real operational risk, not an incomplete-but-safe increment,
  because the moment `LoginPage.jsx` becomes the OTP flow, Telegram is the only front door. US3
  (lockout) is flagged the same way — a precondition of shipping, not optional hardening, since an
  unbounded 6-digit code is a solved brute-force puzzle.
- **T007 operationalizes the CSRF decision** the contract only recommended: exempt both new
  endpoints the same way `/auth/login` is exempted, with the reasoning inlined in the task itself
  so it survives being read in isolation from `research.md`.
- **Five tests exist specifically to catch named landmines, not as generic coverage**: T010
  (leading zeros), T020+T022 (lockout trip + the reset-on-lapse trap, as two separate tasks so the
  trap gets its own explicit assertion on both fields rather than riding along), T024 (the exact
  class of concurrency bug 022 actually shipped).

## failed_or_blocked
- **The mandatory `after_specify` hook `speckit.handoff.update` could not be invoked as a slash
  command.** `.specify/extensions.yml` registers it with `optional: false`, and the extension
  exists on disk at `.specify/extensions/handoff/` — but no corresponding skill is installed at
  `.claude/skills/speckit-handoff-update/` (every other registered extension command has one).
  Rather than invent a skill name, the hook's own command definition was read
  (`.specify/extensions/handoff/commands/speckit.handoff.update.md`) and its documented behaviour
  performed directly: its PowerShell scaffolding script was run to seed this file from
  `specs/_templates/handoff.md`, and the sections were then filled in. Net effect matches what the
  hook specifies. **Worth installing that skill** so the hook stops being a manual step.

## commands_run
```
.specify\extensions\git\scripts\powershell\create-new-feature.ps1 -Json -ShortName "telegram-otp-login" "..."
  # -> {"BRANCH_NAME":"024-telegram-otp-login","FEATURE_NUM":"024","HAS_GIT":true}
git branch --show-current                      # confirms 024-telegram-otp-login, clean tree
mkdir -p specs/024-telegram-otp-login/checklists
cp .specify/templates/spec-template.md specs/024-telegram-otp-login/spec.md
.specify\extensions\handoff\scripts\powershell\update-handoff.ps1 024-telegram-otp-login
grep -c "NEEDS CLARIFICATION" specs/024-telegram-otp-login/spec.md   # -> 0
```
No tests run and no build run — this phase produced no code.

## constraints_discovered
- **`.specify/memory/constitution.md` is badly stale and actively misleading.** It still describes
  the *original* pre-abandonment design: "Auth is Telegram OTP Only. No passwords", 4 roles
  including a "Coordinator" role that does not exist, 14 tables including `otp_sessions`, and 55
  endpoints across 11 modules. The real `CONSTITUTION.md` says 3 roles, 18 tables, 115 endpoints,
  and password + magic-link auth. Its own header defers to `CONSTITUTION.md` as the single source
  of truth, so it was treated as historical record only — but any future speckit command that
  loads it as "project principles" (as `/speckit-specify` is instructed to) will be reading fiction.
  **Recommend either re-syncing or deleting it.**
- That stale file did turn out to be genuinely useful for one thing: it preserves the original OTP
  design parameters — *"OTP expires in 5 minutes, max 5 attempts before lockout"* — which explain
  why a dormant `otp_failed_attempts Int @default(0) @db.SmallInt` column still sits on the `User`
  model (`prisma/schema.prisma:79`), unused since the OTP system was ripped out. Both parameters
  were adopted as the spec's informed defaults rather than invented fresh.
- **A time-based cool-off cannot be built from `otp_failed_attempts` alone.** The owner's brief
  said to reuse that existing column rather than add anything. It holds the *count* of failures but
  not *when* they happened, so it cannot answer "has the cool-off elapsed?". One additional piece of
  per-user timestamp state is unavoidable. Flagged explicitly in the spec's Assumptions rather than
  quietly absorbed, since it departs from a stated instruction; `plan.md` picks the mechanism.
- **The Super Admin's SIMS ID is `1000`** — the first ID in the `1000`–`1099` admin range, and
  therefore trivially guessable. This is what killed the admin-unlock-only lockout option: anyone
  could permanently lock out the Super Admin, and only that same locked-out Super Admin could undo
  it. Directly shaped the FR-016 decision.
- The existing throttles that the new per-account OTP-request throttle has to sit sensibly between:
  magic-link `/login` is 1 per 30 seconds; bot `/resetpassword` is 1 per hour.

### Found during the plan phase

- **CSRF is a live trap on these two endpoints, and the naive reading of it is wrong in both
  directions.** `POST /auth/login` is CSRF-exempt (`server/middleware/csrf.js:11`) because
  Constitution v3.16 records a real incident: a stale `sims_token` cookie 403-blocked every login
  attempt, unrecoverably, since `sims_token` is httpOnly and JS cannot clear it. The new endpoints
  are `POST` and therefore *not* exempt by default. **But** the risk is narrower than "stale cookie
  breaks login": both cookies share a `maxAge` and the client's axios interceptor
  (`client/src/utils/api.js:15-23`) echoes `sims_csrf` into `X-CSRF-Token`, so the ordinary stale
  case actually **passes**. The trap needs an asymmetry — `sims_token` present while `sims_csrf` is
  gone — which is reachable precisely because `sims_csrf` is deliberately `httpOnly: false` and can
  be cleared by an extension or a partial site-data wipe while the httpOnly token survives.
  Conditional, invisible in local testing (`csrf.js:15` skips enforcement entirely on a clean
  browser), and permanently locking for whoever hits it. The contract recommends exempting both
  endpoints — on the principled ground that CSRF protection on an *unauthenticated credential
  endpoint* defends nothing (there is no ambient authority to forge; the worst a forged request
  achieves is mailing the victim a code they didn't ask for), with the empirical history as
  corroboration rather than the main argument. I initially overstated this as a guaranteed break and
  corrected it after reading `cookieOptions.js` and the axios interceptor.
- **Leading zeros are a 10%-of-the-keyspace footgun.** `"048291"` is a perfectly valid code and
  `Number("048291")` is `48291`. Codes must stay strings end-to-end — Zod, JSON body, client input.
  One code in ten breaks silently otherwise, which is frequent enough to be reported and rare enough
  to be dismissed as user error. Called out in the contract and given its own quickstart step.
- **`otp_failed_attempts` must be cleared when a lock lapses, not just the timestamp.** If only
  `otp_locked_until` is nulled, the counter stays pinned at 5 and the *next single* failure re-locks
  — a 15-minute cool-off silently becomes a permanent lockout that re-arms on any typo, violating
  FR-016 and SC-004a. It would pass a naive "does it lock at 5?" test. Given a dedicated
  quickstart step and a dedicated Vitest case in the task plan rather than riding along with the
  happy path.
- **The lock check must precede attempt counting.** Counting failures against an already-locked
  account lets an attacker hold a victim locked indefinitely by continuing to guess — converting a
  bounded cool-off into unbounded denial of service, which is the exact failure the cool-off design
  was chosen to avoid.

## deviations_from_constitution
- **This feature is, by design, a deviation** — `CONSTITUTION.md` §4 currently forbids exactly what
  it specifies ("No Telegram OTP (the code-entry kind)"). It is owner-approved and explicitly
  scoped as additive (nothing removed; password login and the 022 magic link both survive).
  **FR-022 requires `CONSTITUTION.md` be updated with a version-history entry recording the
  reversal as deliberate and owner-approved**, following the precedent 022 set. That update has
  **not** been made yet — it belongs to the implementation phase, and the constitution must not be
  edited to match a feature that has not shipped. Until then this deviation is live and documented
  here.
- No other deviations. The spec commits to the locked stack and existing conventions throughout
  (Zod validation, Prisma-only, express-rate-limit, existing cookie/session mechanics, Vitest).

## files_touched
- `specs/024-telegram-otp-login/spec.md` — NEW (the specification)
- `specs/024-telegram-otp-login/checklists/requirements.md` — NEW (quality checklist, 2 validation
  iterations, all passing)
- `specs/024-telegram-otp-login/plan.md` — NEW (Constitution Check, structure, complexity tracking)
- `specs/024-telegram-otp-login/research.md` — NEW (9 Phase-0 decisions)
- `specs/024-telegram-otp-login/data-model.md` — NEW (schema + state transitions)
- `specs/024-telegram-otp-login/contracts/otp-login-endpoints.md` — NEW (2 endpoints)
- `specs/024-telegram-otp-login/quickstart.md` — NEW (validation guide, Paths A & B)
- `specs/024-telegram-otp-login/tasks.md` — NEW (32 tasks across Setup/Foundational/US1/US2/US3/Polish)
- `specs/024-telegram-otp-login/handoff.md` — NEW (this file)
- `.specify/feature.json` — repointed 022 → 024
- `CLAUDE.md` — `<!-- SPECKIT -->` block repointed 022 plan → 024 plan
- Branch `024-telegram-otp-login` — NEW (created off `main` at `e8a479d`)

**No source files touched. No schema, no migration, no tests, no client code.** Everything above is
documentation. `prisma/schema.prisma`, `server/`, and `client/` are all untouched on this branch.

## open_questions_for_owner
- **Nothing blocking `/speckit-plan`.** The one open decision (lockout recovery) was resolved.
- **`.specify/memory/constitution.md` should be re-synced or deleted** — see
  `constraints_discovered`. It is not just outdated, it asserts the opposite of the current auth
  model and invents a role that does not exist. `/speckit-specify` is instructed to load it as
  authoritative project principles, so it will actively mislead future runs. Out of scope for this
  feature; worth its own small cleanup.
- **The `speckit.handoff.update` skill is missing** from `.claude/skills/` while being registered
  as a mandatory hook — see `failed_or_blocked`. Also out of scope here, also worth a one-line fix.
- **Both decisions the spec deferred to `plan.md` are now resolved**, so nothing is left dangling:
  (1) the cool-off timestamp is a new nullable `users.otp_locked_until` column — rationale and
  rejected alternatives in `research.md` §3, justified in `plan.md`'s Complexity Tracking since it
  departs from the "add nothing" brief; (2) a code is **not** generated or sent at all while an
  account is in cool-off (`research.md` §6) — it is kinder than handing someone a credential
  guaranteed to be rejected, it removes an amplification vector where an attacker who has locked an
  account keeps the victim's Telegram buzzing, and it cannot weaken the lock since no code exists to
  redeem.
- **One decision left open for implementation, deliberately**: whether to take the CSRF exemption
  recommended in the contract. It is recommended and reasoned, not silently assumed, because it is a
  security posture change and should be a conscious call rather than something absorbed into a task.
  Declining it is viable but costs work for no defensive gain — see `constraints_discovered`.
