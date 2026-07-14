# Handoff Report

## task_id
015-telegram-engagement-features / Daily duty digest + inline menu buttons (steps 1-2 of a multi-step batch — see open_questions)

## status
partial

## completed
- **Inline menu buttons** (step 2, done after the digest below): `/menu` command in `server/lib/bot.js` sends an inline keyboard with three `callback_data` buttons — **My Duty Slots**, **Next Duty**, **Scheduling Window Status** — chosen over a Reply Keyboard because only inline keyboards support `url`-type buttons and Reply Keyboard would echo text into chat history (both discussed and decided with the user before implementation).
  - `handleCallbackQuery` now dispatches `menu:(my_slots|next_duty|window_status)` in addition to the existing `rr:(approved|declined):<id>` pattern, via new `handleMenuCallback`.
  - Each tap: verifies the tapper has an active linked account (mirrors the existing `rr:` lookup, not refactored into a shared helper — kept as parallel, near-identical inline checks rather than a premature abstraction), immediately acks the callback (stops the spinner), then sends a *fresh message* with the actual answer, ending in a "Open in SIMS DMS" `url` button to `/faculty/slots`. This matches the user's explicit requested shape: "answer in Telegram message... at the end get full details... show them the login button."
  - Three read-only builder functions, each querying Prisma directly and returning formatted HTML text (no mutation, unlike Accept/Reject): `buildMySlotsReply` (this month's picked slots, date + session), `buildNextDutyReply` (earliest upcoming `scheduled` slot), `buildWindowStatusReply` (current month's `CalendarConfig` — Open/Closed, picked-count vs. `sessions_per_faculty` quota, deadline if open).
  - `calendar.controller.js` now exports `MONTH_NAMES` and `formatFriendlyDateIST` (previously module-local) so `bot.js` reuses the exact same date/month formatting already established there, rather than duplicating it.
  - Tests: `server/tests/bot.test.mjs` gained 11 cases covering all three builders' empty and populated states, and open/closed window variants. All pass.
