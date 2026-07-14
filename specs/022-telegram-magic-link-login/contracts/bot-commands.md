# Contract: Telegram bot `/login` command

Added to `server/lib/bot.js` alongside the existing `/resetpassword`, `/menu`, `/myid`, and
`/start invite_...` / `/start relink_...` handling in the same incoming-message switch.

## Trigger patterns

- Bare command: message text is exactly `/login`.
- Deep-link payload: message text matches `/^\/start\s+login$/` — this is what Telegram sends
  when a user taps a `https://t.me/<bot_username>?start=login` link (the web login page's
  "Log in via Telegram" entry point). Routed to the identical handler as the bare `/login` case.

Both are handled by one function, `handleLoginRequest(chatId)`, mirroring the existing
`handlePasswordReset(chatId)` structure.

## Behavior

1. Look up the user by `telegram_id = String(chatId)`.
2. **Not linked to any account** (`!user`): reply with a message directing them to log in with
   their password and link Telegram from their Profile page first. No token is created. (FR-008,
   Story 3 Scenario 1.)
3. **Linked but inactive/deleted** (`!user.status === 'active' || user.deleted_at`): same reply as
   "not linked" — never confirm account existence/state beyond what's already implied by having a
   linked chat (mirrors the generic-response principle `POST /auth/login` already follows for
   invalid credentials).
4. **Rate limited** (a token for this user was created \< 30s ago): reply "You already have a
   login link — check the message above." No new token is created, no old token is disturbed.
5. **Otherwise**:
   - `deleteMany` any existing unused token for this `user_id`.
   - `create` a new token: random hex string, `expires_at = now() + 10 minutes`.
   - Send a message with an inline "Log in" button (`reply_markup`, same mechanism already used
     for Faculty-Requested Reassignment's Accept/Reject buttons) whose URL is
     `${APP_URL}/auth/telegram/<token>`.
   - Use the same retry-or-flag delivery helper pattern as `notifyPasswordResetSuccess` /
     `notifyActivationSuccess` (`sendWithRetryOrFlag`), since a failed send here is the only
     record of a not-yet-communicated valid token.

## Example message

```
🔐 Log in to SIMS Nursing DMS

Tap the button below to log in — this link works once and expires in 10 minutes.

[ Log in ]   ← inline button, opens https://<app-url>/auth/telegram/<token>
```

## Non-goals for this command

- No plaintext fallback link duplicated in the message body beyond the button itself — keeps the
  message short and avoids a second copy of the sensitive URL sitting in chat history text (the
  button's URL is still visible via Telegram's own UI if the user inspects it, but isn't
  needlessly duplicated).
- No interaction with `/resetpassword`'s own rate limit or `last_password_reset_at` — entirely
  independent throttle (`research.md` §3).
