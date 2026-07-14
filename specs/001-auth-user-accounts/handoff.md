# Handoff Report

## task_id
001-auth-user-accounts / flaky-login fix + faculty/admin duplicate-feature cleanup (2026-07-14)

## status
complete

## completed

### Part 1 — Login flakiness ("have to try 5 times / refresh to log in")
Three stacked defects, all fixed:
1. **Audit-log failure failed a successful login.** `POST /auth/login` set cookies, then
   `await logAction(...)` — a transient audit-insert error returned 503 to an already-logged-in
   user. Audit logging in `login`/`changePassword` is now non-fatal (try/catch + warn).
2. **Stale-cookie CSRF dead-lock on login.** CSRF middleware enforced the double-submit check
   on `POST /auth/login` whenever any `sims_token` cookie existed. A stale/revoked httpOnly
   token + missing `sims_csrf` → permanent 403; the old client "clear cookies and retry" hack
   couldn't delete the httpOnly cookie and deleted the good CSRF cookie instead, making it
   worse; LoginPage mislabeled the 403 as "Invalid email or password". Fixed: `/auth/login`
   exempt from CSRF; `authenticate` middleware clears both cookies on every 401 so sessions
   self-heal; client retry hack removed.
3. **Service worker served stale identity.** Workbox NetworkFirst cached `/auth` and
   `/users/me` for 5 min — slow Wi-Fi could serve a previous user's cached identity.
   `/auth/*` and `/users/me` excluded from the SW cache; `useLogin` now also purges the
   `sims-api` cache on login success (previously logout-only).
- LoginPage error mapping fixed (network / 401 / 429 / 5xx each show accurate text).
- Added CSRF regression test; repaired 2 pre-existing stale `auth.test.mjs` assertions
  (pre-spec-017 response shape). Full server suite: 98/98 pass.

### Part 2 — Duplicate-feature cleanup (user reviewed each item, approved: F1, F2, F3, A2, A3)
- **F1 — Faculty bottom-tab labels now match the sidebar.** "Attend"→"Attendance",
  "Issues"→"Violations" (`Layout.jsx` `facultyBottomTabs`).
- **F2 — Check-in/out de-duplicated.** Removed the Check In/Check Out buttons + mutations
  from `AttendancePage.jsx`'s history rows (was a second, independent path to the same
  action already on the Dashboard's today-card). Today's row now shows a
  "Check in/out on Dashboard →" button that navigates to `/faculty/dashboard`; the page is
  otherwise read-only history, as its subtitle already claimed.
- **F3 — Dashboard violations no longer embeds the full violations page.**
  `MyViolationsSummary.jsx` dropped its `<MyViolationsTable />` embed (which was literally
  the same component the /faculty/violations page renders) in favor of a "View all →" link
  to `ROUTES.FACULTY_VIOLATIONS`. Stat cards (Total/Students/Most Common/This Month) stay.
- **A2 — Admin Dashboard "Active Faculty" modal removed.** It duplicated Live Attendance
  page data (same `useLiveAttendance` hook, cross-joined with faculty). The hero card now
  navigates straight to `/admin/attendance`.
- **A3 — Admin Dashboard "Reassignments" modal removed.** It duplicated the Reports page's
  duty-reassignments report (same `useDutyReassignmentReport` hook). The stat card now
  navigates to `/admin/reports`. The smaller "Recent duty reassignments" preview card
  (top-8, no modal) was left alone — it's a preview, not a duplicate page.
- **A1 — Admin Dashboard "Flagged" detail modal removed** (approved in a follow-up turn after
  a deeper look). This one was worse than A2/A3: flagged violations were surfaced in *three*
  places (hero stat card's full modal with working Mark-as-Reviewed/Delete mutations, a
  read-only "Flagged violations requiring review" preview card, and the dedicated
  `/admin/flagged-violations` page) — and the modal itself already linked out to the
  dedicated page, tacitly admitting it was redundant. Removed the modal entirely along with
  its now-orphaned state (`activeModal`, `resolvingViolation`, `deletingFlagged`) and imports
  (`Modal`, `ResolveFlagModal`, `ConfirmDialog`, `useDeleteViolation`, `useToast`). The
  "Flagged" stat card now navigates straight to `/admin/flagged-violations`, same pattern as
  A2/A3. The read-only preview card (`flaggedShowCount` selector, top-N list, "Review all →"
  link) was kept — it was already following the preview+link pattern, not a duplicate.
- Explicitly **not** touched per user's scope: F4 (shared Record-Violation modal — intentional
  quick action), F5 (dashboard's Request-Reassignment flow — only exists there, not a
  duplicate).

### Part 3 — Admin panel audit (follow-up request; B1 + B2 approved and done)
- **B1 — Flag resolution consolidated to one page.** `/admin/violations` and
  `/admin/flagged-violations` were both full flag-review workflows (ViolationsPage even owned
  the `ResolveFlagModal` that FlaggedViolationsPage imported). Now: `ResolveFlagModal` moved
  to its own file `client/src/components/admin/ResolveFlagModal.jsx` (default export);
  FlaggedViolationsPage imports it from there and is the ONLY place flags are resolved.
  ViolationsPage keeps the Flagged badge, `is_flagged` filter, and Delete (general record
  management), but its per-row "Resolve" button is now a "Review" button navigating to
  `/admin/flagged-violations`. Removed from ViolationsPage: the modal component + export,
  `resolving` state, and now-unused imports (`TextInput`, `FormModal`, `useResolveFlag`).
