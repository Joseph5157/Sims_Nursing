# Phase 0 Research: Telegram Magic-Link Login

## 1. Atomic single-use token claim

**Decision**: Claim a token with one conditional Prisma `updateMany`:

```
prisma.telegramLoginToken.updateMany({
  where: { token, used_at: null, expires_at: { gt: new Date() },
           user: { status: 'active', deleted_at: null } },
  data: { used_at: new Date() },
})
```

If `count === 1`, this request won the claim; fetch the token row (now `used_at` set) with its
`user` relation and issue the session. If `count === 0`, nothing was claimed — do a *separate*,
read-only `findUnique` afterward purely to pick the right user-facing error message (expired /
already used / account inactive / not found); that read is never the authorization decision,
only the atomic `updateMany` is.

**Rationale**: Postgres executes a single `UPDATE ... WHERE ...` as one atomic statement — two
concurrent requests racing on the same token can never both match the `used_at: null` predicate
and both succeed; exactly one `UPDATE` will see `used_at` already set by the other and match zero
rows. This gives the same guarantee the reference Laravel design gets from `lockForUpdate()`
inside a transaction, without needing an explicit row lock, a transaction wrapper, or any raw SQL
— it's a plain Prisma call, which also keeps the change compliant with Constitution §2/§10 ("no
raw SQL except complex reports").

**Alternatives considered**:
- `$transaction` + raw `SELECT ... FOR UPDATE` (the literal Laravel-plan translation) — rejected:
  requires raw SQL for the row lock, which this codebase's constitution disallows outside
  reporting queries, and buys no additional safety over the conditional `updateMany` above.
- Delete-then-recreate as the "consume" step — rejected: doesn't read any better than an atomic
  update, and would lose the row (and its `expires_at`/`created_at`) needed to log which token
  was used, for no benefit.

## 2. Invalidating older tokens on a new request

**Decision**: When a new login link is requested, first `deleteMany({ where: { user_id, used_at:
null } })` for that user, then `create` the new token row.

**Rationale**: Matches FR-003 ("requesting a new link invalidates the previous one") directly and
keeps the claim-time query simple (any token row found is by definition a live, current one — no
need to also check "is this the newest one" inside the hot claim path). The tiny window between
delete and create carries no security risk: both statements run inside the same synchronous
handler invocation for a single incoming bot message, and even in the worst case of an overlap,
the old token is a still-valid-looking token for a few milliseconds, not a bypass of any check.

**Alternatives considered**: Keeping all issued tokens and only trusting the most-recently-created
one at claim time — rejected: makes the claim-time query correlated/more complex for no behavioral
difference, and leaves old tokens sitting around looking superficially valid until they naturally
expire, which is worse for auditability, not better.

## 3. Rate-limiting login-link requests

**Decision**: Before issuing a new token, look at the most recently created token for that user
(if any) and refuse a new request if it was created less than 30 seconds ago ("You just requested
a link — check Telegram for the message already sent"). This is a much shorter window than the
existing `/resetpassword` 1-per-hour throttle, because logging in is a routine, frequent action
(unlike a password reset), so the goal here is only to absorb accidental double-taps and basic
spam, not to gate a sensitive one-off action.

**Rationale**: Reuses data already being written (the token's own `created_at`) instead of adding
a new column to `users` purely for throttling — one less schema change, one less thing to keep in
sync.

**Alternatives considered**: A dedicated `last_telegram_login_request_at` column on `User`
(mirrors `last_password_reset_at`) — rejected as unnecessary duplication; the token table already
carries the timestamp this check needs.

## 4. Entry points: bot command vs. web-page trigger

**Decision**: Both entry points funnel into the exact same handler:
- Typing `/login` directly to the bot.
- Tapping a "Log in via Telegram" link on the web login page, which is a plain `https://t.me/<bot
  username>?start=login` deep link — Telegram translates that into the bot receiving
  `/start login`, handled alongside the existing `/start invite_...` / `/start relink_...`
  patterns already in `server/lib/bot.js`.

**Rationale**: This is exactly the mechanism the invite and relink flows already use in this
codebase (`bot.js`'s `inviteMatch` / `relinkMatch` regex handling of `/start <payload>`) — no new
integration pattern, no Telegram Login Widget, no bot-domain binding through BotFather. The web
page link requires no live/authenticated browser session to work, since it's a client-side
navigation to Telegram, not a server call.

**Alternatives considered**: Telegram's official Login Widget (an OAuth-like, HMAC-signed
handoff) — rejected: adds its own verification surface and a BotFather domain-binding step for no
material benefit over reusing the deep-link pattern already proven out twice in this codebase.

## 5. Session handoff after a successful click

**Decision**: `GET /auth/telegram/:token` sets `sims_token` / `sims_csrf` cookies exactly as
`POST /auth/login` does (same `authCookieOptions()` / `csrfCookieOptions()`, same JWT payload
shape), then issues an HTTP redirect to `/` (or `/login?telegram_error=<code>` on failure). No new
client-side "processing" route is needed — the SPA's existing `useCurrentUser()` hook
(`client/src/hooks/useAuth.js`) already calls `GET /users/me` on every mount and routes by role;
landing on `/` after the redirect triggers that same bootstrap path a plain page refresh would.

**Rationale**: This is a plain browser top-level navigation (the user tapped a link inside the
Telegram app/client), not a `fetch`/XHR — so a redirect response with `Set-Cookie` headers works
exactly like it does for any other server-rendered redirect-based login flow, and reuses 100% of
the app's existing "am I logged in, which dashboard" logic instead of duplicating it.

**Alternatives considered**: A dedicated client route (e.g. `/auth/telegram/callback`) that reads
a token from the URL and calls an API endpint via `fetch` — rejected: doable, but strictly more
code than reusing the redirect + existing bootstrap query, for no behavioral difference from the
user's perspective.

## 6. Token row lifecycle (no soft-delete field)

**Decision**: `telegram_login_tokens` has no `deleted_at` column. Rows persist indefinitely,
`used_at` marks consumption, and there is no cleanup/purge job.

**Rationale**: This mirrors the already-accepted `telegram_relink_tokens` table exactly (also no
soft-delete field, also just `used_at` + `created_at`) — not a new exception to Constitution §4
Data & Safety's soft-delete rule, just consistency with existing precedent for this exact class of
ephemeral, low-volume, self-superseding token table. Volume is trivial at this system's scale
(~20–30 users per department instance), so unbounded row growth is a non-issue.

**Alternatives considered**: A scheduled cleanup cron for expired/used tokens — rejected as
premature; `telegram_relink_tokens` has run without one and hasn't needed it.
