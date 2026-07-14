# Quickstart: Validating Telegram Magic-Link Login

## Prerequisites

- Migration applied: `npm run migrate:deploy` (adds `telegram_login_tokens`).
- A user account with `telegram_verified = true` and a real `telegram_id` — either the Super
  Admin seeded by `db/seed-department.mjs` after linking Telegram via the invite flow, or any
  other account that has completed `/start relink_<token>` with a real Telegram account.
- A **real** `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` in `.env` — this local dev environment
  currently has placeholder values (see `deploy/clone-checklist.md` step 2), so the end-to-end
  bot round trip can't be exercised until a real bot is created. Everything else below (the
  claim endpoint itself) can be validated without a real bot by inserting a token row directly.

## Path A — Full end-to-end (requires a real bot token)

1. Message the bot `/login` from the linked Telegram account (or use the web login page's
   "Log in via Telegram" link, which deep-links to `t.me/<bot>?start=login`).
2. Confirm the bot replies within a few seconds with a "Log in" button.
3. Tap it. Confirm the browser lands on the correct role dashboard, already authenticated (no
   password prompt).
4. Open the same link again. Confirm it now redirects to
   `/login?telegram_error=used` and shows a plain-language "link already used" message.
5. Request a new link, wait 11 minutes, then open it. Confirm `telegram_error=expired`.
6. Request two links back-to-back within 30 seconds. Confirm the second bot reply is the
   rate-limit message, not a second token.

## Path B — Claim-endpoint validation without a live bot

Useful while `TELEGRAM_BOT_TOKEN` is still a placeholder in this environment.

1. Insert a token row directly for a known active user (e.g. via `prisma studio`, or a one-off
   `node -e` script using `@prisma/client`), with `expires_at` a few minutes in the future.
2. `curl -i http://localhost:3000/auth/telegram/<token>` and confirm:
   - A `302` with `Location: /` and `Set-Cookie: sims_token=...; HttpOnly` /
     `Set-Cookie: sims_csrf=...` headers present.
   - Repeating the exact same `curl` call now returns `302` to
     `/login?telegram_error=used`, with no `Set-Cookie` headers.
3. Insert a second token with `expires_at` in the past; confirm `telegram_error=expired`.
4. Insert a token for a user, then soft-delete or deactivate that user, then attempt the claim;
   confirm `telegram_error=inactive_account`.
5. `curl -i http://localhost:3000/auth/telegram/not-a-real-token`; confirm `telegram_error=not_found`.

## Regression check (password login untouched)

- `POST /auth/login` with the seeded Super Admin's email/password from `handoff.md` still
  succeeds and behaves identically to before this feature.
- `npx vitest run` (from `server/`) — all existing `auth.test.mjs` cases still pass, plus the new
  Telegram-login cases added alongside them.
