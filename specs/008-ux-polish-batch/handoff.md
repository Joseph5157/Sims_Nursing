# Handoff Report

## task_id
008-ux-polish-batch / P21 (violation modal UX) + P25 (faculty personalized violations) + P26 items 1, 2, 5, 6, 7

## status
complete

## completed
- **P21 — Violation recording popup UX** (`client/src/components/faculty/RecordViolationModal.jsx`):
  - **Mobile bottom sheet**: the component now branches on `useMediaQuery('(max-width: 639px)')` (same breakpoint already used in `ReportsPage.jsx`) — mobile renders through the existing `BottomDrawer` (already proven in `StudentDetailsDrawer`/`UploadStudentsDrawer`/`ReportsPage`: rounded top corners, drag handle, sticky header/footer, capped height), desktop keeps the original `FormModal`. This fixes the literal bug (`FormModal`'s `fullScreen={isMobile}` made the popup take over the entire screen).
  - **Keyboard-aware search dropdown**: added a `visualViewport`-based effect that tracks on-screen-keyboard inset and constrains the student-search results dropdown's max-height dynamically (was a fixed `max-h-44`), plus `scrollIntoView` on input focus.
  - Confirmed already-correct and left untouched: multi-criteria search (name + reg. number), desktop sectioned layout, sticky header/footer, toast success/error, quick-add mode reset behavior.
  - Noted, not acted on: the source doc `SIMS_DMS_Problems_21-...md` had a stray trailing sentence ("check my railway cli...") that reads like injected/unrelated text — flagged to the project owner earlier in this session, not treated as an instruction.
- **P26 item 1 / P21 item 3 — Fine amount lock** (same file): the previously-editable `TextInput` for fine amount is now a read-only display (`₹{amount}` + "Default fine for {type} — set by Admin in Violation Types" caption), shown only once a violation type is selected. Verified live in browser — selecting "Uniform Violation" shows a locked "₹50" display, no input field.
- **P25 — Faculty "My Violations" dashboard section**:
  - Backend already correct (`GET /violations/my` filters `where.faculty_id = req.user.id` — confirmed pre-existing, no change needed).
  - New component `client/src/components/faculty/MyViolationsSummary.jsx`: 4 `StatCard`s (Total Recorded, Students Reported [unique], Most Common type, This Month) computed client-side from a dedicated `useMyViolations({ limit: 100 })` call (separate from the dashboard's existing `{limit:5}` call used for the "Recent activity" feed), plus a table (student/type/date/fine/status) reusing the existing `Table`/`Th`/`Td` primitives.
  - Wired into `client/src/pages/faculty/DashboardPage.jsx` as a new "My violations" section.
  - Verified live in browser with a seeded flagged violation: cards showed exactly 1/1/"Uniform Violation"/1, table row matched seeded data (Test Student One, Uniform Violation, 9 Jul, ₹50, Recorded).
- **P26 item 2 — Flagged violations resolve without leaving the dashboard**:
  - Exported the existing `ResolveFlagModal` from `client/src/pages/admin/ViolationsPage.jsx` (was already built there, just not reusable) and imported it into `AdminDashboardPage.jsx`.
  - Added a per-row "Review →" button inside the dashboard's flagged-violations modal; clicking it opens `ResolveFlagModal` on top (nested dialog), reusing the existing `useResolveFlag` mutation.
  - Extended `useResolveFlag`'s `onSuccess` (in `client/src/hooks/useViolations.js`) to also invalidate `['report', 'flagged-violations']` (the query key backing the dashboard's flagged list/count) — without this the dashboard wouldn't reflect the resolve without a manual page refresh.
  - **Verified live end-to-end**: resolved a seeded flagged violation from the dashboard modal (never navigated to `/admin/violations`) — the "FLAGGED" stat card dropped from 1 → 0 immediately and the modal's list updated to "No flagged violations." live.
- **P26 item 5 — Calendar legend cleanup** (`client/src/pages/admin/CalendarPage.jsx`): collapsed the 3-line legend (Red/Green/Default) to a single "Red — Blocked Date" line; removed the redundant helper caption above the blocked-dates grid. Verified live in browser.
- **P26 item 6 — Remove unpick functionality entirely**:
  - Frontend: removed the Unpick buttons, confirmation modal, `unpickTarget`/`unpicking` state, and `useUnpickSlot` import from `client/src/pages/faculty/SlotPickerPage.jsx`; replaced the "Unpick a slot to choose a different one" helper text with guidance pointing to Admin/Request Reassignment.
  - Deleted `useUnpickSlot` from `client/src/hooks/useDutySlots.js`.
  - Backend: deleted `unpickSlot` from `server/controllers/duty-slots.controller.js` (and its export) and the `DELETE /duty-slots/:id/unpick` route from `server/routes/duty-slots.routes.js`.
  - Confirmed no test files referenced `unpick` — no test updates needed.
- **P26 item 7 — Calendar 30s polling** (`client/src/hooks/useDutySlots.js`): added `refetchInterval: 30_000` to `useAvailableSlots` and `useMonthSlots`, matching the app-wide "30-second polling, no WebSockets/SSE" convention already established in CONSTITUTION.md — so a different faculty member's calendar now picks up new bookings without a manual refresh.
- **CONSTITUTION.md updated to v3.8**: §3 (Faculty permission bullet — picks are final, no self-unpick), §6 (Duty Slots endpoint count 8→7, total 105→104, explanatory prose), version changelog.
- **Verified end-to-end in a real browser against a migrated database, not just build/typecheck**:
  - Reused the disposable local Postgres 18 verification instance (port 5433), applied all 21 migrations cleanly (including spec 007's), seeded a Super Admin plus a test faculty account, a violation type, a student, a today-dated duty slot, and a pre-flagged violation via a one-off script.
  - Logged in as faculty in a real mobile-emulated viewport (390×844, via Chrome DevTools MCP's `emulate` — window-resize alone didn't affect the rendered viewport in this harness, device emulation was needed): confirmed the "My Violations" section renders correct live data, and the Record Student Violation modal renders as a proper bottom sheet (rounded top corners, drag handle, background dimmed-but-visible above, sticky footer) instead of the old fullscreen takeover. Typed into the student search field and confirmed the dropdown renders correctly.
  - Logged in as Super Admin at desktop viewport: confirmed the live attendance dashboard shows "Not in" immediately (P26 item 4, carried over from spec 007, still correct), opened the flagged-violations dashboard modal, clicked "Review →", resolved the flag, and confirmed the stat card and modal list updated live without navigation.
  - Confirmed the Duty Calendar page's legend is now a single line.
  - `npm run build --workspace=client` — clean, multiple times across the session.
  - `npm run test --workspace=server` — 50/54 passing; same 4 pre-existing `cron.test.mjs` DB-unreachable failures as the spec 007 baseline, no new regressions.

## failed_or_blocked
- None.

## commands_run
```
npm run build --workspace=client          # clean, multiple times
npm run test --workspace=server           # 50/54 pass (4 pre-existing cron.test.mjs failures)

# Verification environment (throwaway, torn down after):
pg_ctl -D <tmp>/pgdata-verify -o "-p 5433" start
psql -c "DROP DATABASE IF EXISTS sims_dms_verify; CREATE DATABASE sims_dms_verify;"
npx prisma migrate deploy                 # 21 migrations applied clean
npm run seed                              # bootstrap super admin
node server/seed-spec008-verify-tmp.js    # faculty + violation type + student + slot + flagged violation (deleted after)
npm run dev                               # server :3000, client :5173
# ... manual browser verification (mobile-emulated + desktop) via chrome-devtools MCP ...
pg_ctl -D <tmp>/pgdata-verify stop
```

## constraints_discovered
- **`mcp__claude-in-chrome__resize_window` / `mcp__chrome-devtools__resize_page` did not change the rendered viewport** in this environment (screenshots stayed at the original window size despite a "successfully resized" response). Real mobile-viewport testing required `mcp__chrome-devtools__emulate` with a `viewport` string (e.g. `390x844x2,mobile,touch`), which correctly triggers Mantine's `useMediaQuery` breakpoint and CSS media queries. Worth remembering for any future mobile-UI verification in this harness.
- Confirms the pattern already noted in the 007 handoff: `server/.env` and root `.env` are separate files and both need updating for local DB-swap verification.

## deviations_from_constitution
- None beyond what's already itemized in `completed` above (all changes were within the batch's intended scope; the `useResolveFlag` invalidation extension and the `ResolveFlagModal` export are both small enabling changes for the explicitly-requested P26 item 2, not scope creep).

## files_touched
- `client/src/components/faculty/RecordViolationModal.jsx` (mobile bottom sheet, keyboard-aware dropdown, fine lock)
- `client/src/components/faculty/MyViolationsSummary.jsx` (new)
- `client/src/pages/faculty/DashboardPage.jsx` (added My Violations section)
- `client/src/pages/admin/ViolationsPage.jsx` (exported `ResolveFlagModal`)
- `client/src/pages/admin/AdminDashboardPage.jsx` (Review button + `ResolveFlagModal` wiring)
- `client/src/hooks/useViolations.js` (`useResolveFlag` invalidation extended)
- `client/src/pages/admin/CalendarPage.jsx` (legend simplified)
- `client/src/pages/faculty/SlotPickerPage.jsx` (unpick UI removed)
- `client/src/hooks/useDutySlots.js` (`useUnpickSlot` removed, `refetchInterval: 30_000` added to two hooks)
- `server/controllers/duty-slots.controller.js` (`unpickSlot` removed)
- `server/routes/duty-slots.routes.js` (unpick route removed)
- `CONSTITUTION.md` (v3.8)

## open_questions_for_owner
- None for this spec.
- Carried over, unaffected: `SIMS_Database_Schema_v2.1.md` / `SIMS_API_Endpoints_v2.0.md` remain stale (already flagged before this batch; this spec's endpoint-count change makes them further stale, consistent with how they were already being left).
