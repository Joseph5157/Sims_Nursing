# Contract: `GET /auth/telegram/:token`

Public route (no `authenticate` middleware) — mounted in `server/routes/auth.routes.js` alongside
the existing `/auth/login`. Not subject to CSRF middleware (GET is outside the `UNSAFE` verb set
in `server/middleware/csrf.js`).

## Request

```
GET /auth/telegram/:token
```

- `token` — path param, the opaque string from the Telegram-delivered link. Validated by a Zod
  schema (`telegramLoginTokenParamSchema`) for shape only (non-empty, bounded length,
  hex-charset) before touching the database — same "validate every input" rule every other route
  in this app follows.

## Rate limiting

A dedicated `express-rate-limit` instance (separate from `authLimiter` on `/auth/login`), scoped
to this route only — defense in depth against brute-force guessing, even though tokens are
32-byte-random and not realistically guessable. Suggested: same shape as `authLimiter`
(50 req / 15 min / IP in production, relaxed in development).

## Behavior

1. Atomic claim: `updateMany` matching `token`, `used_at: null`, `expires_at > now()`, and
   `user.status === 'active' && user.deleted_at === null`. This runs *first* and is the sole
   authorization decision (research.md §1) — a diagnostic lookup is only ever done afterward, on
   failure, so it reflects post-claim-attempt state (e.g. a token a concurrent request just won)
   rather than a stale pre-claim snapshot.
2. **On successful claim** (`count === 1`):
   - Fetch the token's `user`.
   - Issue `sims_token` (JWT: `{ sub, role, session_version }`) and `sims_csrf` cookies with the
     exact same options `POST /auth/login` uses (`authCookieOptions()`, `csrfCookieOptions()`).
   - Write an `AdminAuditLog` row: `action: 'TELEGRAM_LOGIN'`, `target_id`/`target_type: user`
     (best-effort — a logging failure must not turn an authenticated login into an error
     response, mirroring the existing `PASSWORD_LOGIN` audit call's non-fatal handling).
   - `302` redirect to `/`.
3. **On failed claim** (`count === 0`): do a read-only lookup by `token` *now* (not before the
   claim attempt) to pick the specific reason and `302` redirect to
   `/login?telegram_error=<code>`:

   | Code | Meaning |
   |---|---|
   | `expired` | Token existed but `expires_at` has passed. |
   | `used` | Token existed, `used_at` already set. |
   | `inactive_account` | Token existed and was otherwise valid, but the linked user is no longer `active` or has been deleted. |
   | `not_found` | No token row matches at all (typo'd/garbage/already-superseded-and-deleted link). |

   The client's `LoginPage.jsx` reads `telegram_error` and renders a plain-language message per
   FR-012 (e.g. "This login link has expired — request a new one from the bot.").

## Response

Always a redirect (`302`) — never a JSON body — since this endpoint is only ever reached via a
real browser navigation (a tapped link), not a programmatic client call.

| Outcome | Location header |
|---|---|
| Success | `/` (SPA root — `useCurrentUser()` bootstrap takes it from there) |
| Any failure | `/login?telegram_error=<code>` |
