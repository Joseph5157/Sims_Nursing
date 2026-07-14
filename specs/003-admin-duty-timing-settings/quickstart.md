# Quickstart: Validating Admin Duty Timing Settings

## Prerequisites

- Local dev stack running (`server` + `client` + Postgres), migration for this feature applied (`npx prisma migrate dev`).
- One seeded Admin (or Super Admin) user and at least one Faculty user with a duty slot for today (Morning and Afternoon each, for full coverage).

## 1. View and update settings (User Story 1)

1. Log in as Admin.
2. Navigate to Duty Timing Settings (`client/src/pages/admin/DutyTimingSettingsPage.jsx`, route added in `App.jsx` under the `['admin','super_admin']` group).
3. Confirm all values shown match `GET /duty-timing-settings` (see `contracts/duty-timing-settings-api.md`).
4. Change Morning late cutoff to 9:15 AM, save.
5. Refresh the page — confirm the new value persists (`system_config` row updated, not just client state).
6. Log in as Faculty (non-admin) and confirm the settings route/page is inaccessible (403 from API if hit directly, or route-guarded in the UI).
7. Attempt to save Morning auto clock-out earlier than Morning late cutoff — confirm `422` rejection with a clear message (FR-003/SC-004).

## 2. Late-arrival flagging (User Story 2)

1. With Morning late cutoff set to 9:15 AM, check in a Faculty member's Morning slot at 9:16 AM (or adjust system clock / mock `nowInIST()` in a test) — confirm `duty_attendance.in_status = 'late'`.
2. Check in another Morning faculty member at 9:10 AM — confirm `in_status = 'normal'`.
3. Change the cutoff to 9:30 AM, then check in a third faculty member at 9:20 AM — confirm `normal`, proving the new cutoff took effect immediately without altering the two earlier attendance records already created (FR-007/SC-003).

## 3. Not-checked-in cutoff (User Story 3)

1. Set Morning not-checked-in cutoff to 9:30 AM.
2. Before 9:30 AM, call `GET /attendance/live` for a scheduled-but-not-checked-in Morning faculty member — confirm `attendance_status: "upcoming"`.
3. After 9:30 AM passes with no check-in, call `GET /attendance/live` again (or wait for the existing 30s dashboard poll) — confirm `attendance_status: "not_checked_in"`.
4. Have that faculty member check in — confirm the next poll shows `checked_in` (with `in_status` reflecting lateness), not `not_checked_in`.

## 4. Per-session auto clock-out (User Story 4)

1. Set Morning auto clock-out to 12:00 PM and Afternoon to 5:00 PM.
2. Leave a Morning-session faculty member checked in with no checkout.
3. Trigger the cron manually (`node -e "require('./server/lib/cron').autoClockOut()"` or the equivalent test harness used by `server/tests/cron.test.mjs`) at/after 12:00 PM — confirm that faculty member is clocked out with `out_status: 'auto'`, `auto_out: true`, and `out_time` set to 12:00 PM IST that day.
4. Confirm an Afternoon-session faculty member checked in without checkout is **not** clocked out by this same run (their cutoff is 5:00 PM, not yet reached).
5. Re-run after 5:00 PM — confirm the Afternoon faculty member is now clocked out too.

## 5. Regression check — existing behavior unaffected

- Confirm `cover_ttl_hours` and `/admin/settings` (Super-Admin-only) still work unchanged — this feature does not touch that endpoint or field.
- Confirm a faculty member with an Afternoon slot is unaffected by any Morning-only setting change (session isolation, FR-009).
