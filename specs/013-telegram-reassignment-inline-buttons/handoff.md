# Handoff Report

## task_id
013-telegram-reassignment-inline-buttons / Inline Accept/Reject buttons on the Faculty-Requested Reassignment Telegram notification

## status
partial

## completed
- Scoped deliberately narrow per owner instruction ("only use inline buttons for the faculty Accept/Reject on reassignment requests, don't want to burden the system or risk new errors"). No other notification types were touched, no admin-facing buttons were added.
- **`server/lib/telegram.js`**: `sendMessage(chatId, text, options)` now accepts an optional third argument merged into the Telegram API payload (used for `reply_markup`); existing 2-arg call sites are unaffected. Added `answerCallbackQuery(callbackQueryId, options)` and `editMessageReplyMarkup(chatId, messageId, replyMarkup)`.
- **`server/controllers/duty-reassignment-requests.controller.js`**: extracted the entire body of `respondToRequest` (the approve/decline transaction, eligibility re-check, both Telegram notifications) into a new exported `respondToRequestCore({ id, respondedById, status })` that returns `{ ok, data }` or `{ ok: false, httpStatus, code, message }` instead of touching `req`/`res`. `respondToRequest` is now a 6-line wrapper around it. This means the HTTP PATCH endpoint and the new Telegram buttons run the *identical* authorization/eligibility/DB logic — they cannot drift apart.
- `createRequest`'s notification to the target faculty now includes an inline keyboard: `✅ Accept` (`callback_data: rr:approved:<requestId>`) and `❌ Reject` (`callback_data: rr:declined:<requestId>`).
- **`server/lib/bot.js`**: `handleWebhook` now checks `req.body.callback_query` first and routes to a new `handleCallbackQuery`. That function:
  - Parses `rr:(approved|declined):<uuid>` from `callback_data`; anything else just gets `answerCallbackQuery` (no-op ack) so the button doesn't spin forever.
  - Looks up the tapping Telegram user via `telegram_id` (must be linked, active, not deleted) — otherwise shows a `show_alert` toast, no DB call.
  - Calls `respondToRequestCore` with that user's id.
  - On success: toast confirmation, then strips the inline keyboard via `editMessageReplyMarkup` so it can't be tapped again.
  - On `NOT_FOUND`/`CONFLICT` (already responded elsewhere, e.g. via the app, or a stale/double-tapped button): shows the error as a toast **and** strips the keyboard, since the request is no longer actionable either way.
  - On `FORBIDDEN` (shouldn't be reachable in practice since `to_faculty_id` is baked into the callback data, but defensive): shows the error toast and leaves the keyboard alone.
  - Any unexpected exception: caught, logged, generic toast telling the user to respond in the app instead — the webhook still returns 200 so Telegram doesn't retry-storm it.
- `CONSTITUTION.md` bumped to v3.11 — one clause added under §4 Notifications documenting the inline buttons and that they're the only notification type with them, by design.
- Verified: `node --check` on all three edited files; a `require()` smoke test for `lib/bot.js`, the controller, and `lib/telegram.js` together (checked for circular-require issues — none, `bot.js` → controller → `prisma`/`logger`/`telegram`/`time`, no cycle back). `npm run test --workspace=server`: 50/54 pass — the 4 failures are the same pre-existing local-DB-unreachable `cron.test.mjs` failures noted in the 006 handoff (no new regressions; no existing test exercises `handleWebhook` or the reassignment controller directly).

## failed_or_blocked
- **No live Telegram verification was performed.** This environment has no way to drive a real Telegram client tapping a real inline button against a real bot webhook — everything above was verified at the code level (syntax, module loading, existing automated tests) but not end-to-end. Before relying on this in production, the owner should: send a real reassignment request between two linked faculty Telegram accounts, tap Accept on one, confirm the duty transfers and the keyboard clears; repeat for Reject; and try tapping a button a second time (or after responding via the app) to confirm the "already responded" toast + keyboard-clear path works as designed.

## commands_run
```
node --check server/lib/telegram.js
node --check server/lib/bot.js
node --check server/controllers/duty-reassignment-requests.controller.js
node -e "require('./lib/bot.js'); require('./controllers/duty-reassignment-requests.controller.js'); require('./lib/telegram.js');"   # from server/, circular-require smoke test
npm run test --workspace=server   # 50/54 pass, 4 pre-existing cron.test.mjs failures (local DB unreachable), no new regressions
```

## constraints_discovered
- `server/lib/bot.js` already has its *own* internal `sendTelegramMessage` (fetch-based) separate from `server/lib/telegram.js` (axios-based, used by controllers) — pre-existing duplication, not touched here. `bot.js` now additionally requires `lib/telegram.js` for the two new helpers (`answerCallbackQuery`, `editMessageReplyMarkup`), so the file uses both HTTP clients side by side. Left as-is to avoid risk in an unrelated area; worth unifying in a future cleanup pass if this bugs anyone.
- Telegram's `callback_data` has a 64-byte limit; `rr:approved:<uuid>` / `rr:declined:<uuid>` come to ~48 bytes with the `DutyReassignmentRequest.id` being a standard 36-char UUID, comfortably under the limit.
- `answerCallbackQuery` must be called on every code path or the tapped button shows an infinite loading spinner on the user's device — this shaped the try/catch structure in `handleCallbackQuery` (every branch, including the generic-exception catch, ends in an `answerCallbackQuery` call).

## deviations_from_constitution
- None. The one behavioral addition (inline buttons) is now documented in CONSTITUTION.md v3.11.

## files_touched
- server/lib/telegram.js (added `options` param to `sendMessage`, added `answerCallbackQuery`, `editMessageReplyMarkup`)
- server/controllers/duty-reassignment-requests.controller.js (extracted `respondToRequestCore`, added inline keyboard to the new-request notification, exported the core function)
- server/lib/bot.js (added `callback_query` branch to `handleWebhook`, added `handleCallbackQuery`)
- CONSTITUTION.md (v3.10 → v3.11)

## open_questions_for_owner
- Live end-to-end verification (see `failed_or_blocked`) still needs to happen against a real Telegram bot before this is considered production-ready.
- Currently if a faculty member has two reassignment requests pending in Telegram at once and responds to the older one via the app, the newer button-bearing message for that *same* request (there's only ever one per request, so this isn't actually reachable) isn't a concern — but if you ever add a "resend notification" feature, note it would create a second message with working buttons for the same request, and only one of the two Telegram messages would get its keyboard cleared on response (the one the user didn't tap). Not a problem today since no resend feature exists.
