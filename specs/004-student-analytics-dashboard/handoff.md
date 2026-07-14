# Handoff Report: P24 Student Discipline Analytics Dashboard

## task_id
004-student-analytics-dashboard / Task 11 — P24 Backend + Frontend (Phase 1: Critical)

## status
complete — all 3 phases built (Phase 1 verified in browser; Phases 2–3 built + build-clean, browser verification pending per owner's "build first, verify later"). See the "Phases 2–3" amendment at the bottom.

## completed
- **Backend**: `server/controllers/analytics.controller.js` (new) with 5 endpoints, all admin/super_admin only:
  - `GET /analytics/summary` — total violations, unique students affected, repeat-violators count (>threshold, default 3), most-common violation type
  - `GET /analytics/trend` — violation counts per month, trailing N months (default 6) — built as part of Phase 1 endpoint grouping per the prior handoff's plan, **not yet wired to any frontend chart** (see open questions)
  - `GET /analytics/violation-types` — counts per type for the bar chart, dynamic (reads from `violation_types` table, never hardcoded)
  - `GET /analytics/repeat-violators` — students above threshold with their most frequent violation type ("main issue"), sorted descending
  - `GET /analytics/filter-options` — dynamic dropdown sources: distinct courses/years/academic_years from `students`, active `violation_types`
  - All endpoints share a `range` filter (`this_week` / `this_month` / `last_month` / `custom` with `from_date`/`to_date`) plus `course`, `year`, `academic_year`, `violation_type_id`.
  - `server/routes/analytics.routes.js` (new), `server/schemas/analytics.schema.js` (new, Zod), mounted at `/analytics` in `server/index.js`.
- **Frontend**: `client/src/hooks/useAnalytics.js` (new, TanStack Query hooks). `client/src/pages/admin/ViolationsPage.jsx` rewritten — added a `DisciplineAnalytics` component above the existing record table:
  - 4 summary `StatCard`s (Total Violations, Students Affected, Repeat Violators, Most Common)
  - Filter row: date range preset + custom date pickers, course/year/academic-year/violation-type selects (all populated from `/analytics/filter-options`)
  - Violation Type Breakdown — lightweight CSS/Tailwind bar chart (no new charting library added; see deviations)
  - Students Requiring Counselling table (repeat violators, sorted by count)
  - The original record-level table (search/hide/resolve-flag/audit-log actions) is preserved unchanged below, under an "All Records" heading.
- **`client/src/components/StudentDetailsDrawer.jsx`** updated per P24 §8 (Individual Student Violation Profile): removed Phone/Gender rows, added a "Violation Summary" section (total + per-type breakdown), renamed "Recent student violations" → "Complete Violation History" and raised the fetch limit from 10 to 100 (the API caps at 100 per request; no pagination added at this cap since no real student currently approaches it).
- **Verified end-to-end in a real browser**, not just build/typecheck:
  - Spun up a disposable local Postgres 18 instance (data dir in scratchpad, port 5433), ran all 19 migrations clean, ran `npm run seed` (bootstrap super admin) + a one-off test-data script (15 students across 3 courses/4 years, 4 violation types, 36 violations with deliberate repeat-offender counts).
  - Logged in as Super Admin, navigated to `/admin/violations`, confirmed all 4 summary cards, the bar chart, and the repeat-violators table showed numbers that hand-matched the seeded data exactly (36 total / 15 students / 4 repeat violators / Uniform Violation 17 cases).
  - Applied the Course filter (Pharm.D) live and confirmed all four cards + the bar chart recomputed correctly (12 / 5 / 1 / 6 cases) — filter logic is correct, not just rendering.
  - Found and fixed a real bug this way: the repeat-violators table's "Count" and "Main Issue" columns had no padding between them (rendered as `6Uniform Violation`) — added `pr-3` to the intervening columns.
  - Opened `StudentDetailsDrawer` for a seeded student and confirmed Phone/Gender are gone and the new Violation Summary breakdown sums correctly to the total (6 = 2+2+1+1).
- `npm run build --workspace=client` — clean, both before and after the padding fix.
- `node --check` on all 3 new backend files + a `require()` smoke test — all resolve cleanly.

## failed_or_blocked
- None for Phase 1.

## commands_run
```
npm run build --workspace=client          # clean, twice
npm run test --workspace=server           # 48/53 pass; 5 failures are pre-existing local-DB-unreachable
                                           # issues (cron.test.mjs hitting a real DB), unrelated to this change
node --check server/controllers/analytics.controller.js
node --check server/routes/analytics.routes.js
node --check server/schemas/analytics.schema.js
# Local verification environment (throwaway, torn down after):
initdb / pg_ctl start -o "-p 5433"        # fresh local Postgres 18
npm run migrate:deploy                    # 19 migrations applied clean
npm run seed                              # bootstrap super admin
node <scratchpad>/seed-test-data.js       # 15 students, 4 violation types, 36 violations
npm run dev                               # server :3000, client :5174
pg_ctl stop                               # torn down after verification
```

## constraints_discovered
- Prisma client generates into `server/node_modules/@prisma/client` (per `output` in `prisma/schema.prisma`), not the repo root — any standalone script using `@prisma/client` must live under `server/` (or its own node_modules must resolve there) or it throws `Cannot find module '.prisma/client/default'`.
- A hard browser reload (full navigation, not client-side routing) immediately after the forced `must_change_password` flow intermittently bounced back to `/change-password` even though the DB already had `must_change_password=false` for that user — re-logging in via the normal `/login` form resolved it immediately. Not investigated further since it's pre-existing auth/session behavior unrelated to this feature; flagging in case it recurs elsewhere.
- `GET /violations` caps `limit` at 100 server-side (`Math.min(100, ...)` in `violations.controller.js`) — `StudentDetailsDrawer`'s "complete" history is complete up to 100 records per student, not unbounded. Fine at current data volumes (repeat-violator threshold is 3; no seeded or real student is near 100).

## deviations_from_constitution
- None. No new database tables/columns were added — this feature only reads existing `violations`/`students`/`violation_types` data through new aggregation endpoints.
- No new frontend dependency was added for charts (constitution's tech stack table doesn't list a charting library). The Violation Type Breakdown bar chart is implemented as plain Tailwind divs matching the ASCII-bar style shown in the original problem spec (`SIMS_DMS_Problems_24-...md`), not a chart library. If Phase 2 (trend line graph, adopted for later) needs a real line chart, a charting library decision (`@mantine/charts` recommended, matches the existing Mantine theme) will be needed then — flagged as an open question below rather than decided unilaterally.

## files_touched
- server/controllers/analytics.controller.js (new)
- server/routes/analytics.routes.js (new)
- server/schemas/analytics.schema.js (new)
- server/index.js (mounted `/analytics`)
- client/src/hooks/useAnalytics.js (new)
- client/src/pages/admin/ViolationsPage.jsx (added `DisciplineAnalytics` dashboard section)
- client/src/components/StudentDetailsDrawer.jsx (removed phone/gender, added violation summary, full history)
- DEPLOYMENT_TROUBLESHOOTING.md (new, unrelated to P24 — captures two Railway deploy incidents fixed in this session; see project root)

## open_questions_for_owner
- **Scope for Phase 2/3** (P24 problem doc): trend line graph, course-wise/year-wise bar charts, individual-student popup (partially done via `StudentDetailsDrawer`, already updated), faculty recording analysis, calendar heatmap, Excel/PDF export. The backend `trend` endpoint is already built (see completed) but has no frontend chart yet. Confirm whether to proceed with Phase 2 next, and whether to adopt `@mantine/charts` at that point for the line/heatmap visuals (Phase 1's bar chart didn't need it).
- The `StudentDetailsDrawer` "Complete Violation History" is capped at 100 records per student (existing API limit) — fine today, but if any student's violation count could realistically approach that, this will silently truncate. No action needed now.

---

## Amendment — 2026-07-09 — Phases 2 & 3 built

**Phase 2 (High)** — added to the dashboard:
- `GET /analytics/course-analysis`, `GET /analytics/year-analysis` (new backend endpoints; both aggregate in JS since `course`/`year` live on Student, not Violation).
- Frontend: adopted `@mantine/charts` (+ `recharts` peer) — a real charting dep, matching the existing Mantine theme (see deviations). Added a **Violation Trend** line chart (wires up the previously-unused `/analytics/trend`), plus **Violations by Course** and **Violations by Year** bar charts.
- Individual student profile (spec §8) was already delivered in Phase 1 via `StudentDetailsDrawer`.

**Phase 3 (Medium)** — added to the dashboard:
- `GET /analytics/faculty-analysis` (violations per recording faculty; groupBy since `faculty_id` is on Violation), `GET /analytics/heatmap` (violation counts per IST calendar day, bucketed in JS), `GET /analytics/export/counselling` (repeat-violators list as .xlsx via the existing `lib/excel` helper — no fine amounts, matching the reports export).
- Frontend: **Recorded By (Faculty)** horizontal bar list, a **Violation Heatmap** (GitHub-contribution-style calendar grid, green→red, no charting dep), and an **⬇ Excel** button on the counselling table.
- `computeRepeatViolators` was extracted so the JSON endpoint and the Excel export share one implementation.

Analytics module is now **10 endpoints** (was 5). CONSTITUTION.md §6 updated (v3.6), total 100→105.

**Verification status:** `npm run build --workspace=client` clean; backend `node --check` + full `require()` load clean. Browser verification of the Phase 2/3 UI is still pending (owner asked to build the remaining phases first and verify together afterward). When verifying, seed multi-month violation data to exercise the trend line (all current seed data lands in one month, so the trend shows a single spike — correct, but not a rich curve).

## deviations_from_constitution (Phase 2 addition)
- **Added `@mantine/charts` + `recharts`** as new client dependencies. The constitution's tech-stack table (§2) lists Tailwind + Mantine but no charting library; Phase 1's bars were plain CSS. This was the pre-flagged open question from the Phase 1 handoff ("if Phase 2 needs a real line chart, a charting library decision will be needed") — resolved in favour of `@mantine/charts` because it renders through the same `mantineTheme` tokens already in `App.jsx`, so charts inherit the brand palette with zero extra theming. A `form-data` high-severity advisory pulled in transitively was resolved with `npm audit fix` (0 vulnerabilities after). If the owner prefers no charting dep, the three Recharts-based charts (trend line, course bar, year bar) would need reverting to CSS bars; the heatmap already uses no dep.
