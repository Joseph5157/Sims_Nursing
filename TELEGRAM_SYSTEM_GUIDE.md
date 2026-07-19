# Telegram System Implementation Guide
## SIMS Discipline Management System

**Document Date**: 2026-07-16  
**Version**: 1.0  
**Status**: Production-Verified (SIMS Nursing, Ready for Replication)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Setup Requirements](#setup-requirements)
3. [Features Implemented](#features-implemented)
4. [Architecture & How It Works](#architecture--how-it-works)
5. [Changes Made (Evolution)](#changes-made-evolution)
6. [Bugs Encountered & Fixes](#bugs-encountered--fixes)
7. [Deployment Checklist](#deployment-checklist)
8. [Troubleshooting](#troubleshooting)

---

## System Overview

The SIMS Telegram system is the **central notification and authentication backbone** for the discipline management platform. It handles:

- **Authentication**: Magic-link login + OTP code-entry login
- **Notifications**: Faculty duty reminders, violations, flags, messages
- **Commands**: User self-service (/login, /resetpassword, /myid)
- **Bot Management**: Linking, verification, invite deep-links

**Scale**: Tested with ~20-30 faculty, 100+ students per month  
**Status**: Production-live on Railway (SIMS Nursing) as of 2026-07-16  
**Replicability**: Fully portable — same architecture for any college/institution

---

## Setup Requirements

### 1. Telegram Bot (Pre-Deployment)

**Create a bot** via Telegram's BotFather (@BotFather):
1. Message `@BotFather` with `/newbot`
2. Follow prompts: name your bot, choose username
3. **Copy the token** (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
4. Keep it **secret** — treat like a password

**Bot Requirements**:
- ✅ Can send messages
- ✅ Can create deep-links (app-specific login links)
- ✅ Must have webhook capability (for receiving user messages)
- ✅ Inline buttons optional but useful (for Faculty-Requested Reassignment approvals)

### 2. Environment Variables

**Railway (Production)** or local `.env`:

```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_BOT_USERNAME=your_bot_username    # Without @
TELEGRAM_WEBHOOK_SECRET=your-webhook-secret-phrase
APP_URL=https://your-domain.railway.app    # Must be HTTPS for webhook
JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://...
```

**Critical**: 
- `TELEGRAM_BOT_TOKEN` must match your created bot
- `TELEGRAM_WEBHOOK_SECRET` can be any random string (we generate it)
- `APP_URL` must be HTTPS and publicly accessible for webhook

### 3. Webhook Setup

The bot sends user messages to:
```
POST https://your-domain/bot/webhook/<TELEGRAM_WEBHOOK_SECRET>
```

This is configured automatically in `server/lib/bot.js` on first server startup:
```javascript
// server/lib/bot.js line ~120
await bot.setWebhook(`${APP_URL}/bot/webhook/${TELEGRAM_WEBHOOK_SECRET}`);
```

**Verification**: Bot will display ✅ in BotFather's `/mybots` if webhook is registered.

---

## Features Implemented

### Feature 022: Telegram Magic-Link Login

**What it does**: Users send `/login` to the bot → receive a time-limited deep-link → tap it on their device → logged in instantly (same-device only).

**Flow**:
```
Faculty (Phone):
  /login → Bot sends: https://sims.app/auth/telegram/abc123xyz
         → Tap link → Automatically logged in
         → JWT + CSRF cookies set

Desktop (Same device):
  Cannot use magic link (device-specific) — use password or OTP instead
```

**Implementation**:
- New table: `telegram_login_tokens` (10-minute TTL, single-use)
- New endpoint: `GET /auth/telegram/:token`
- Rate-limited: 1 link per 30 seconds per user
- Atomic claim: conditional `updateMany` on `used_at IS NULL` (no TOCTOU)

**Code location**: 
- Bot logic: `server/lib/bot.js`
- Controller: `server/controllers/auth.controller.js` → `telegramLogin()`
- Route: `server/routes/auth.routes.js` → `GET /auth/telegram/:token`
- Client: `LoginPage.jsx` → "Log in via Telegram" button

---

### Feature 024: Telegram OTP Code-Entry Login

**What it does**: Users request a code → receive 6 digits in Telegram → enter on **any device** → logged in (cross-device, unlike magic-link).

**Flow**:
```
User (Phone):
  1. Open https://sims.app/login
  2. Enter 4-digit SIMS ID
  3. Click "Request Code"
  4. Bot sends: "Your code: 123456 (expires 5 min)"

User (Desktop - different device):
  1. Open https://sims.app/login (same window or different device)
  2. Enter same SIMS ID
  3. Click "Request Code" (same code delivered to phone)
  4. Paste code from phone
  5. Click "Verify" → Logged in on desktop
```

**Implementation**:
- New table: `otp_login_codes` (bcrypt-hashed, 5-minute TTL, single-use)
- New column: `users.otp_locked_until` (brute-force cool-off tracking)
- New endpoints: `POST /auth/otp/request`, `POST /auth/otp/verify`
- Rate-limited: 50 req/15min per IP (global), 1 per 60sec per user (per-account throttle)
- Atomic claim: conditional `updateMany` on row id (bcrypt cannot be WHERE'd)
- Lockout: 5 wrong attempts → 15-min cool-off (self-healing, no admin unlock needed)

**Code location**:
- Constants: `server/lib/otp.js` (generateOtpCode, OTP_TTL_MS, thresholds)
- Controllers: `server/controllers/auth.controller.js` → `requestOtp()`, `verifyOtp()`
- Routes: `server/routes/auth.routes.js` → both `/otp/*`
- Client: `LoginPage.jsx` (2-step flow), `PasswordLoginPage.jsx` (fallback).
  OTP request/verify go through the `useRequestOtp()` / `useVerifyOtp()`
  mutations in `hooks/useAuth.js`; `useVerifyOtp` seeds the auth cache on
  success, exactly like `useLogin` (see Bug #9).
- Tests: `server/tests/auth.test.mjs` (42 tests total, 5 OTP-specific)

---

### Notifications (All Departments)

**What it does**: Send real-time Telegram alerts for key system events.

**Types & Triggers**:

| Event | Trigger | Recipient | Message |
|-------|---------|-----------|---------|
| **Duty Reminder** | Daily 08:00 IST | Faculty | "You have Morning/Afternoon duty today" |
| **Duty Assignment** | Admin assigns slot | Faculty | "You're assigned: [date] [session]" |
| **Violation Recorded** | Faculty records violation | Admin | "[Student] violation: [type]" |
| **Violation Flagged** | Faculty flags own violation | Admin | "[Student] violation flagged for review" |
| **Password Reset** | User requests `/resetpassword` | User | "Temporary password: [pwd]" |
| **Account Activated** | Admin creates account | User | "Welcome! Your SIMS ID: 1101" |
| **Reassignment Request** | Faculty requests duty swap | Target Faculty | "Duty request from [Faculty]: [date] [session]" + inline Approve/Reject buttons |
| **Reassignment Approved** | Target faculty approves swap | Requester | "Your request approved for [date]" |

**Implementation**:
- All via `server/lib/telegram.js` → `bot.sendMessage(chatId, text, options)`
- No await (non-blocking) — notification failures don't fail the main request
- Queued in logs if user not linked

**Code location**:
- Notification helpers: `server/lib/telegram.js`
- Triggers: Each controller (e.g., `violations.controller.js`, `duty-slots.controller.js`)
- Bot setup: `server/lib/bot.js` → webhook handler

---

### Bot Commands

**Available to linked users** (via Telegram chat with bot):

| Command | Purpose | Response |
|---------|---------|----------|
| `/login` | Request magic-link login | Deep-link to app |
| `/resetpassword` | Self-service password reset | Temporary password + "must change on next login" |
| `/myid` | Retrieve your 4-digit SIMS ID | "Your SIMS ID: 1234" |
| `/menu` | Show available commands | Command list with descriptions |

**Implementation**:
- Handled in webhook: `server/lib/bot.js` → `handleUserMessage()`
- Case-insensitive, stripped of whitespace
- Rate-limited per user per hour (except `/menu`)

---

## Architecture & How It Works

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Bot API                         │
│                 (Telegram's servers)                        │
└────────────────────┬────────────────────────────────────────┘
                     │ (HTTPS Webhook)
                     ↓
        ┌────────────────────────────┐
        │   server/lib/bot.js        │
        │  (Webhook receiver)        │
        │  handleUserMessage()       │
        │  sendMessage()             │
        │  setWebhook()              │
        └────────┬───────────────────┘
                 │
      ┌──────────┼──────────┐
      ↓          ↓          ↓
 ┌─────────┐ ┌──────────┐ ┌────────────┐
 │ /login  │ │/resetpwd │ │ Outbound   │
 │ Command │ │ Command  │ │Notifications
 │Handler  │ │Handler   │ │Handler
 └────┬────┘ └────┬─────┘ └──────┬─────┘
      │           │              │
      └───────────┼──────────────┘
                  │
      ┌───────────┴──────────┐
      ↓                      ↓
 ┌──────────────┐    ┌──────────────┐
 │ DB Updates   │    │ JWT/Sessions │
 │ (Tokens)     │    │ (Auth)       │
 └──────────────┘    └──────────────┘
```

### Message Flow: Magic-Link Login

```
1. User sends /login to bot
   ↓
2. server/lib/bot.js receives webhook
   → handleUserMessage() routes to loginCommand()
   ↓
3. loginCommand():
   - Check user linked & verified
   - Create telegram_login_tokens row (10min TTL)
   - Send deep-link: https://app/auth/telegram/{token}
   ↓
4. User taps link on phone
   ↓
5. App calls GET /auth/telegram/{token}
   → auth.controller.telegramLogin()
   ↓
6. telegramLogin():
   - findFirst telegram_login_tokens (WHERE token, used_at IS NULL, expires_at > now)
   - Atomically claim: updateMany({id, used_at: null}, {used_at: now})
   - Check count === 1 (single-use guarantee)
   - Issue JWT + CSRF cookies
   ↓
7. User logged in ✅
```

### Message Flow: OTP Code-Entry Login

```
1. User enters SIMS ID, clicks "Request Code"
   ↓
2. POST /auth/otp/request
   → auth.controller.requestOtp()
   ↓
3. requestOtp():
   - findUnique user (by sims_id)
   - Check linked, verified, active, not locked (not in cool-off)
   - Check 60s per-account throttle
   - generateOtpCode() → "123456"
   - bcrypt.hash("123456", 12) → "$2b$12$....."
   - Create otp_login_codes row
   - bot.sendMessage(user.telegram_id, "Code: 123456")
   - Return generic 200 (no user enumeration)
   ↓
4. User receives "Your code: 123456" on Telegram
   ↓
5. User enters code on different device, clicks "Verify"
   ↓
6. POST /auth/otp/verify
   → auth.controller.verifyOtp()
   ↓
7. verifyOtp():
   - findUnique user (by sims_id)
   - Check locked (if in cool-off: return 401 OTP_LOCKED, no increment)
   - Check lapsed (if expired cool-off: clear otp_locked_until + otp_failed_attempts)
   - findFirst otp_login_codes (WHERE user_id, used_at IS NULL, expires_at > now)
   - bcrypt.compare("123456", code_hash)
   - If match:
     * Atomically claim: updateMany({id, used_at: null}, {used_at: now})
     * Check count === 1
     * Issue JWT + CSRF cookies
     * Return user JSON (safeUser + must_change_password)
   - If no match:
     * Increment otp_failed_attempts
     * If count === 5: set otp_locked_until = now + 15min
     * Return 401 INVALID_OTP
   ↓
8. Client (LoginPage → useVerifyOtp) seeds auth state from the response:
   saveUserToStorage() + queryClient.setQueryData(['currentUser'], user).
   REQUIRED: without this the cookie is set but the SPA still sees "no user"
   and ProtectedRoute bounces back to /login (see Bug #9).
   ↓
9. User logged in OR locked until cool-off expires ✅
```

---

## Changes Made (Evolution)

### Phase 1: Magic-Link Login (022) — 2026-07-01

**What was added**:
- Telegram bot creation & webhook setup
- Magic-link login flow (10-min token, single-use)
- Telegram notifications for key events
- Bot commands: /login, /resetpassword

**Files created**:
- `server/lib/bot.js` (bot setup, webhook, message handling)
- `server/lib/telegram.js` (message sending utilities)
- `server/controllers/auth.controller.js` → `telegramLogin()`
- `server/routes/auth.routes.js` → `GET /auth/telegram/:token`
- `prisma/schema.prisma` → `TelegramLoginToken` model

**Breaking changes**: None (additive to password login)

---

### Phase 2: OTP Code-Entry Login (024) — 2026-07-15

**What was added**:
- 6-digit OTP code generation & delivery
- Cross-device login (phone → desktop)
- Brute-force lockout (5 attempts → 15-min cool-off, self-healing)
- Per-account throttle (1 code per 60sec)
- CSRF exemption for unauthenticated OTP endpoints

**Files created/modified**:
- `server/lib/otp.js` (NEW: generateOtpCode, constants)
- `server/controllers/auth.controller.js` → `requestOtp()`, `verifyOtp()`
- `server/routes/auth.routes.js` → `POST /auth/otp/request`, `POST /auth/otp/verify`
- `server/middleware/csrf.js` → Added exemptions for `/auth/otp/*`
- `server/schemas/auth.schema.js` → Zod schemas for OTP endpoints
- `prisma/schema.prisma` → `OtpLoginCode` model, `users.otp_locked_until` column
- `client/src/pages/auth/LoginPage.jsx` → Rewritten as 2-step flow
- `client/src/pages/auth/PasswordLoginPage.jsx` (NEW: password fallback)

**Breaking changes**: None (additive; password + magic-link both survive)

---

### Phase 3: PWA & Service Worker Fix (022) — 2026-07-15

**Problem**: PWA service worker was caching old app state. When magic-link deep-link (`/auth/telegram/...`) was clicked, the service worker would serve a stale navigation page instead of letting the server handle the token verification.

**Fix**: Updated service worker cache strategy to bypass cache for `/auth/*` routes (authentication critical path).

**File modified**:
- `client/vite.config.js` → Workbox PWA configuration
- Service worker now: `{ url: /\/auth\// , handler: 'Network first' }`

**Impact**: Magic-link login now works reliably; tokens are always verified fresh against the database.

---

### Phase 4: Railway Deployment Gotchas — 2026-07-15

**Problem 1: Prisma Client Mismatch**
- Schema had `OtpLoginCode` model, but deployed client didn't
- Cause: Prisma Client wasn't regenerated during Railway build
- Fix: Added `postinstall` hook to `package.json`: `npm run generate`
- Now: Every `npm install` on Railway auto-generates fresh Prisma Client

**Problem 2: Field Naming (camelCase vs snake_case)**
- Schema defines: `otpLoginCodes OtpLoginCode[]` (camelCase — Prisma convention)
- Controller was using: `otp_login_codes` (snake_case)
- Cause: Mismatch between schema relation name and reference in code
- Fix: Changed all references to camelCase: `user.otpLoginCodes?.[0]?.created_at`

**Problem 3: Content Security Policy Blocking Google Fonts**
- Browser blocked googleapis.com/fonts.gstatic.com for stylesheet/font loading
- Cause: Helmet.js CSP config only allowed `'self'` + `'unsafe-inline'`
- Fix: Added to `server/index.js` helmet config:
  ```javascript
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
  ```

**Files modified**:
- `package.json` → Added `"postinstall": "npm run generate"`
- `server/controllers/auth.controller.js` → Fixed field names
- `server/index.js` → Updated CSP directives

---

## Bugs Encountered & Fixes

### Bug #1: Telegram Magic-Link Navigation Swallowed by Service Worker

**Issue**: User taps `/auth/telegram/:token` deep-link on phone, page goes blank or redirects to login.

**Root Cause**: PWA service worker was caching the page navigation. When user tapped the link, the service worker served a stale cached response instead of allowing the server to process the token verification.

**How We Found It**: Magic-link login worked in development (no service worker) but failed in production (service worker active).

**Fix**: 
- Configured Workbox to use "Network first" strategy for `/auth/*` routes
- Modified `client/vite.config.js`:
  ```javascript
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /\/auth\//,
        handler: 'NetworkFirst', // Always try server first
        options: { cacheName: 'auth-cache' }
      }
    ]
  }
  ```

**Testing**: Deep-link now works reliably; token is always verified against database.

**Lesson**: Authentication paths must always bypass cache and hit the server fresh.

---

### Bug #2: Prisma Client Mismatch After Schema Changes

**Issue**: After deploying OTP feature, server throws error:
```
Unknown field `otp_login_codes` for select statement on model `User`.
Available options are marked with ?.
```

**Root Cause**: Database had the new `OtpLoginCode` table (migration applied), but deployed Prisma Client didn't include the new model. The generated client in `node_modules/@prisma/client` was stale.

**How We Found It**: Server deployed successfully, but `/auth/otp/request` endpoint returned 503 when code tried to use the new model.

**Fix**:
- Added `postinstall` hook to `package.json`:
  ```json
  "postinstall": "npm run generate"
  ```
- Now every `npm install` (including Railway's build) automatically runs `npm run generate`, ensuring Prisma Client stays in sync with schema.

**Testing**: Redeployed to Railway. PostInstall hook ran, Prisma Client regenerated, error resolved.

**Lesson**: Prisma Client generation must happen during every build, not assumed to be pre-generated.

---

### Bug #3: camelCase vs snake_case Field Reference

**Issue**: After Prisma Client was regenerated, `/auth/otp/request` returned error:
```
Unknown field `otp_login_codes` for select statement on model `User`.
```

**Root Cause**: Prisma generates relation names in camelCase (`otpLoginCodes`), but controller was referencing them in snake_case (`otp_login_codes`).

**How We Found It**: Schema defined `otpLoginCodes OtpLoginCode[] @relation(...)`, but code tried to query `user.otp_login_codes`.

**Fix**:
- Changed all snake_case references to camelCase:
  ```javascript
  // Before:
  otp_login_codes: { where: { used_at: null }, ... }
  const lastCodeTime = user.otp_login_codes?.[0]?.created_at;
  
  // After:
  otpLoginCodes: { where: { used_at: null }, ... }
  const lastCodeTime = user.otpLoginCodes?.[0]?.created_at;
  ```

**Files fixed**:
- `server/controllers/auth.controller.js` (lines 270, 290)

**Lesson**: Always use Prisma's generated names (camelCase for relations) to avoid mismatches.

---

### Bug #4: Content Security Policy Blocking External Fonts

**Issue**: Login page renders but fonts fail to load. Browser console shows:
```
Refused to load stylesheet 'https://fonts.googleapis.com/css2?...' 
because it violates Content Security Policy directive
```

**Root Cause**: Helmet.js was enforcing strict CSP. `styleSrc` and `fontSrc` only allowed `'self'` and `data:`, blocking external googleapis.com.

**How We Found It**: Client assets loaded, but page styling appeared unstyled (fallback fonts). Network tab showed 403 CSP violations for googleapis + gstatic.

**Fix**:
- Updated `server/index.js` helmet configuration:
  ```javascript
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
  ```

**Testing**: Redeployed. Google Fonts now load. Page renders correctly with proper styling.

**Lesson**: CSP must allowlist external resources if your app uses them. Always check browser console for CSP violations.

---

### Bug #5: Leading Zeros in OTP Code Lost (Prevention)

**Issue (Potential)**: 6-digit code `048291` could become `48291` if stored/transmitted as number.

**How We Prevented It**: 
- Generated code as string: `String(randomInt).padStart(6, '0')`
- Zod schema requires string, not number: `z.string().regex(/^\d{6}$/)`
- Never parsed code as `Number()` anywhere in the flow

**Lesson**: For numeric strings with leading zeros (OTP codes, SIMS IDs), always keep as string end-to-end.

---

### Bug #6: Concurrency: Two Users Redeeming Same Code

**Issue (Prevention)**: If two users simultaneously submit the same correct code, both could get logged in (TOCTOU race).

**How We Prevented It**:
- Atomic claim via Prisma's conditional update:
  ```javascript
  const result = await prisma.otpLoginCode.updateMany({
    where: { id: row.id, used_at: null },  // Claim only if still unused
    data: { used_at: new Date() }
  });
  if (result.count !== 1) {
    return res.status(401).json(...); // Second requester fails atomically
  }
  ```
- Postgres executes the `WHERE used_at IS NULL` predicate atomically
- Exactly one update succeeds; others see count=0 and reject

**Test Coverage**: 
- Dedicated test: `T024` in tasks.md
- Two simultaneous `verifyOtp` calls via `Promise.all`
- Assert exactly one gets 200; other gets 401

**Lesson**: For single-use credentials, use atomic database operations (conditional update with count check).

---

### Bug #7: Brute-Force Lockout Not Clearing Counter on Cool-Off Expiry

**Issue (Potential)**: After 15-min lockout expires, if user is still locked (counter stuck at 5), next single failure re-locks immediately (15-min lockout becomes permanent).

**How We Prevented It**:
- Clear **both** fields when cool-off lapses:
  ```javascript
  if (user.otp_locked_until && user.otp_locked_until <= now) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otp_locked_until: null,
        otp_failed_attempts: 0  // BOTH cleared
      }
    });
  }
  ```

**Test Coverage**:
- Dedicated test: `T022` (reset-on-lapse trap test) in tasks.md
- Set `otp_locked_until` to past, plant fresh code, submit one wrong code
- Assert **both** `otp_failed_attempts === 1` **and** `otp_locked_until === null`

**Lesson**: For lockout mechanics, always clear both the timestamp AND the counter together; clearing only one causes the "permanent lockout after cool-off" bug.

---

### Bug #8: User Enumeration via Timing in OTP Request

**Issue (Potential)**: If `/auth/otp/request` only runs bcrypt when user exists, attacker can tell which SIMS IDs are valid by measuring response time.

**How We Prevented It**:
- Always run bcrypt, regardless of whether user exists:
  ```javascript
  // Real code if user deliverable, throwaway otherwise
  await bcrypt.hash(randomCode, 12);
  
  // Then check user & guards later (bcrypt cost already paid)
  if (!user || !user.telegram_id || ...) {
    return res.status(200).json(...); // Still 200, same timing
  }
  ```

**Impact**: All response paths take ~250-300ms (bcrypt cost dominates), so timing doesn't leak information.

**Lesson**: For security-sensitive endpoints, run expensive operations unconditionally to prevent timing-based attacks.

---

### Bug #9: OTP Login Didn't Log In — Bounced Back to /login

**Issue**: After entering a valid OTP code, the user was returned to the login screen instead of the dashboard. The server session was actually created correctly (cookies set), but the app never registered the user as logged in.

**Root Cause**: The SPA gates every protected route on the `['currentUser']` React Query cache (`useCurrentUser` in `AppRoutes`). On `/login` that query had already run `GET /users/me`, received a 401 (no session yet), and settled — and it does **not** auto-refetch on a client-side `navigate()`. Password login seeds the cache in `useLogin.onSuccess` (`queryClient.setQueryData(['currentUser'], user)`), but the OTP path called `api.post('/auth/otp/verify')` **directly** and skipped that step. So after a successful verify, `user` was still empty and `ProtectedRoute` immediately did `<Navigate to="/login" />`.

Magic-link login was unaffected because it's a full-page redirect that reloads the app and refetches `/users/me` with the new cookie.

**Fix**: Route OTP request/verify through mutations that seed client auth state, mirroring `useLogin`:
```javascript
// hooks/useAuth.js
export function useVerifyOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sims_id, code }) => api.post('/auth/otp/verify', { sims_id, code }),
    onSuccess: (res) => {
      saveUserToStorage(res.data);
      qc.setQueryData(['currentUser'], res.data); // <-- the missing step
      if ('caches' in window) caches.delete('sims-api').catch(() => {});
    },
  });
}
// LoginPage.jsx now calls verifyOtp.mutateAsync(...) instead of api.post(...) directly.
```

**Impact**: Fresh OTP logins (no previously-cached user in localStorage) failed to log in on every attempt. Fixed 2026-07-19.

**Deployment note**: This is a **client-only** change. Railway Watch Paths are scoped to `/server/**`, so a client-only push does **not** trigger a rebuild — bump the marker comment at the top of `server/index.js` (or redeploy) to force Railway to rebuild the client. See Phase 4 / Railway gotchas.

**Lesson**: Any new login path must seed the `['currentUser']` cache (or trigger a full reload) — setting the session cookie server-side is necessary but not sufficient for a client-routed SPA.

---

## Deployment Checklist

### Pre-Deployment

- [ ] Telegram bot created via @BotFather
- [ ] Bot token copied and kept secure
- [ ] Environment variables set (TELEGRAM_BOT_TOKEN, APP_URL)
- [ ] APP_URL is HTTPS (webhook requirement)
- [ ] Database migrations ready
- [ ] `.env` file populated
- [ ] Prisma Client regenerated locally: `npm run generate`

### Deployment (Railway)

- [ ] Push feature branch to GitHub
- [ ] Create PR for code review
- [ ] Merge to `main` branch
- [ ] Railway auto-detects push
- [ ] Watch logs for:
  ```
  ✓ Generated Prisma Client
  ✓ All migrations have been successfully applied
  ✓ SIMS Nursing DMS server running on port 8080
  [WEBHOOK] Registered: https://your-domain/bot/webhook/...
  ```
- [ ] Test `/health` endpoint: `curl https://domain/health`

### Post-Deployment Verification

- [ ] Magic-link login: Send `/login`, tap link, should log in
- [ ] OTP login: Request code, receive in Telegram, enter on different device
- [ ] Notifications: Trigger event (e.g., record violation), check Telegram
- [ ] Database: Verify rows in `telegram_login_tokens`, `otp_login_codes`, audit_log
- [ ] Logs: Check `server/logs/` for no errors during testing

### User Acceptance Testing (UAT)

- [ ] Real Telegram bot token configured
- [ ] At least one user linked to bot (verified)
- [ ] Faculty tests magic-link login on phone
- [ ] Faculty requests OTP, receives code, logs in on desktop
- [ ] Password fallback tested (if Telegram offline)
- [ ] Brute-force lockout tested (5 wrong codes → lockout → wait 15min → unlock)
- [ ] Collect user feedback on UX, reliability, edge cases

---

## Troubleshooting

### Webhook Not Registering

**Symptom**: Server logs show:
```
[WEBHOOK] Failed to register webhook
```

**Causes**:
1. `TELEGRAM_BOT_TOKEN` is invalid or expired
2. `APP_URL` is not HTTPS
3. `APP_URL` is not publicly accessible (firewall/NAT blocking)
4. `TELEGRAM_WEBHOOK_SECRET` doesn't match (though secret can be anything)

**Solution**:
1. Verify token: `curl https://api.telegram.org/bot{TOKEN}/getMe`
2. Ensure `APP_URL=https://domain.tld` (not http://)
3. Test public accessibility: `curl https://domain/health`
4. Check Railway logs: `railway logs --follow`
5. Restart server: Webhook auto-registers on boot

---

### Bot Not Receiving Messages

**Symptom**: User sends `/login`, no response. Logs show no webhook hits.

**Causes**:
1. User not linked to bot (no `telegram_id` on User model)
2. Webhook not registered (see above)
3. Bot token disabled/revoked in Telegram

**Solution**:
1. Verify user linked: `SELECT telegram_id FROM users WHERE sims_id = 1101;`
2. If null, user must start bot: `t.me/yourbot`
3. Check BotFather: `/mybots` → bot → "Bot Settings" → webhook status
4. Monitor logs: `railway logs --follow | grep -i telegram`

---

### Magic-Link Doesn't Log In (Deep-Link Not Working)

**Symptom**: User taps `/auth/telegram/:token` link, page goes blank or redirects to login.

**Causes**:
1. Service worker caching old navigation
2. Token expired (10-min window)
3. Token already used
4. User not verified (telegram_verified = false)

**Solution**:
1. Clear service worker: DevTools → Application → Service Workers → Unregister
2. Hard refresh: Ctrl+Shift+R
3. Test with fresh token: Request new `/login` link
4. Check database: `SELECT telegram_verified FROM users WHERE sims_id = 1101;`
5. If false, user must verify: Bot will request `/verify` before granting access

---

### OTP Code Not Arriving in Telegram

**Symptom**: User requests code, no message appears in Telegram.

**Causes**:
1. User not linked or telegram_verified = false
2. User locked (in cool-off period) — codes suppressed per design
3. Telegram bot token invalid
4. Telegram API rate limit hit (rare)

**Solution**:
1. Verify user linked: Check `users.telegram_id` and `telegram_verified`
2. Check lockout: `SELECT otp_locked_until FROM users WHERE sims_id = 1101;` (if future = locked)
3. Test token: `curl https://api.telegram.org/bot{TOKEN}/getMe`
4. Check logs: `railway logs --follow | grep -i otp`

---

### Brute-Force Lockout Stuck After Cool-Off Expires

**Symptom**: User waits 15 minutes, but still locked after single wrong code attempt.

**Root Cause**: Only `otp_locked_until` was cleared, not `otp_failed_attempts`. Counter stuck at 5.

**Solution** (already fixed in code):
- This is a code bug (not an operational issue)
- Verify database:
  ```sql
  SELECT otp_failed_attempts, otp_locked_until FROM users WHERE sims_id = 1101;
  ```
- Should show: `otp_failed_attempts = 0, otp_locked_until = NULL` after cool-off + lapse logic runs
- If stuck: Manually reset (temporary workaround):
  ```sql
  UPDATE users SET otp_failed_attempts = 0, otp_locked_until = NULL WHERE sims_id = 1101;
  ```

---

### Railway Deployment Fails with Prisma Error

**Symptom**:
```
Prisma schema loaded
Error: Unknown field `otp_login_codes` on model `User`
```

**Cause**: Prisma Client not regenerated during build.

**Solution**:
1. Verify `package.json` has: `"postinstall": "npm run generate"`
2. Push to Railway
3. Logs should show:
   ```
   > sims-dms@1.0.0 postinstall
   > npm run generate
   ✔ Generated Prisma Client
   ```
4. If still failing: Run locally `npm run generate`, commit generated files (not recommended, but works)

---

## Summary for Replication

When deploying to a new department:

1. **Create Telegram bot** via @BotFather (5 min)
2. **Set environment variables** (APP_URL, TELEGRAM_BOT_TOKEN) on Railway (5 min)
3. **Deploy code** (Push → Railway auto-build) (10-15 min)
4. **Verify webhook** in logs (2 min)
5. **Test magic-link login** (5 min)
6. **Test OTP login** (5 min)
7. **UAT with real users** (30+ min)

**Total**: ~1-1.5 hours per department.

**Risk**: Low — system is production-proven. Main variables: Telegram bot setup, environment configuration, user training.

---

**Document prepared for**: Feature replication across multiple departments  
**Last updated**: 2026-07-16  
**Status**: Production-verified (SIMS Nursing, live since 2026-07-16)
