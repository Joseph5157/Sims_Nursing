# Quickstart: Validating Telegram OTP Login

How to prove this feature actually works. Two paths, same as 022's quickstart offered:

- **Path A** — full round trip through a real Telegram bot.
- **Path B** — no bot needed: drive the endpoints directly and read the code out of the database.
  This is what you'll use most, and it's how 022 was validated.

> **Read `research.md` §7 before deploying.** Railway's Watch Paths on this service are scoped to
> `/server/**` (`deploy/known-issues-and-fixes.md` §9). This feature touches `server/`, so it will
> build — but any **client-only** follow-up fix will be silently skipped, showing `SKIPPED` in
> `railway deployment list` rather than an error.

## Prerequisites

```bash
# DB up (see specs/023-sims-id-series/handoff.md if the container fights you)
docker start sims-nursing-postgres

npm run migrate -- --name add_otp_login_codes
npm run generate          # stop the dev server first — Windows locks the Prisma engine DLL
npm run dev
```

## Path B — no bot required (primary)

### 1. Request a code

```bash
curl -i -X POST http://localhost:3000/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"sims_id":"1100"}'
```

Expect `200` and the generic body. **Now request one for a SIMS ID that does not exist:**

```bash
curl -i -X POST http://localhost:3000/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"sims_id":"9998"}'
```

**The two responses must be identical** — same status, same body (FR-003, SC-003). If they differ
in any way, the enumeration guard is broken. Time both; they should be in the same ballpark
(`research.md` §4 explains why they won't be *identical* and why that's an accepted residual).

### 2. Read the code out of the DB

The code is bcrypt-hashed, so you cannot read it back — that's the point (FR-010). Log it
temporarily, or issue a known code directly:

```bash
# Verify a row was actually created, and that the hash is NOT the plaintext
docker exec sims-nursing-postgres psql -U sims -d sims_nursing_dms \
  -c "SELECT id, user_id, left(code_hash, 7) AS hash_prefix, expires_at, used_at
      FROM otp_login_codes ORDER BY created_at DESC LIMIT 3;"
```

`hash_prefix` must look like `$2a$12$` or `$2b$12$` — bcrypt at cost 12. **If it looks like six
digits, or like a hex digest, stop: FR-010 is violated** and a database dump would hand over every
live code.

To get a usable code, plant one with a known value:

```bash
node -e "
const bcrypt=require('bcryptjs');const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  const u=await p.user.findUnique({where:{sims_id:1100}});
  await p.otpLoginCode.deleteMany({where:{user_id:u.id,used_at:null}});
  await p.otpLoginCode.create({data:{user_id:u.id,code_hash:await bcrypt.hash('123456',12),
    expires_at:new Date(Date.now()+5*60*1000)}});
  console.log('planted 123456 for', u.name);process.exit(0);
})()"
```

### 3. Redeem it

```bash
curl -i -X POST http://localhost:3000/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"sims_id":"1100","code":"123456"}'
```

Expect `200`, a body identical in shape to `POST /auth/login`, and **both** cookies:

- `sims_token` — must carry `HttpOnly`
- `sims_csrf` — must **not**

Then reuse the exact same code. Expect `401 INVALID_OTP` (FR-008, SC-007).

### 4. The three rejection paths

```bash
# Wrong code
curl -s -X POST .../auth/otp/verify -d '{"sims_id":"1100","code":"000000"}'   # 401 INVALID_OTP

# Expired — plant one with expires_at in the past, then verify         # 401 INVALID_OTP
# Superseded — plant, then POST /otp/request, then submit the old one  # 401 INVALID_OTP
```

All three return the **same** code and message. Different messages would tell an attacker whether
they'd found a live code.

### 5. Leading zeros — the one that silently breaks 1 code in 10

```bash
# Plant "048291", then:
curl -s -X POST .../auth/otp/verify -d '{"sims_id":"1100","code":"048291"}'   # must be 200
```

If this fails while other codes succeed, something is coercing the code to a number somewhere
(`Number("048291") === 48291`). Check the client input, the Zod schema, and the JSON body.

### 6. Lockout, and the trap inside it

```bash
# 5 wrong codes in a row
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "%{http_code} " -X POST .../auth/otp/verify \
    -H 'Content-Type: application/json' -d '{"sims_id":"1100","code":"000000"}'
done; echo
# 6th attempt — even WITH the correct code — must be 401 OTP_LOCKED
```

