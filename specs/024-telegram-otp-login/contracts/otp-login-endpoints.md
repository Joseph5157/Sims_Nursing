# Contract: OTP Login Endpoints

Two new **public** endpoints on the existing `/auth` router. Both are unauthenticated by
definition — they are how a session gets created.

Both are `POST` and therefore **inside** CSRF enforcement (`server/middleware/csrf.js` checks
`POST/PUT/PATCH/DELETE`). See "CSRF" at the bottom — this is a real trap that 022 sidestepped by
being a `GET`, and it must not be discovered during implementation.

---

## `POST /auth/otp/request`

Issue a code to the caller's linked Telegram. **Deliberately says nothing about whether the account
exists.**

### Request

```json
{ "sims_id": "1100" }
```

Zod (`otpRequestSchema`): `sims_id` — string, exactly 4 digits (`/^\d{4}$/`). Rejecting anything
else keeps the handler from ever touching a lookup it cannot serve.

> **Note the type.** `sims_id` is a *string* on the wire and an `Int` in the database. `login()`
> already handles this exact conversion (`/^\d{4}$/.test(identifier)` then `Number(identifier)`);
> mirror it rather than inventing a second convention.

### Response — always the same

**`200 OK`**, on every path — user found, not found, deactivated, soft-deleted, no linked Telegram,
throttled, or in cool-off:

```json
{
  "message": "If that SIMS ID has a linked Telegram account, a code has been sent to it."
}
```

**This is the whole point of the endpoint's design.** Any variation — a different message, a
different status, a materially different latency — is an oracle for enumerating which of the ~30
sequential SIMS IDs are real. See `research.md` §4 for the timing measures and their honest
residual.

The only non-200s are infrastructure-level, never account-level:

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Body isn't 4 digits. Says nothing about any account. |
| `403` | `CSRF_INVALID` | Missing/invalid CSRF token — see CSRF below. |
| `429` | `RATE_LIMITED` | IP limiter tripped. Per-**IP**, not per-account: reveals nothing about a specific account. |
| `503` | `SERVICE_UNAVAILABLE` | Unexpected server error, matching `login()`'s catch-all. |

### Behaviour

1. **Always** begin a bcrypt hash (~250ms) — of the real code when deliverable, of a throwaway
   otherwise. Keeps the dominant cost on both branches.
2. Suppress issuing entirely (still `200`) when: no such user · `deleted_at` set · `status !== 'active'` ·
   no `telegram_id` / not `telegram_verified` · `otp_locked_until > now` (FR-016b, `research.md` §6) ·
   a code for this user was created < 60s ago (`research.md` §5).
3. Otherwise: `deleteMany({ where: { user_id, used_at: null } })` → `create({ code_hash, expires_at:
   now + 5min })` → send to Telegram **without awaiting** (`research.md` §4).
4. Never log the plaintext code. Never include it in the response. It exists only in memory and in
   the Telegram message.

### Rate limiting

`express-rate-limit`, mirroring the existing `authLimiter` shape: 50/15min in production,
1000/15min in development. Plus the per-account 60s throttle in step 2 — which reuses the code
row's own `created_at` rather than adding a column.

---

## `POST /auth/otp/verify`

Redeem a code. On success, issues **exactly** the session `POST /auth/login` issues.

### Request

```json
{ "sims_id": "1100", "code": "482913" }
```

Zod (`otpVerifySchema`): `sims_id` — 4 digits; `code` — string, exactly 6 digits (`/^\d{6}$/`).

> `code` is a **string**, not a number. `"048291"` is a valid code and `Number("048291")` is
> `48291` — a different, wrong value. Leading zeros are ~10% of the keyspace; typing them as
> numbers silently breaks one code in ten. Keep it a string end-to-end, client included.

### Response — success `200 OK`

Byte-identical in shape to `POST /auth/login`:

```json
{
  "id": "uuid", "name": "...", "sims_id": 1100, "email": null,
  "role": "faculty", "...": "...",
  "must_change_password": false
}
```

`{ ...safeUser(user), must_change_password }`, plus the same two cookies via the same helpers:

| Cookie | Options |
|---|---|
| `sims_token` | `authCookieOptions()` — httpOnly JWT `{ sub, role, session_version }` |
| `sims_csrf` | `csrfCookieOptions()` — readable CSRF token |

Identical shape is what makes FR-007/FR-011 true *by construction*: the client's existing
`must_change_password` routing (`App.jsx:106`, `ProtectedRoute.jsx:25`) applies with **zero**
client-side special-casing for OTP.

### Response — failure

All failures are `401` with **one** generic message. Codes differ only enough for the client to
decide whether to offer "resend" vs "wait":

```json
{ "error": true, "code": "INVALID_OTP", "message": "That code is not valid. Request a new one." }
```

| Status | Code | When | Note |
|---|---|---|---|
| `401` | `INVALID_OTP` | Wrong code · no live code · expired · superseded · already used · **lost the concurrent race** · account inactive/deleted | One code for all of these, on purpose — see below |
| `401` | `OTP_LOCKED` | `otp_locked_until > now` | Distinct **only** so the UI can say "wait ~N minutes" instead of "try again", per US3 scenario 6. Includes a `retry_after_seconds` hint. |
| `400` | `VALIDATION_ERROR` | Malformed body | |
| `403` | `CSRF_INVALID` | See CSRF below | |
| `429` | `RATE_LIMITED` | IP limiter | |
| `503` | `SERVICE_UNAVAILABLE` | Unexpected error | |

