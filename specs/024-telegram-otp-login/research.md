# Phase 0 Research: Telegram OTP Login

## 1. Storing the code — why bcrypt, and why the 022 pattern does not transfer

**Decision**: Store the code as a bcrypt hash (cost 12), reusing the existing
`hashPassword()` from `server/lib/password.js`. Verify with `bcrypt.compare`.

**Rationale**: FR-010 forbids storing the code in a form that leaks it to anyone with database
read access. The instinct is to copy 022 and store the value directly — 022's magic-link token is
plaintext in `telegram_login_tokens.token`, and that is *fine there*, because it is 32 bytes of
`crypto.randomBytes`. Nobody guesses that, and nobody rainbow-tables it.

**A 6-digit code is a completely different object.** It has 1,000,000 possible values. That is
small enough to precompute *every* SHA-256 in well under a second on a laptop, so a fast hash is
worth almost nothing here — an attacker with a database dump would recover every live code
instantly. Only a deliberately slow KDF actually protects a search space this small.

bcrypt at cost 12 (~250ms/hash, the same cost this codebase already uses for passwords) makes an
offline sweep of the keyspace take ~3 days of CPU per code — against a code that dies after 5
minutes. The slowness is a feature twice over: it also throttles online guessing, on top of the
FR-013 attempt counter.

**Alternatives considered**:
- **Plaintext, mirroring 022** — rejected outright. The 022 precedent is about a 256-bit random
  secret; the reasoning does not survive being applied to a 20-bit one.
- **SHA-256 / HMAC-SHA256** — rejected: instantly brute-forceable at this keyspace, which is the
  one thing FR-010 exists to prevent. HMAC with a server-side pepper would be *better* than bare
  SHA-256 (an attacker needs the app secret too, not just the DB), but it introduces a new secret
  to manage and rotate, and buys nothing over bcrypt, which this codebase already runs.

**Consequence — this breaks 022's claim pattern.** 022 claims atomically with
`updateMany({ where: { token, used_at: null, ... } })` because it can match on the token value
directly in SQL. A bcrypt hash cannot be matched in a `WHERE` clause — comparison requires the
plaintext and the stored hash in application code. See §2.

## 2. Atomic single-use consumption with a hashed code

**Decision**: Two steps, with the atomic guarantee moved onto the row's identity rather than its
value:

1. Fetch the user's current unused, unexpired code row (`findFirst` by `user_id`, `used_at: null`,
   `expires_at > now`).
2. `bcrypt.compare` the submitted code against `code_hash`. On mismatch → increment failures, stop.
3. On match, consume by row id:
   ```
   prisma.otpLoginCode.updateMany({
     where: { id: row.id, used_at: null },
     data:  { used_at: new Date() },
   })
   ```
   Proceed to issue a session **only if `count === 1`**. If `count === 0`, a concurrent request
   already consumed it — this request loses and must not produce a session.

**Rationale**: This preserves exactly the property 022's concurrency test protects (SC-008, FR-008:
two simultaneous redemptions yield exactly one session), just keyed on `id` + `used_at: null`
instead of `token` + `used_at: null`. Postgres still executes the `UPDATE ... WHERE used_at IS
NULL` as one atomic statement, so of two racers exactly one matches a row. The read in step 1 is
*not* the authorization decision — it only supplies the candidate hash. The `updateMany` in step 3
is the sole decision, same as 022.

022 shipped a real TOCTOU bug in this exact area (its handoff records the fix: claim first, then
diagnose — never diagnose first). The ordering above is deliberately arranged so the same class of
bug cannot recur: nothing is reported to the user based on state read *before* the claim attempt.

**Alternatives considered**:
- `$transaction` with `SELECT ... FOR UPDATE` — rejected for the same reason 022 rejected it:
  needs raw SQL, which Constitution §2/§10 disallows outside reporting, and adds no safety over the
  conditional `updateMany`.
- Storing a fast-hash lookup column alongside the bcrypt hash so the `WHERE` can match directly —
  rejected: that fast-hash column would itself be trivially reversible at a 1M keyspace, handing
  back exactly the leak §1 exists to close.

## 3. Where the cool-off timestamp lives

**Decision**: Add one nullable column to `User`: `otp_locked_until DateTime?`. `null` (or a past
time) means not locked. The existing `otp_failed_attempts` carries the count, as instructed.

**Rationale**: The spec's Assumptions already flag this as an unavoidable departure from "reuse the
existing column, add nothing" — `otp_failed_attempts` is a bare `SmallInt`. It answers *how many*,
never *when*, and FR-016's time-based unlock is unanswerable without a moment to count from.

