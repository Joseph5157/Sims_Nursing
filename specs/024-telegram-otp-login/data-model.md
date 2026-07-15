# Phase 1 Data Model: Telegram OTP Login

## New table: `otp_login_codes`

Deliberately shaped as a near-twin of the existing `telegram_login_tokens` (022), so the two
ephemeral-credential tables read the same and can be reasoned about the same. The only structural
difference is the one that matters: the secret is stored **hashed**, not plaintext, and therefore
is **not** unique-indexed or looked up by value (`research.md` §1–§2).

```prisma
// ─── Telegram OTP login codes (024-telegram-otp-login) ──────────────────────
// Short-lived, single-use 6-digit codes delivered over Telegram. Mirrors
// TelegramLoginToken's lifecycle (used_at is the only mutation, no deleted_at,
// no purge job) — see specs/024-telegram-otp-login/research.md.
//
// code_hash is bcrypt, NOT a fast hash: a 6-digit code has only 1,000,000
// possible values, so SHA-256 of it is recoverable instantly from a DB dump.
// Only a slow KDF makes a keyspace this small survivable at rest. Do not
// "optimise" this to a fast hash.
model OtpLoginCode {
  id         String    @id @default(uuid())
  user_id    String
  code_hash  String    @db.VarChar(255)
  expires_at DateTime
  used_at    DateTime?
  created_at DateTime  @default(now())

  user User @relation("OtpLoginCodes", fields: [user_id], references: [id])

  @@index([user_id])
  @@map("otp_login_codes")
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | Constitution §4: UUID PKs only. **This is what the atomic claim keys on** (`research.md` §2), since a bcrypt hash cannot be matched in a `WHERE`. |
| `user_id` | FK → `users.id` | Indexed. Every lookup is "the current code for this user". |
| `code_hash` | varchar(255) | bcrypt cost 12, via the existing `hashPassword()`. Sized to match `users.password_hash`. **No unique index** — bcrypt salts, so two identical codes hash differently; a unique index would be meaningless here (and is not needed, since nothing is ever looked up by this value). |
| `expires_at` | timestamp | `created_at + 5 minutes`. |
| `used_at` | timestamp? | `null` = unused. Set exactly once, by the conditional `updateMany`. The single-use marker. |
| `created_at` | timestamp | Also serves as the 60s request-throttle source (`research.md` §5) — no separate `last_otp_request_at` column needed. |

**No `deleted_at`** — matches `telegram_login_tokens` and `telegram_relink_tokens`. Not a new
exception to §4's soft-delete rule; consistency with two already-accepted precedents for this exact
class of table. No purge job, same as those two: at ~20–30 users the row volume is trivial.

**Relation name** `"OtpLoginCodes"` — required because `User` already carries several named
relations; follows the `"LoginTokens"` / `"RelinkTokens"` convention.

### Lifecycle

```
issued ──(correct code, wins the race)──> used_at set ──> dead
   │
   ├──(newer code requested for same user)──> hard-deleted
   ├──(5 min elapse)───────────────────────> expired, inert
   └──(user's account deactivated/deleted)──> unredeemable (checked at verify)
```

Superseding is a **hard delete**, lifted directly from 022's research §2: on issuing a new code,
`deleteMany({ where: { user_id, used_at: null } })` first, then `create`. This keeps the verify-time
query honest — any row it finds is by definition the current one, so it never has to also ask "is
this the newest?". Rejected alternative (same as 022's): keep every row and trust only the latest,
which complicates the hot path and leaves stale codes sitting around looking valid.

## Changed table: `users`

One additive nullable column. **No backfill, no data migration, no default that alters existing
rows' behaviour** — every existing user starts `null`, which correctly means "not locked".

```prisma
model User {
  // ... existing fields unchanged ...
  otp_failed_attempts  Int        @default(0) @db.SmallInt   // EXISTING — dormant since the
                                                             // abandoned OTP system; put back
                                                             // into service by this feature.
  otp_locked_until     DateTime?                             // NEW
  // ... existing relations unchanged ...
  otpLoginCodes        OtpLoginCode[]  @relation("OtpLoginCodes")  // NEW
}
```

| Field | Status | Semantics |
|---|---|---|
| `otp_failed_attempts` | **Existing, reactivated** | Consecutive failed verifies. `>= 5` trips a lock. Reset to `0` on success (FR-014) **and** when a lapsed lock is observed (see below). Left over from the OTP system the project built and abandoned — this feature reuses it rather than adding a counter, per the owner's brief. |
| `otp_locked_until` | **New, nullable** | `null` or past ⇒ unlocked. Future ⇒ locked; reject verifies **and** suppress issuing (FR-016b, `research.md` §6). Set to `now + 15min` at the 5th failure. Cleared on success. |

### Why the lock needs its own column

The owner's brief said to reuse `otp_failed_attempts` and add nothing. That holds for the *count* —
but a bare `SmallInt` records *how many* failures, never *when*, and FR-016's time-based auto-unlock
is unanswerable without a moment to count from. Rationale and rejected alternatives in
`research.md` §3; the departure is recorded in `spec.md`'s Assumptions and `plan.md`'s Complexity
Tracking rather than slipped in quietly.

### The reset-on-lapse rule (easy to get wrong, gets its own test)

When a lock is observed to have lapsed (`otp_locked_until <= now`), **both** fields must be cleared
— `otp_locked_until = null` *and* `otp_failed_attempts = 0`.

Clearing only the timestamp leaves the counter pinned at 5 forever, so the *next single* failure
re-trips the lock, turning a 15-minute cool-off into a permanent lockout that re-arms on any typo.
That violates FR-016 and SC-004a ("no lockout can ever become permanent") — and it would sail
straight through a naive "does it lock at 5?" test, which is exactly why `tasks.md` gives it a
dedicated one.

## State transitions — verify path

```
                    ┌─ locked (otp_locked_until > now) ──────────> reject, no attempt counted
                    │                                              (lock must not be extendable
                    │                                               by guessing — FR-016b)
submit code ────────┤
                    │                          ┌─ no live row ───> reject (expired/none/superseded)
                    └─ unlocked ──> find row ──┤
                                               └─ live row ──> bcrypt.compare
                                                                  │
                            ┌─────────────────────────────────────┤
                            │                                     │
                         mismatch                               match
                            │                                     │
                    attempts += 1                    updateMany{id, used_at: null}
                            │                                     │
                    ┌───────┴───────┐                    ┌────────┴────────┐
                 < 5 │           >= 5 │              count=1 │        count=0 │
                    │               │                       │                │
                 reject     lock 15min, reject      issue session      reject — a concurrent
                                                    attempts = 0        request won the race
                                                    locked_until = null (FR-008 / SC-008)
```

Two ordering rules, both load-bearing:

1. **The lock check precedes everything.** A locked account must not have attempts counted against
   it, or an attacker could hold a victim locked indefinitely by continuing to guess — turning a
   bounded cool-off into unbounded denial of service, which is the exact failure mode the cool-off
   design was chosen to avoid.
2. **Nothing is reported from state read before the claim.** 022 shipped a real TOCTOU bug by
   diagnosing first and claiming second, so a losing racer reported stale pre-claim state. Here the
   `updateMany` is the sole authorization decision; `count === 0` is reported as a loss regardless
   of what the earlier read saw.

## State transitions — request path

```
submit SIMS ID ──> [always: start ~250ms bcrypt, real or throwaway]  ← timing floor (research.md §4)
                    │
                    ├─ user missing / inactive / deleted / no telegram_id ──┐
                    ├─ locked (otp_locked_until > now) ────────────────────┤
                    ├─ last code < 60s old ────────────────────────────────┤──> generic 200,
                    │                                                       │    nothing sent
                    └─ deliverable ──> deleteMany(unused for user)          │
                                       create(code_hash, expires_at)        │
                                       send to Telegram (NOT awaited) ──────┘──> generic 200
```

Every branch returns the **same** body, status, and page behaviour. That is FR-003, and it is why
the bcrypt runs unconditionally and the Telegram send is never awaited — the two real costs are
made uniform rather than merely hidden. `research.md` §4 records the honest residual (one indexed
user lookup still happens on one branch only) rather than claiming perfect constant time.

## Constitution impact

| Section | Change |
|---|---|
| §2 Infrastructure — Auth row | Third login method added to the description. |
| §4 Authentication | New subsection; the "No Telegram OTP (the code-entry kind)" sentence must be amended — **not** deleted. It should record that the ban was lifted deliberately, when, and why. |
| §5 Database | **18 → 19 tables**; new `otp_login_codes` row. The "Removed" note mentioning `otp_sessions` needs a pointer noting OTP came back in a different shape. `users` gains `otp_locked_until`; the previously-dormant `otp_failed_attempts` is now live. |
| §6 API | Authentication module **4 → 6** endpoints; total **115 → 117**. |
| Version history | **v3.18 → v3.19**, recording this as a deliberate, owner-approved reopening — per FR-022 and the precedent 022 set. |

These edits belong to the **implementation** phase, not now: the constitution must not describe a
feature that has not shipped.