```bash
docker exec sims-nursing-postgres psql -U sims -d sims_nursing_dms \
  -c "SELECT sims_id, otp_failed_attempts, otp_locked_until FROM users WHERE sims_id=1100;"
# expect: otp_failed_attempts=5, otp_locked_until ≈ now + 15min
```

Confirm a request during cool-off is suppressed — still a generic `200`, but **no new row**
(FR-016b, `research.md` §6):

```bash
curl -s -X POST .../auth/otp/request -d '{"sims_id":"1100"}'
docker exec sims-nursing-postgres psql -U sims -d sims_nursing_dms \
  -c "SELECT count(*) FROM otp_login_codes WHERE used_at IS NULL
      AND user_id=(SELECT id FROM users WHERE sims_id=1100);"   # expect 0
```

**Now the trap.** Fast-forward the lock instead of waiting 15 minutes:

```bash
docker exec sims-nursing-postgres psql -U sims -d sims_nursing_dms \
  -c "UPDATE users SET otp_locked_until = now() - interval '1 minute' WHERE sims_id=1100;"
```

Plant a code, submit **one wrong** code, then check:

```bash
docker exec sims-nursing-postgres psql -U sims -d sims_nursing_dms \
  -c "SELECT otp_failed_attempts, otp_locked_until FROM users WHERE sims_id=1100;"
```

**`otp_failed_attempts` must be `1`, and `otp_locked_until` must be `NULL`.**

> If it reads `6` and the account re-locked, the reset-on-lapse rule is missing. That is a
> **permanent lockout that re-arms on every typo** — it violates FR-016 and SC-004a, and it passes
> a naive "does it lock at 5?" test unnoticed. See `data-model.md`.

Finally, plant a code and redeem it correctly — `otp_failed_attempts` must return to `0` (FR-014).

### 7. Concurrency — the bug 022 actually shipped

```bash
# Plant "123456", then fire two redemptions simultaneously
for i in 1 2; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST .../auth/otp/verify \
    -H 'Content-Type: application/json' -d '{"sims_id":"1100","code":"123456"}' &
done; wait
```

Expect exactly one `200` and one `401` (FR-008, SC-008). **Two `200`s means one code minted two
sessions.** 022 shipped exactly this bug and its concurrency test is what caught it — which is why
this has a dedicated Vitest case, not just a manual check.

## Path A — full round trip with a real bot

Needs `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` set to a real bot, and your user row's
`telegram_id` set to your chat ID (`/myid` on the bot).

1. Open `/login`, enter your SIMS ID, submit.
2. A 6-digit code arrives in Telegram within seconds.
3. **Do the part that justifies this feature existing**: read the code on your *phone*, type it into
   a *desktop* browser that has never seen Telegram. This is the cross-device case the 022 magic
   link structurally cannot serve (SC-001) — if you test it on one device you have not tested the
   feature's reason for existing.
4. Land on your role's dashboard.

## Regression — the part that keeps the lights on

**Non-negotiable. If any of this fails, do not ship** (FR-019/FR-020/FR-021, SC-006).

```bash
# Password fallback still works, at its new address
curl -i -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"1100","password":"<known>"}'          # 200 + both cookies
```

- `/login/password` renders and logs in **with the bot switched off entirely** (SC-005, US2). This
  is the scenario the fallback exists for — testing it while Telegram works tests nothing.
- `/login` shows a discoverable route to the fallback (FR-018).
- The 022 magic link still works end to end (FR-019).
- `/resetpassword` on the bot, admin **Reset Login**, invite activation's temp password, and the
  forced password-change step all still work (FR-020).
- No existing user had to do anything (FR-021).

```bash
cd server && npx vitest run     # 111 existing + new OTP cases, all green
cd .. && npm run build          # 0 errors
```

## Audit trail

```bash
docker exec sims-nursing-postgres psql -U sims -d sims_nursing_dms \
  -c "SELECT action, count(*) FROM admin_audit_log
      WHERE action LIKE '%LOGIN%' GROUP BY action;"
```

`OTP_LOGIN` must appear, distinct from `PASSWORD_LOGIN` and `TELEGRAM_LOGIN` (FR-012).

## Post-deploy (production)

Per `deploy/known-issues-and-fixes.md` §7, a browser tab open from before the deploy will serve the
**old** bundle from its service worker and show you the old login page. Before concluding anything:

```js
const regs = await navigator.serviceWorker.getRegistrations();
for (const r of regs) await r.unregister();
const keys = await caches.keys();
for (const k of keys) await caches.delete(k);
```

Then hard-reload. A `waiting` service worker means the fix is live but not yet active in that tab —
not that the deploy failed.