- **B2 — Admin naming unified** (admin version of F1):
  - ViolationsPage page title "Student Discipline Analytics" → **"Student Violations"**
    (matches sidebar + route; subtitle still mentions analytics).
  - Sidebar "Attendance" → **"Live Attendance"** (matches page title); bottom tab "Live" →
    **"Attendance"**.
  - Sidebar "Stu. Viol. Types" → **"Violation Types"**; bottom tab "Stu. Viol." →
    **"Violations"**.
- Audited and found NOT duplicated (no action): Calendar / Duty Slots / Duty Timing Settings
  (distinct concerns), Reports page (read-only report views, legitimate overlap), Users /
  Students / Violation Types / Messages, Super Admin dashboard (already preview+link pattern),
  RecordViolationModal on ViolationsPage (spec 019 admin override — intentional).

### Doc sync (same session)
- CONSTITUTION.md §4 Authentication updated: login CSRF exemption, 401-clears-cookies rule,
  best-effort audit-log rule.
- SIMS_API_Endpoints_v2.0.md: Module 1 notes + changelog entry for the 2026-07-14 login fix;
  `/auth/login` marked CSRF-exempt in the endpoint table.
- README.md deliberately NOT updated: it still describes the abandoned Telegram-OTP login
  architecture (30 references, wrong ERD/diagrams) — flagged to owner as a separate rewrite
  task rather than planting one correct fact in a wrong document.
- `client` builds clean (`vite build`) after all edits; no leftover unused imports/vars
  (verified with grep for `activeFacultyList`, `useCheckIn`/`useCheckOut`/`useToast` in the
  touched files).

## failed_or_blocked
- Nothing blocked. All changes are local/uncommitted — production still has the old
  behavior until deployed.

## commands_run
```
npx vitest run                  # server: 98/98 pass
npx vite build                  # client: builds, PWA SW regenerated (run twice, before and after Part 2 edits)
```

## constraints_discovered
- `sims_token` is httpOnly — client JS can never clear it; recovery from a bad session
  cookie MUST happen server-side (clearCookie on 401) or wait out the 7-day maxAge.
- Workbox runtimeCaching only intercepts GETs, but a cached GET `/users/me` is enough to
  corrupt perceived identity on flaky networks; keep auth/identity endpoints network-only.
- `express-rate-limit` on `/auth/login` is 50 req/15min per IP in production — the whole
  college shares one NAT IP; a morning login rush could plausibly 429 (see open questions).
- `ReportsPage.jsx` has no URL/query-param deep-linking into a specific report (`active` is
  local component state) — A3's "Reassignments" stat card links to the Reports page in
  general, not directly to the duty-reassignments report. Would need a small `?report=`
  param feature to deep-link; not built since it wasn't requested.

## deviations_from_constitution
- None.

## files_touched
- server/middleware/csrf.js — exempt POST /auth/login
- server/middleware/authenticate.js — clear session cookies on all 401 paths
- server/controllers/auth.controller.js — audit logging non-fatal in login/changePassword
- server/tests/csrf.test.mjs — new login-exemption regression test
- server/tests/auth.test.mjs — repaired 2 stale changePassword assertions
- client/src/utils/api.js — removed broken 403 clear-cookies-and-retry hack
- client/src/hooks/useAuth.js — delete sims-api SW cache on login success
- client/src/pages/auth/LoginPage.jsx — accurate error messages per status
- client/vite.config.js — exclude /auth/* and /users/me from SW api cache
- client/src/components/Layout.jsx — faculty bottom-tab label fix (F1)
- client/src/pages/faculty/AttendancePage.jsx — removed duplicate check-in/out (F2)
- client/src/components/faculty/MyViolationsSummary.jsx — removed embedded table, added link (F3)
- client/src/pages/admin/AdminDashboardPage.jsx — removed Active Faculty + Reassignments + Flagged modals (A2, A3, A1)
- client/src/components/admin/ResolveFlagModal.jsx — NEW: extracted flag-resolution modal (B1)
- client/src/pages/admin/ViolationsPage.jsx — resolve flow removed, Review→flagged-page link, retitled (B1, B2)
- client/src/pages/admin/FlaggedViolationsPage.jsx — import ResolveFlagModal from new location (B1)
- client/src/components/Layout.jsx — admin sidebar/bottom-tab label unification (B2; same file as F1)
- CONSTITUTION.md — §4 Authentication updated with login-fix rules
- SIMS_API_Endpoints_v2.0.md — Module 1 + changelog updated with login-fix

## open_questions_for_owner
- Raise the login rate limit (50/15min/IP) or key it by email+IP? Shared college NAT could
  hit it during morning check-in rush.
- Want a `?report=duty-reassignments` deep-link added to Reports so A3's stat card can jump
  straight to that report instead of the general Reports page?