`otp_locked_until` was chosen over the alternatives because the lock semantics end up stated
directly in the data instead of derived at every read site. Checking a lock is
`user.otp_locked_until > now` — one comparison, no arithmetic, no policy constant needed at the
call site. That matters because the check has to happen in both the request and verify paths
(FR-016b: requesting a fresh code must not lift the lock), and any logic duplicated across two call
sites is somewhere the two can silently drift apart.

**Alternatives considered**:
- **`otp_last_failed_at DateTime?`, deriving locked-ness as `attempts >= 5 && last_failed_at >
  now - 15min`** — rejected: spreads the policy (both the `5` and the `15min`) into every reader,
  which is precisely the drift this codebase already got burned by once — Constitution v3.14 exists
  because the session-ordering rule had been reimplemented in two places and they diverged.
- **A separate `otp_lockouts` table** — rejected: a second table to hold one nullable timestamp
  per user, joined on every login attempt, for zero benefit.
- **Reuse `last_password_reset_at`** — rejected: unrelated field, actively misleading, and would
  entangle the OTP lock with the `/resetpassword` throttle.

**Constitution note**: this is an *additive nullable* column on an existing table — no data
migration, no backfill, no default that changes existing rows' behaviour (every existing user
starts `null` = unlocked, which is correct).

## 4. Not leaking which SIMS IDs exist

**Decision**: `POST /auth/otp/request` always returns the same `200` and the same body, whatever
the outcome. Concretely:

- Look the user up.
- **Always** perform one bcrypt hash — of the real code when there is a deliverable user, of a
  discarded throwaway value when there is not. This keeps the dominant cost (~250ms) on both paths.
- **Fire the Telegram send without awaiting it.** Delivery latency (~0.5–1s, and highly variable)
  must never be inside the measured response, or it reintroduces the very signal the dummy hash
  removes.
- Return the generic response.

**Rationale**: FR-003 demands the response be indistinguishable in wording, behaviour, *and
observable timing*. Wording and behaviour are trivial; timing is where this kind of endpoint
usually leaks. The two real costs are the bcrypt hash and the Telegram round-trip — so the design
makes the first unconditional and takes the second off the response path entirely.

Not awaiting the send is not a compromise here — it is independently correct. The spec's
Assumptions already establish delivery is best-effort and unacknowledged (the system cannot know a
message was *read*), and FR-018 already requires a visible escape hatch for exactly the case where
a code never arrives. Awaiting the send would buy an error we have decided not to surface anyway.

**Honest limit, recorded rather than papered over**: this is *near*-constant time, not
constant-time. A user row is still fetched on one path only, so a sufficiently precise attacker
measuring thousands of requests could in principle still separate the distributions by the cost of
one indexed lookup. Closing that fully (dummy queries, response padding to a fixed deadline) is
disproportionate for a ~20–30-user single-college system where SIMS IDs are semi-public anyway,
printed on materials and sequential by construction. The IP rate limit is the real control on
enumeration at this scale; the timing work above removes the cheap signal, and the residual is
documented, not pretended away.

**Alternatives considered**:
- **Return `404` for unknown SIMS IDs** — rejected: that *is* the enumeration oracle, stated
  outright.
- **Await the Telegram send and surface delivery failures** — rejected: turns delivery latency into
  a timing oracle, and contradicts FR-018's premise that the user always has a fallback rather than
  a guarantee.
- **Pad every response to a fixed 1s deadline** — rejected as disproportionate; it makes the happy
  path worse for every user to close a residual channel that the IP limit already caps.

## 5. Throttling code requests without a new column

**Decision**: Reuse the OTP row's own `created_at`. Before issuing, read the user's most recent
code row; if it was created under 60 seconds ago, skip issuing (and still return the generic
response from §4 — a throttled request must be indistinguishable from a fresh one). Stack an
`express-rate-limit` IP limiter on the route as well.

**Rationale**: Directly lifts 022's research §3 conclusion, which reached the same place for the
same reason: the token table already records the timestamp the throttle needs, so a
`last_otp_request_at` column on `User` would be pure duplication and a second thing to keep in
sync. 60s sits deliberately between the two existing throttles in this system — magic-link `/login`
at 1-per-30s and bot `/resetpassword` at 1-per-hour — matching the spec's Assumptions.

**Alternatives considered**: a `last_otp_request_at` column on `User` — rejected as duplication,
exactly as 022 rejected `last_telegram_login_request_at`.

## 6. Suppressing delivery during cool-off (spec's deferred question)

**Decision**: While `otp_locked_until` is in the future, do **not** generate or send a code. Return
the same generic response as always (§4).