**Why one code covers "wrong" and "expired" and "already used":** distinguishing them tells an
attacker whether they hit a *live* code — turning failures into a progress signal. `login()`
already sets this precedent ("Invalid SIMS ID/email or password" for both unknown-user and
wrong-password). `OTP_LOCKED` is the sole exception, and it is safe: by the time it fires the
attacker already knows they are locked out, so it leaks nothing they don't have.

### Behaviour — order is load-bearing

1. **Lock check first.** If `otp_locked_until > now` → `401 OTP_LOCKED`, **without incrementing**
   `otp_failed_attempts`. Counting attempts here would let an attacker keep a victim locked
   indefinitely by continuing to guess — converting a bounded 15-minute cool-off into unbounded
   DoS, the exact failure the cool-off design exists to prevent.
2. **Lapsed lock** (`otp_locked_until <= now`, non-null) → clear **both** `otp_locked_until = null`
   *and* `otp_failed_attempts = 0`, then continue. Clearing only the timestamp pins the counter at 5
   and makes the *next single* failure re-lock forever — see `data-model.md`.
3. `findFirst` the live row: `user_id`, `used_at: null`, `expires_at > now`. None → `401 INVALID_OTP`.
4. `bcrypt.compare(code, row.code_hash)`. Mismatch → `increment` attempts; if now `>= 5`, set
   `otp_locked_until = now + 15min`; → `401 INVALID_OTP`.
5. Match → **atomic claim**:
   ```js
   const claim = await prisma.otpLoginCode.updateMany({
     where: { id: row.id, used_at: null },
     data:  { used_at: new Date() },
   });
   if (claim.count !== 1) return 401 INVALID_OTP;   // a concurrent request won
   ```
   This is the **sole** authorization decision. Step 3's read only supplied a candidate hash.
   022 shipped a real TOCTOU bug by diagnosing before claiming; nothing here reports on pre-claim
   state.
6. Re-check the user is still `active` / not `deleted_at` — the account can be deactivated in the
   seconds between issue and redemption (spec edge case). Fail → `401 INVALID_OTP`.
7. Success → reset `otp_failed_attempts = 0`, `otp_locked_until = null`; sign JWT; set both cookies;
   `logAction({ action: 'OTP_LOGIN' })` **best-effort in try/catch** (cookies are already set —
   never fail a succeeded login on an audit hiccup, per the v3.16 rule); return the body above.

### Rate limiting

Same `express-rate-limit` shape as `/otp/request`, **plus** the per-account counter from steps 1–4.
Both are required (FR-013 + FR-015): the account counter stops one account being hammered; the IP
limiter stops one attacker cheaply sweeping many accounts, which a per-account counter alone would
never see.

---

## CSRF — decide this deliberately, don't discover it

**Recommendation: add both endpoints to the same CSRF exemption `/auth/login` already has**
(`server/middleware/csrf.js:11`). Two independent reasons, one principled and one empirical.

### The principled reason: CSRF protection here is meaningless

CSRF defends against an attacker making a victim's browser perform an action **using ambient
authority the victim already holds**. These endpoints have no ambient authority to borrow — they
are how authority gets created. The worst a forged `/auth/otp/request` achieves is sending someone
a Telegram code they didn't ask for (already rate-limited, and it grants the attacker nothing,
since the code goes to the *victim's* Telegram). A forged `/auth/otp/verify` requires already
knowing the code, at which point CSRF is not the problem. Enforcing CSRF on an unauthenticated
credential endpoint is cost with no corresponding benefit.

### The empirical reason: this project has already been bitten here

Constitution v3.16 exists because *"a stale `sims_token` cookie could previously 403-block every
login attempt"* — real, and unrecoverable when it hit, because `sims_token` is httpOnly and client
JS therefore cannot clear it. That is why `/auth/login` got its exemption.

**Precisely how much of that risk transfers here — stated accurately, because the naive reading
overstates it:**

Both cookies are set together with the same `maxAge` (`cookieOptions.js`), and the client's axios
interceptor (`client/src/utils/api.js:15-23`) echoes `sims_csrf` into `X-CSRF-Token` on every POST.
So in the **ordinary** stale-session case both cookies are present, the header matches the cookie,
and CSRF **passes**. The trap is narrower than "stale cookie breaks login":

> It needs an **asymmetry** — `sims_token` present while `sims_csrf` is missing. That is reachable
> because `sims_csrf` is deliberately `httpOnly: false` (line 21), so any browser extension,
> privacy tool, partial "clear site data", or stray JS can delete it while the httpOnly
> `sims_token` survives. The user then holds a cookie that forces CSRF enforcement and no cookie to
> satisfy it, and cannot clear either from JS.

Conditional — but conditional in the worst possible way: invisible in local testing, invisible in
review, and permanently locking for whoever hits it. `csrf.js:15` skips enforcement entirely when
no `sims_token` is present, so a *clean* browser is fine — which is exactly why this class of bug
survives every test that starts from a clean browser.

022 never faced this: `GET /auth/telegram/:token` is a `GET`, outside CSRF enforcement entirely.

**If the exemption is deliberately declined**, the client must send `X-CSRF-Token` on both calls and
the flow must be tested with a `sims_token` cookie present but `sims_csrf` deleted. Given the
principled reason above says the protection buys nothing here, that is work in exchange for nothing.

## Endpoint count

Authentication module **4 → 6**; system total **115 → 117** (Constitution §6).

| Endpoint | Status |
|---|---|
| `POST /auth/login` | Existing — untouched. Now reached from `/login/password`. |
| `POST /auth/change-password` | Existing — untouched. |
| `POST /auth/logout` | Existing — untouched. |
| `GET /auth/telegram/:token` | Existing (022) — untouched. |
| `POST /auth/otp/request` | **NEW** |
| `POST /auth/otp/verify` | **NEW** |