- **Deep-link fix** (small follow-up to 013/014's scope, done first): replaced the bare `/login` links with `/faculty/slots` in the three faculty-facing Telegram messages that previously sent users to a generic login page instead of the page they actually needed:
  - `server/controllers/calendar.controller.js` — "Duty Scheduling Window Open" broadcast link changed from "Log in to pick your slots" → "Pick your slots: {appUrl}/faculty/slots".
  - `server/controllers/duty-slots.controller.js` — both "Duty Reassigned Away" and "Duty Reassigned to You" messages now link to `{appUrl}/faculty/slots` instead of `{appUrl}/login`.
- **Daily duty digest** (new feature): `server/lib/cron.js` gained `sendDailyDutyDigest()` — queries today's `scheduled` `DutySlot`s (IST calendar day via `istDayRangeUTC`), groups by faculty, and sends one consolidated Telegram message per faculty with a linked `telegram_id` (e.g. "You have duty on 2026-07-14 (Morning & Afternoon)" if they hold both sessions today), ending with a link to `/faculty/slots`. Registered as a new cron job at `0 8 * * *` Asia/Kolkata (`safeSendDailyDutyDigest` wrapper, same error-isolation pattern as the two existing jobs). Exported `sendDailyDutyDigest` for testing.
- Tests added to `server/tests/cron.test.mjs` (`describe('sendDailyDutyDigest', ...)`, 4 cases): no-slots no-op, skips faculty with no `telegram_id`, one message per faculty when two different faculty each hold a session today, and consolidates into one message when the same faculty holds both sessions today. All 4 pass.

## failed_or_blocked
- None for what was attempted. The remaining 8-item backlog (see open_questions) has not been started — not blocked, just not yet reached.

## commands_run
```
node --check server/controllers/calendar.controller.js
node --check server/controllers/duty-slots.controller.js
node --check server/lib/cron.js
node --check server/lib/bot.js
npm run test --workspace=server        # 61/65 pass — same 4 pre-existing cron.test.mjs
                                        # local-DB-unreachable autoClockOut failures as every
                                        # prior handoff in this area (dutySlot.findMany inside
                                        # markNoShowAbsent is unmocked in those pre-existing
                                        # tests); all 4 new sendDailyDutyDigest tests + all 11
                                        # new bot.test.mjs menu-builder tests pass.
npx vitest run tests/cron.test.mjs -t "sendDailyDutyDigest"   # 4/4 pass, isolated confirmation
npx vitest run tests/bot.test.mjs                             # 11/11 pass, isolated confirmation
```

## constraints_discovered
- `DutySlot.faculty_id` always reflects the *current* holder of a slot — reassignment updates it in place rather than creating a new row (see the schema comment above `DutyReassignment`, a separate append-only audit-log model). This meant the digest query needed no "skip reassigned-away slots" filtering; querying by today's date and `status: 'scheduled'` already returns only the current assignee.
- `@@unique([duty_date, session_type])` on `DutySlot` means at most 2 slots can exist system-wide for any given calendar day (one Morning, one Afternoon) — so the digest's per-faculty session list is at most `['morning', 'afternoon']`, never more, though the code doesn't hardcode that assumption.
- Real-world Morning session start is 9–10 AM (admin will configure `session_start_morning_hour` accordingly; the code default of `8` in `settings.service.js` is stale relative to actual practice) — this is why 8:00 AM IST was chosen as the digest send time, giving 1–2 hours of lead time. Digest time is a fixed cron schedule, intentionally not derived from the configurable session-start settings (mirrors how `auto_checkout`/`auto_close` are already fixed cron times, not settings-driven).

## deviations_from_constitution
- None.

## files_touched
- server/controllers/calendar.controller.js (window-open broadcast link target; exported `MONTH_NAMES`, `formatFriendlyDateIST`)
- server/controllers/duty-slots.controller.js (reassignment notification link targets, both messages)
- server/lib/cron.js (`sendDailyDutyDigest`, `safeSendDailyDutyDigest`, new cron registration, new `telegram`/`formatDateIST` imports, new export)
- server/lib/bot.js (`/menu` command, `handleMenuCallback`, `buildMySlotsReply`/`buildNextDutyReply`/`buildWindowStatusReply`, `currentMonthRangeUTC`, new `calendar.controller`/`time` imports, new exports)
- server/tests/cron.test.mjs (new `sendDailyDutyDigest` describe block, `telegram` import)
- server/tests/bot.test.mjs (new `/menu quick-status reply builders` describe block, `prisma`/`time`/`bot` imports)

## open_questions_for_owner
- Steps 1-2 of a larger, user-approved backlog are done (see project memory `telegram-feature-roadmap` for the full list). Still pending, in the user's stated priority order: the remaining 8-item list (pre-auto-checkout warning, mid-window slot-picking nudge, stale reassignment-request reminder, end-of-month recap, no-show alert, admin daily ops digest, ad-hoc broadcast command, read-acknowledgment on reassignment). A separately-proposed "deeper" batch (auto-escalation, emergency substitute broadcast, violation-threshold alerts, workload-fairness nudge, destructive-action confirmation, free-text intent bot) was explicitly rejected by the user — do not resurface those without being asked again.
- `/menu` is currently undiscoverable — nothing tells a faculty member the command exists (unlike `/start`, `/myid`, `/resetpassword`, which aren't advertised either, but this one is meant for regular ongoing use, not a one-time/rare action). Worth considering whether to mention it somewhere (e.g. the account-activation success message) — not done here since it wasn't asked for.
- Known pre-existing gap, not fixed in this step: `ProtectedRoute` doesn't preserve the intended destination when redirecting an unauthenticated user to `/login`, and `LoginPage` always routes to `/faculty/dashboard` post-login regardless of where the user was headed. So the new `/faculty/slots` deep links only skip the extra click for users who are *already* authenticated in-browser; logged-out users still land on the dashboard after signing in and have to navigate to "My Duty Slots" themselves. User has been offered a redirect-after-login fix twice and has not yet asked for it — don't implement without being asked.
- Same live-verification caveat as 013/014: this environment can't drive a real Telegram client, so the digest message was verified via unit tests + `node --check`, not by receiving an actual Telegram message. Worth a glance at the real message next time 8:00 AM IST passes with an active duty slot in production/staging.