**Rationale**: The spec explicitly left this to `plan.md` ("either is compatible with the spec,
which only requires that the lock hold"). Suppressing wins on all three counts:

1. **It is kinder.** Sending a code that FR-016b guarantees will be rejected hands the user a
   working-looking credential that cannot work. That is a worse experience than silence.
2. **It removes an amplification vector.** Otherwise an attacker who has locked an account can
   keep firing requests and keep the victim's Telegram buzzing — the account is already unusable,
   so the only remaining effect is harassment.
3. **It cannot weaken the lock**, because no code exists to redeem.

**Alternatives considered**: send anyway and let verification reject it — rejected on all three
points above, and it burns Telegram API quota to produce a guaranteed failure.

## 7. Splitting the login page without breaking the fallback

**Decision**: `client/src/pages/auth/LoginPage.jsx` becomes the two-step OTP flow at `/login`. The
existing SIMS-ID+password form moves, essentially unchanged, into a new
`client/src/pages/auth/PasswordLoginPage.jsx` mounted at `/login/password`. `/login` carries a
visible link to it.

**Rationale**: `POST /auth/login` and its whole server-side chain are untouched — the fallback is
the *same code path* it is today, just reached from a different page component. FR-020/FR-021 (zero
regression, no user re-enrolment) are satisfied structurally rather than by testing hard, which is
the strongest form of satisfying them.

Moving the form rather than hiding it behind a toggle on one page matters for the scenario the
fallback exists for: `/login/password` is a plain, stable, bookmarkable URL that works even if the
OTP step is broken, mis-deployed, or throwing. A toggle inside `LoginPage.jsx` would make the
emergency path a child of the thing it is supposed to be independent of.

**Alternatives considered**:
- **A toggle/tab on a single page** — rejected per above: couples the break-glass path to the
  health of the primary path.
- **A query param (`/login?method=password`)** — rejected: same coupling, plus it is easier to
  wipe out accidentally and reads as a mode of the OTP page rather than a separate door.

**Deployment note carried over from this session's findings**: this feature touches `client/`.
Railway's Watch Paths for this service are scoped to `/server/**`, so a client-only commit is
silently skipped (`deploy/known-issues-and-fixes.md` §9). This feature also touches `server/`, so
it will deploy — but any follow-up client-only fix will not, unless Watch Paths is widened first.

## 8. Session handoff, forced password change, and audit

**Decision**: `POST /auth/otp/verify` mirrors `login()` exactly on success — same
`authCookieOptions()` / `csrfCookieOptions()`, same JWT payload (`sub`, `role`, `session_version`),
same `{ ...safeUser(user), must_change_password }` response body. Audit action: `OTP_LOGIN`,
alongside the existing `PASSWORD_LOGIN` / `TELEGRAM_LOGIN`, and best-effort in a try/catch like
both of them.

**Rationale**: FR-007 and FR-011 are satisfied by construction if the response is byte-identical in
shape to `login()`'s — the client's existing `must_change_password` routing in `App.jsx:106` and
`ProtectedRoute.jsx:25` then applies with no client-side special-casing. Wrapping the audit write
in a swallow-and-warn `try/catch` follows the rule Constitution v3.16 established after a real
incident: cookies are already set by that point, so an audit hiccup must never turn a *successful*
login into an error the user sees.

`OTP_LOGIN` is distinct per FR-012 — the three login mechanisms need to be tellable apart in
`admin_audit_log` for exactly the kind of incident review this feature makes more likely.

**Alternatives considered**: reusing `PASSWORD_LOGIN` — rejected, contradicts FR-012 and destroys
the audit trail's ability to answer "how did this session start".

## 9. Attempt counting and reset semantics

**Decision**:
- Wrong code → `otp_failed_attempts: { increment: 1 }`. On reaching **5**, set
  `otp_locked_until = now + 15min`.
- Successful verify → reset `otp_failed_attempts: 0`, `otp_locked_until: null` (FR-014).
- Lock naturally elapsed (`otp_locked_until <= now`) on the next request/verify → treat as unlocked
  and reset the counter to 0, so the next 5 failures start a fresh window rather than instantly
  re-locking on failure number one.

**Rationale**: The last clause is the subtle one and the easiest to get wrong. If the counter is
not cleared when the lock lapses, `otp_failed_attempts` stays at 5 forever and *every subsequent
single* failure re-trips the lock — turning a 15-minute cool-off into a permanent lockout that
re-arms on any typo. That directly violates FR-016 and SC-004a ("no lockout can ever become
permanent"), and it is exactly the kind of defect that passes a naive "does it lock at 5?" test.
Reset-on-lapse gets its own test (`tasks.md`) rather than riding along with the happy path.

**Alternatives considered**: decaying the counter gradually — rejected: more state, more edge
cases, no benefit at 5 attempts / 15 minutes.
