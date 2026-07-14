# Phase 1 Data Model: Telegram Magic-Link Login

## New Entity: `TelegramLoginToken`

Mirrors the shape of the existing `TelegramRelinkToken` model, minus a `created_by` (this token is
self-issued by the user via the bot, not created on their behalf by an admin).

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (UUID, PK, `@default(uuid())`) | Standard UUID PK per Constitution §4 Data & Safety. |
| `user_id` | `String` (FK → `users.id`) | The account this login token authenticates. |
| `token` | `String` (`@unique`, `@db.VarChar(100)`) | Cryptographically random, unguessable (e.g. `crypto.randomBytes(32).toString('hex')`). Never logged in full. |
| `expires_at` | `DateTime` | Set to `now() + 10 minutes` at creation. |
| `used_at` | `DateTime?` | Null until claimed; set atomically on successful login (see `research.md` §1). Doubles as the "already used" signal — no separate boolean needed. |
| `created_at` | `DateTime` (`@default(now())`) | Also used as the natural rate-limit signal (see `research.md` §3). |

No `updated_at`: consistent with `telegram_relink_tokens`, which also omits it despite `used_at`
being a post-creation mutation — the table isn't tracking a general "last modified" concept, just
one specific transition.

No `deleted_at`: see `research.md` §6 — mirrors `telegram_relink_tokens`, not a new exception.

```prisma
model TelegramLoginToken {
  id         String    @id @default(uuid())
  user_id    String
  token      String    @unique @db.VarChar(100)
  expires_at DateTime
  used_at    DateTime?
  created_at DateTime  @default(now())

  user User @relation("TelegramLoginTokens", fields: [user_id], references: [id])

  @@index([user_id])
  @@map("telegram_login_tokens")
}
```

`User` gains one back-relation (`telegramLoginTokens TelegramLoginToken[] @relation("TelegramLoginTokens")`)
and no new scalar columns — `telegram_id`, `telegram_verified`, `status`, and `deleted_at` already
carry everything the claim check needs (see FR-006/FR-008).

## Reused Entities (no schema change)

- **`User`**: the account being authenticated. Existing fields fully sufficient:
  `telegram_id` / `telegram_verified` (gate for who may request a link), `status` / `deleted_at`
  (gate for who may complete a login), `session_version` (embedded in the issued JWT exactly as
  password login does today).
- **`AdminAuditLog`** (via `services/audit.service.js` `logAction()`): each successful
  Telegram-link login writes one entry with `action: 'TELEGRAM_LOGIN'`, `target_type: 'user'`,
  `target_id: user.id` — the same table and helper `PASSWORD_LOGIN` already uses, just a
  different `action` string, satisfying FR-011 without a new table.

## State Transitions

```
[created]  --(claimed successfully)-->  [used]   (used_at set; token can never be claimed again)
[created]  --(10 min elapses)-->        [expired] (claim attempts rejected; row untouched)
[created]  --(user requests a new one)--> [deleted] (superseded, removed by deleteMany before the new row is created)
```

A token is only ever in exactly one of these states at a time; there is no path back to
"claimable" from any of them.
