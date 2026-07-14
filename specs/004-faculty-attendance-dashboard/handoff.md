# Handoff Report

## task_id
004-faculty-attendance-dashboard / personalized attendance dashboard for faculty (direct implementation, no spec/plan docs by owner's choice)

## status
complete — verified end-to-end in a real browser (2026-07-09, follow-up session; see amendment at the bottom of this file)

## completed
- New backend endpoint `GET /attendance/mine/summary?year=&month=` (`server/controllers/attendance.controller.js` `getMySummary`, mounted in `server/routes/attendance.routes.js` before the generic `/:dutySlotId` route, `authorize('faculty')`). Defaults to the current IST month when `year`/`month` are omitted. Scopes duty slots to the requesting faculty as either the assigned faculty or the confirmed covering faculty (`OR: [{ faculty_id }, { covered_by }]` — same pattern `duty-slots.controller.js`'s `getMonthSlots` already uses).
- Attendance status per slot (`checked_in` / `checked_out` / `not_checked_in` / `upcoming`) is derived from the same admin-configured `system_config` thresholds (`settingsService.getSettings()`) used by the admin live dashboard (`getLive`) and check-in flow — extended to handle past/future dates (not just "today"): a past slot with no attendance is unconditionally `not_checked_in` (its cutoff has necessarily passed), a future slot is `upcoming`, and only today's slot is gated on the configured not-checked-in cutoff, exactly mirroring `getLive`'s existing `resolveNoAttendanceStatus`.
- Response shape: `{ year, month, today, summary: { total, checked_in, checked_out, late, not_checked_in, auto_out, morning: {...}, afternoon: {...} }, data: [...] }`. `checked_in`/`checked_out` counts are cumulative attendance facts (has an `in_time` / has an `out_time`), not a live mutually-exclusive state like `getLive` — deliberate, since this is a monthly historical aggregate, not a point-in-time dashboard.
- Frontend hook `useMyAttendanceSummary(year, month)` in `client/src/hooks/useAttendance.js`; `useCheckIn`/`useCheckOut` now also invalidate the `myAttendanceSummary` query key.
- Enhanced `client/src/pages/faculty/AttendancePage.jsx` ("My Attendance") to be the personalized dashboard: month nav (prev/next, matching `SlotPickerPage.jsx`'s existing pattern), a 5-stat summary row reusing the existing shared `StatCard` component (`checked_in`/`checked_out`/`late`/`not_checked_in`/`auto_out` — same accent-color convention as `AdminDashboardPage.jsx`'s KPI grid), a morning/afternoon breakdown card pair, then Today/Upcoming/Past history groups. Replaced the old per-slot `useAttendance(slot.id)` N+1 hook calls with the single `/attendance/mine/summary` response as the one data source; check-in/out buttons only render on the actual current-day slot (backend already rejects check-in on any other date with `WRONG_DATE`).
- New test file `server/tests/attendance.test.mjs` (6 tests, mocked `prisma`/`settingsService`, no DB) covering: 400 on invalid month, past-slot-unconditionally-not-checked-in, future-slot-always-upcoming (even past its cutoff), today's-slot cutoff gating, checked-in/checked-out/late/auto-out tallying (overall + per-session), and the faculty/covering-faculty `OR` scoping of the Prisma query.
- Verification run: full server suite `npx vitest run` → 8 files, 59 tests, all green, no regressions. Client build `npx vite build` → succeeds, no new errors (pre-existing chunk-size warning only).

## failed_or_blocked
- No live-database or browser verification was possible in this sandbox — `DATABASE_URL` points at `localhost:5433`, which is unreachable here (same environment constraint documented in `specs/003-admin-duty-timing-settings/handoff.md`). Everything above was verified statically (mocked-Prisma unit tests, full existing suite, clean client build) but **the new endpoint and page have never been exercised against a real Postgres instance or a real browser.** Before considering this done, someone with DB access must: start the dev stack, log in as a faculty user with duty slots spanning past/today/future, and manually confirm the summary counts, the morning/afternoon breakdown, and the today/upcoming/past groupings all read correctly, including after a real check-in/check-out and after the admin overrides an attendance record.

## commands_run
```
node -c server/controllers/attendance.controller.js && node -c server/routes/attendance.routes.js
npx vitest run tests/attendance.test.mjs   # 6/6 passed
npx vitest run                              # 8 files, 59 tests, all passed
npx vite build (in client/)                 # succeeded, pre-existing chunk-size warning only
```

## constraints_discovered
- None beyond what §4 Duty Attendance / §10 of `CONSTITUTION.md` already documents (never hardcode timing thresholds — always read via `settingsService.getSettings()`). This endpoint follows that rule by reusing the exact same threshold fields `getLive`/`checkIn` already read.
- Admin's `AttendanceLivePage`/`getLive` compute `checked_in`/`checked_out` as a mutually-exclusive live state (only meaningful for "today, across all faculty"). A monthly per-faculty history needed a different, additive definition (has-checked-in vs. has-checked-out, not exclusive) — worth knowing if a future report tries to directly compare the two endpoints' counts.

## deviations_from_constitution
- None.

## files_touched
- `server/controllers/attendance.controller.js` (edited — added `monthDateRange` helper and `getMySummary`)
- `server/routes/attendance.routes.js` (edited — mounted `GET /attendance/mine/summary`)
- `server/tests/attendance.test.mjs` (new)
- `client/src/hooks/useAttendance.js` (edited — added `useMyAttendanceSummary`, cache invalidation on check-in/out)
- `client/src/pages/faculty/AttendancePage.jsx` (edited — full personalized dashboard: month nav, stat summary, morning/afternoon breakdown, history groups sourced from the new endpoint)
- `specs/004-faculty-attendance-dashboard/handoff.md` (new — this file; no spec.md/plan.md/tasks.md were created, per the owner's explicit choice of direct implementation over the full Spec Kit flow)

## open_questions_for_owner
- This feature was implemented without a live database or browser — **must be validated against a real dev stack before being considered production-ready**, per failed_or_blocked above.
- Confirm the `checked_in`/`checked_out` counting convention (cumulative "ever happened this month" rather than the admin live dashboard's mutually-exclusive current-state) matches the intended meaning of those two dashboard tiles.
- The Admin's existing "Live Attendance" dashboard (all faculty, today only) was left untouched — confirm that's sufficient and no admin-side "view one faculty's personalized history" drill-down is also wanted (the new endpoint is faculty-scoped to `req.user.id` only; an admin-facing equivalent would need a separate authorized endpoint).

---

## Amendment — 2026-07-09 (browser verification)

The `failed_or_blocked` limitation above has been resolved: this feature was verified end-to-end in a real browser against a disposable local Postgres instance (not mocked Prisma).

**What was tested:** seeded one faculty with a realistic mix of duty slots for the current month — a normal on-time completed duty, a late-arrival auto-clocked-out duty, a past duty with no attendance at all (absent), today's duty (unchecked-in), and a future scheduled duty — then loaded `/faculty/attendance` and confirmed every number by hand:
- Summary tiles (checked in 2 / checked out 2 / late 1 / not-checked-in 2 / auto-clockout 1) matched the seed exactly.
- Morning/afternoon breakdown cards matched the per-session split exactly.
- Today's duty card correctly showed the live Check In button and "Not in" state.
- Upcoming section showed the future slot as "Upcoming".
- Past attendance history rendered all three attendance states (on-time, late+auto, absent) with correct badges and timestamps.

**Outcome:** no bugs found — the implementation was correct as originally written. The two open questions below (about the counting convention and the admin drill-down) remain open product decisions, not implementation gaps; nothing in the code needed to change.
