# SIMS Admin Panel Full Engineering Audit

*Audit-only engagement — no application files were modified. Only read-only verification
commands were run (build, lint, tests, `npm audit`, `prisma validate`). Date: 2026-07-19.
Reviewed against `CONSTITUTION.md` v3.19.*

---

## 1. Executive Summary

**Overall production-readiness rating: 7.5 / 10.**

This is a genuinely well-engineered codebase for its scale (one nursing college, ~20–30
faculty). Authentication, authorization, CSRF, per-IP + per-account rate limiting, Zod
validation on every mutating input, soft deletes, immutable audit logging, and DB-level
uniqueness/atomic-claim patterns are all present and, in most places, correct. The server test
suite passes cleanly (130 tests / 13 files), the client production build succeeds, and
`prisma validate` reports a valid schema. The system is already reported as production-live for
the Telegram-OTP feature, and nothing found here is a release-blocking defect.

The findings are concentrated in **hardening and operational polish**, not core correctness:
one high-severity dependency CVE (multer), spreadsheet formula-injection on report exports, a
timezone-boundary inconsistency in reports that depends on an env var being set, a broken client
lint gate, a few rare concurrency TOCTOU windows, and missing indexes that only bite at scale.

**Is the project ready for client submission?** Ready after a small set of mandatory fixes
(see §15). None require rewrites.

**Total findings by severity**

| Severity | Count |
|---|---|
| Blocker | 0 |
| Critical | 0 |
| High | 2 (+1 resolved 2026-07-19 — ADMIN-HIGH-003) |
| Medium | 5 (+1 resolved 2026-07-19 — ADMIN-MED-001) |
| Low | 7 |
| Informational | 6 |

**Top five risks**

1. `multer@2.1.1` carries a **High** DoS CVE (fix is a non-breaking patch bump). *(ADMIN-HIGH-001)*
2. **Excel/CSV formula injection** — student names/registration numbers from uploads are
   re-emitted into `.xlsx` exports with no `= + - @` neutralisation. *(ADMIN-HIGH-002)*
3. ~~**Report timezone correctness**~~ — ✅ **RESOLVED 2026-07-19** via a shared IST-explicit
   range utility (`lib/reportRange.js`) now used by every report + analytics endpoint, with
   boundary tests. *(ADMIN-HIGH-003)*
4. ~~**Client lint gate is red** (68 ESLint errors)~~ — ✅ **RESOLVED 2026-07-19**: 0 errors,
   config/unused/hook/purity issues all fixed directly, no hook rule disabled. *(ADMIN-MED-001)*
5. **Reassignment concurrency TOCTOU** — eligibility is checked before, not inside, the write
   transaction and the request-status update is not conditionally guarded; rare races can write
   duplicate history rows. *(ADMIN-MED-002)*

**Overall architecture assessment.** Clean monolith exactly as the constitution prescribes:
Express routes → controllers → services/lib, Prisma for all data access (raw SQL confined to two
justified `FOR UPDATE` locks and health/report reads), React + Vite + TanStack Query + Tailwind +
targeted Mantine on the client. Middleware layering (authenticate → authorize → validate) is
consistent and each route file declares its own role gates. Good separation of concerns.

**Database assessment.** Schema is coherent, UUID PKs throughout, `DECIMAL(8,2)` for money,
soft-delete columns, sensible composite uniques (`duty_slots(duty_date, session_type)`,
`calendar_config(config_month, config_year)`). Gaps: several high-traffic filter columns lack
indexes, and a handful of vestigial columns/enums remain by design. No dangerous cascade deletes.

**Security assessment.** Strong. bcrypt cost-12, httpOnly JWT + double-submit CSRF with
`timingSafeEqual`, generic auth error messages, timing-uniform OTP request path, atomic
single-winner token claims, webhook secret compared in constant time and redacted from logs, no
secrets committed. The material gaps are the multer CVE and export formula injection.

**Testing assessment.** Solid unit/integration coverage of auth, CSRF, lockout, duty slots,
reassignment requests, violations, invites, SIMS-ID allocation and cron. Notable gaps: no
automated coverage of the **reports** and **analytics** endpoints, the **student Excel
upload/reconciliation** path, or **messaging**.

---

## 2. System Architecture Overview

- **Frontend.** React 19 SPA built with Vite 8, PWA via `vite-plugin-pwa`/Workbox. State/data via
  TanStack Query with 30-second polling (no WebSockets). Styling is Tailwind v4 with Mantine kept
  only for accessible primitives/overlays. Routing via `react-router-dom` v7 with a
  `ProtectedRoute` wrapper that gates on auth, `must_change_password`, and role. Single Axios
  instance (`client/src/utils/api.js`) is the shared API client: `withCredentials`, auto-attaches
  the `X-CSRF-Token` header from the `sims_csrf` cookie on unsafe methods, and hard-redirects to
  `/login` on any 401.
- **Backend.** Node/Express monolith (`server/index.js`). Global Helmet CSP, CORS allow-list from
  `CORS_ORIGIN`, Morgan→Winston access logging with webhook-secret redaction, a high-cap global
  rate limiter (DoS backstop) plus stricter per-route limiters on auth/OTP. Bot webhook and health
  endpoints are mounted before the global limiter. Static client is served in production with an
  SPA catch-all. Process-level `unhandledRejection`/`uncaughtException` handlers.
- **Database.** PostgreSQL via Prisma 5 (client generated to `server/node_modules/@prisma/client`).
  19 models. Migrations committed under `prisma/migrations`. `migrate deploy` runs on Railway
  start.
- **Authentication model.** Email **or** 4-digit SIMS ID + bcrypt password → JWT in httpOnly
  cookie + CSRF token; alternatively Telegram magic-link (`GET /auth/telegram/:token`) or typed
  6-digit Telegram OTP (`/auth/otp/request` + `/verify`). `session_version` embedded in the JWT
  and checked every request is the forced-logout mechanism. Per-account OTP lockout (5 attempts →
  15-min cool-off) plus per-IP limiters.
- **Admin module structure.** `client/src/pages/admin/*` (Dashboard, Users, Students, Attendance
  Live, Calendar, Duty Slots, Duty Timing Settings, Violations, Violation Types, Flagged
  Violations, Reports) + `super-admin/*` (Audit Logs, dashboard). Each backed by a
  `hooks/use*.js` TanStack Query hook.
- **API communication pattern.** REST, JSON only, uniform error envelope
  `{ error, code, message }`. Cursor-less offset pagination with `meta { total, page, limit, pages }`.
- **Deployment assumptions.** Railway + Nixpacks; `npm install --omit=dev && generate && build`
  then `migrate:deploy && start`. Health check `/health`. **Requires** `TZ=Asia/Kolkata` and the
  full env set in §11 of the constitution.

---

## 3. Verification Commands and Results

| Command | Result | Important Output | Interpretation |
|---|---|---|---|
| `node --version` | ✅ | `v22.17.0` (local); `.node-version`=20; Nixpacks pins `nodejs_20`; `engines`=`>=20.19.0` | Prod runs Node 20; local drift is harmless |
| `npx prisma validate` | ✅ | "The schema … is valid 🚀" | Schema valid |
| `npx prisma format --check` | ⚠️ | "There are unformatted files" | Cosmetic; schema not canonically formatted |
| `npm audit --omit=dev` | ⚠️ | 3 vulns: **multer high**, **uuid moderate** (via exceljs) | See §9 / ADMIN-HIGH-001 |
| `npm test --workspace=server` (vitest) | ✅ | **151 passed (14 files)** — was 130; +21 report-range boundary tests added with the ADMIN-HIGH-003 fix | Strong green suite; audit-log warnings in output are expected (fake test DB) |
| `npm run lint` (client, eslint) | ✅ (fixed 2026-07-19) | **0 errors, 3 warnings** (was 68 errors) — exit 0 | ADMIN-MED-001 resolved; remaining 3 are dev-only Fast-Refresh warnings |
| `npm run build` (client, vite) | ✅ | built in ~2.4s; `index-*.js` **1,376 kB / 389 kB gzip**; chunk-size warning | Builds; no code-splitting |

---

## 4. Findings

> No **Blocker** or **Critical** findings. The application authenticates, authorizes, builds,
> tests green, and its migrations have been applied to a live production database. What follows
> is hardening and correctness-at-the-edges.

### High

---

#### ADMIN-HIGH-001
**Title:** `multer@2.1.1` ships a High-severity Denial-of-Service CVE
**Severity:** High
**Confidence:** Confirmed
**Affected files:** `server/package.json` (`"multer": "^2.1.1"`), used in `server/routes/students.routes.js`
**Evidence:** `npm audit` — *"multer 1.0.0 – 2.1.1 … Denial of Service via deeply nested field
names"* and *"incomplete cleanup of aborted uploads"*; `2.1.1` is the top of the vulnerable range,
fix available via a non-breaking patch bump. The dependency is reachable at
`POST /students/upload` (`upload.single('file')`, memory storage, 5 MB limit).
**Root cause:** Vulnerable transitive/direct version pinned by `^2.1.1` resolving to `2.1.1`.
**User impact:** A crafted multipart body could exhaust CPU/memory and degrade the server.
**Technical impact:** Availability. Blast radius is limited because the route is gated to
`admin`/`super_admin` (trusted actors) and file size is capped, but the DoS vectors are on field
parsing, not just file size.
**Recommended solution:** Bump multer to the patched release (`npm audit fix` — non-breaking for
this version line) and re-run the upload tests.
**Estimated change risk:** Low.
**Verification method:** `npm audit` shows multer resolved; `server/tests` for upload still green;
manual student upload smoke test.

---

#### ADMIN-HIGH-002
**Title:** Spreadsheet formula injection in report/roster Excel exports
**Severity:** High
**Confidence:** Highly probable
**Affected files:** `server/lib/excel.js` (`buildWorkbook` → `sheet.addRow(row)`),
`server/controllers/reports.controller.js` (`mapViolationExportRow`, student roster export),
`server/controllers/students.controller.js` (`downloadTemplate` styling only),
`server/controllers/violations.controller.js` (`myViolationsPdfExport` — PDF, lower risk)
**Evidence:** `excel.js` writes cell values verbatim:
```js
rows.forEach((row) => sheet.addRow(row));   // no leading =,+,-,@,tab,CR neutralisation
```
Exported columns include `student_name` and `registration_number`, which originate from the
admin-uploaded Excel (`students.controller.parseWorkbook`) and are stored/echoed unchanged. A
student name like `=HYPERLINK("http://evil","click")` or `=cmd|…` is re-emitted as a live formula.
**Root cause:** No output-encoding of untrusted cell text on export.
**User impact:** When another staff member opens an exported `.xlsx`, a malicious cell can execute
a formula (data exfiltration via `HYPERLINK`/`WEBSERVICE`, or command execution on legacy Excel).
**Technical impact:** Client-side code execution / data leakage originating from stored data.
**Recommended solution:** In `buildWorkbook`, prefix any string cell beginning with
`= + - @ \t \r` with a single quote (or set the cell as an explicit text type). Apply centrally so
every export path inherits the fix.
**Estimated change risk:** Low (one helper, all exports benefit).
**Verification method:** Upload a student named `=1+1`, export the Student Violation Report,
confirm the cell renders as literal text.

---

#### ADMIN-HIGH-003 — ✅ RESOLVED (2026-07-19)
**Resolution:** Introduced a single IST-explicit date-range utility
(`server/lib/reportRange.js`) built on `lib/time.js` primitives, and routed **all** report
endpoints (`reports.controller.js`) and the analytics dashboard (`analytics.controller.js`)
through it. `@db.Date` columns (`duty_date`) now use UTC-midnight calendar boundaries; `created_at`
(timestamptz) now uses IST wall-clock instant boundaries — the two are no longer conflated. The
daily/weekly UTC construction and the local-time month/year construction are both gone, so results
no longer depend on the process `TZ`. Added `server/tests/report-range.test.mjs` with boundary
tests for 11:30 PM, 12:30 AM, month-end and year-end (11:30 PM→correct period; 12:30 AM next
day→next period). Full suite green: **151 passed** (was 130). `duty-slots.controller.js` is
intentionally unchanged — it filters only calendar dates (not instants) for pick-counting and is
not a report surface.

*Original finding retained below for the record.*

**Title:** Report date boundaries mix server-local and UTC, and correctness depends on `TZ`
**Severity:** High
**Confidence:** Highly probable
**Affected files:** `server/controllers/reports.controller.js` — `monthRange`/`yearRange`
(`new Date(year, month-1, 1)`, server-local) vs `dailyViolationReport`/`weeklyViolationReport`
(`new Date(\`${date}T00:00:00Z\`)`, UTC); `.env.example` documents `TZ=Asia/Kolkata` as *required*.
**Evidence:** Monthly/yearly filters build boundaries in **server-local** time; daily/weekly build
them in **UTC**, then read `getFullYear()/getMonth()/getDate()` (local) off a UTC-parsed date to
compute the upper bound — a mixed window. Admin ad-hoc violations are filtered by `created_at`
(timestamptz), so records near a day/month edge can be misclassified. The whole scheme is only
correct if `TZ=Asia/Kolkata` is actually set on the deploy.
**Root cause:** Two different date-construction idioms across sibling report functions, plus an
implicit dependency on a process timezone env var.
**User impact:** A violation recorded shortly after IST midnight can appear in the previous
day/month report, or be missing from the current one.
**Technical impact:** Data-accuracy bug at period boundaries; silent if `TZ` is unset in prod.
**Recommended solution:** Pick one canonical timezone strategy (compute IST boundaries explicitly,
independent of process `TZ`) and share a single helper across monthly/yearly/daily/weekly. Assert
`TZ`/expected offset at startup or in a deploy check.
**Estimated change risk:** Medium (touches many report functions; needs boundary tests).
**Verification method:** Seed violations at 23:30 and 00:30 IST on a month edge; confirm each lands
in the intended monthly/daily report.

---

### Medium

---

#### ADMIN-MED-001 — ✅ RESOLVED (2026-07-19)
**Resolution:** Lint now passes with **0 errors** (was 68), exit 0; build still green. Fixes, by
category: **(config)** added `dev-dist` (generated PWA service-worker artifact) to
`eslint.config.js` ignores and gave Node globals to build/config files — cleared 41 errors + the
`vite.config.js` `__dirname` error; **(unused vars, 11)** removed dead imports/vars across
`Layout`, `NotificationBell`, `EmptyState`, `NotificationsPage`, `AttendanceLivePage`,
`CalendarPage`, `DashboardPage`; **(set-state-in-effect, 8)** replaced form-reset/selection-clear
effects with the React-supported guarded render-phase state adjustment (ComposeDrawer,
ProfileDrawer, ViolationTypeDrawer, RequestReassignmentModal, DutyTimingSettingsPage, StudentsPage,
StatCard→rAF-callback-only, OfflineBanner→transition pattern); **(purity, 3)** `Date.now()` moved
to a lazy `useState` init (RecordViolationModal) and a 30s ticking state (DashboardPage — also makes
the auto-clock-out countdown live), `Math.random()` replaced with a deterministic per-column width
(Skeleton); **(unstable deps, 4 warns)** wrapped `rows`/`slots` in `useMemo` (FlaggedViolationsPage,
AllFacultyDutiesPage) and removed the offending effect (ViolationTypeDrawer); **(api.js)**
`process.env.NODE_ENV` → `import.meta.env.PROD`. **No React hook rule was disabled.** The only
remaining items are 3 `react-refresh/only-export-components` **warnings** (a dev-HMR hint, not a
hook or correctness rule) on the Toast context provider (imported in 25 files) and the co-located
drawer style helpers — downgraded to `warn` with a documented rationale rather than forcing a
25-file refactor with no runtime benefit.

*Original finding retained below for the record.*

**Title:** Client ESLint gate fails (68 errors) — masks real React smells
**Severity:** Medium
**Confidence:** Confirmed
**Affected files:** `client/src/utils/api.js` (`'process' is not defined`),
`client/vite.config.js` (`'__dirname' is not defined`),
`client/src/pages/admin/StudentsPage.jsx:188` (setState synchronously in effect — cascading
renders), `client/src/pages/faculty/DashboardPage.jsx:187` (`Date.now()` called during render —
impurity) and `:139` (`refetchSlots` assigned but unused),
`client/src/pages/admin/DutyTimingSettingsPage.jsx:87` (setState in effect),
`FlaggedViolationsPage.jsx`/`AllFacultyDutiesPage.jsx` (`useMemo` dep instability warnings).
**Evidence:** `npm run lint` → *"76 problems (68 errors, 8 warnings)"*, exit 1.
**Root cause:** Two buckets: (a) **ESLint config gaps** — `process`/`__dirname` aren't declared as
globals for the browser/node files (false-positive `no-undef`); (b) **genuine** react-hooks v7
findings (setState-in-effect, `Date.now` during render, unused var).
**User impact:** Mostly none at runtime today, but the StudentsPage selection-clearing effect can
cause extra render passes, and `Date.now()` during render is technically impure.
**Technical impact:** A red lint gate blocks lint-gated CI and buries the real smells in noise.
**Recommended solution:** Fix the config globals (env for `process.env`, node env for
`vite.config.js`), then address the handful of real hook issues (derive selection reset without an
effect; move `Date.now()` into an event/interval). Do **not** mass-`--fix`.
**Estimated change risk:** Low.
**Verification method:** `npm run lint` exits 0; StudentsPage selection behaviour unchanged.

---

#### ADMIN-MED-002
**Title:** Reassignment eligibility is TOCTOU; request-status update isn't conditionally guarded
**Severity:** Medium
**Confidence:** Possible
**Affected files:** `server/controllers/duty-slots.controller.js` (`reassignSlot`),
`server/controllers/duty-reassignment-requests.controller.js` (`respondToRequestCore`)
**Evidence:** In both, eligibility (`status==='scheduled'`, no attendance, not past) is read
*before* the write `$transaction`, and the request update
`prisma.dutyReassignmentRequest.update({ where: { id }, … })` has no `status: 'pending'` predicate.
Two concurrent approvals (e.g. the in-app PATCH and the Telegram inline button firing together, or
two pending requests for one slot accepted near-simultaneously) can both pass the read check and
both run their transactions.
**Root cause:** Check-then-act without a conditional write guard or in-transaction re-read.
**User impact:** Rare: a duplicate `duty_reassignments` history row, or two requests both marked
`approved` for one slot while the slot ends up owned by whichever transaction committed last.
**Technical impact:** Data-integrity drift in reassignment history under a narrow race.
**Recommended solution:** Make the status transition atomic — `updateMany({ where: { id, status:
'pending' }, … })` and treat `count !== 1` as "already handled"; re-assert slot eligibility inside
the transaction (same single-winner pattern already used well for OTP/magic-link token claims).
**Estimated change risk:** Low–Medium.
**Verification method:** Concurrency test firing two approvals for one request/slot; assert exactly
one history row and one `approved`.

---

#### ADMIN-MED-003 — ⏸ DEFERRED, evidence-gated (2026-07-19)
**Decision:** Useful improvement, **not** a release blocker, and explicitly **not** to be applied
blindly. At ~20–30 faculty most of these tables are tiny, so PostgreSQL will (correctly) seq-scan
and ignore a new index — adding one would be pure write-cost dead weight. Rather than edit
`schema.prisma`, two scripts were added to gather the evidence first:
`db/index-diagnostics.sql` (READ-ONLY: table sizes, existing-index usage incl. unused/redundant
detection, and `EXPLAIN ANALYZE` of the actual controller queries) and `db/candidate-indexes.sql`
(gated, idempotent, reversible `CREATE INDEX CONCURRENTLY` statements, each with a per-index
go/no-go rule and its `@@index` equivalent for Prisma-native application). An index is added only
when the diagnostics show (a) the table is large/growing, (b) a costly seq scan removing most
rows, and (c) a trial index actually changes the plan. Likely first real candidate:
`admin_audit_log` (append-only, only ever grows). `schema.prisma` was intentionally left
untouched. *Original finding retained below.*

**Title:** Missing indexes on frequently filtered / soft-delete columns
**Severity:** Medium
**Confidence:** Highly probable
**Affected files:** `prisma/schema.prisma`
**Evidence:** Nearly every read path filters `deleted_at: null` and/or `status`, but there are no
indexes on `violations.deleted_at`, `duty_slots.status`, `users.status`, `users.role`,
`students.status`, `students.deleted_at`, or `admin_audit_log.created_at`/`actor_id`. See §8 table
for the query justifying each.
**Root cause:** Indexing focused on FKs/uniques; predicate columns were not added.
**User impact:** None yet at ~20–30 faculty; degrades as violations/students grow.
**Technical impact:** Sequential scans on list/report/audit queries at scale.
**Recommended solution:** Add the composite/partial indexes in §8 with an additive migration. No
schema semantics change.
**Estimated change risk:** Low (index-only migration).
**Verification method:** `EXPLAIN` on the list queries shows index usage on a seeded dataset.

---

#### ADMIN-MED-004
**Title:** Admin bundle shipped as one 1.37 MB chunk (no code-splitting)
**Severity:** Medium
**Confidence:** Confirmed
**Affected files:** `client/vite.config.js`, app entry/router
**Evidence:** Build output: `index-*.js` **1,376.99 kB (389 kB gzip)** plus Vite's
>500 kB chunk warning. Recharts, Mantine, Tabler/Lucide icons, exceljs-adjacent code and every
page load in one bundle.
**Root cause:** No route-level `React.lazy`/dynamic imports.
**User impact:** Slow first paint on the admin panel over mobile/college Wi-Fi.
**Technical impact:** Larger-than-necessary initial download; PWA precache is ~2.2 MB.
**Recommended solution:** Lazy-load heavy admin routes (Reports/Analytics/charts) and split vendor
chunks. Optional but high-value for the mobile-first goal.
**Estimated change risk:** Low–Medium.
**Verification method:** Build emits multiple chunks; largest initial chunk well under 500 kB.

---

#### ADMIN-MED-005
**Title:** `settings.service` in-memory cache has no TTL or cross-process invalidation
**Severity:** Medium
**Confidence:** Highly probable (conditional on scaling)
**Affected files:** `server/services/settings.service.js` (`_cache`)
**Evidence:** `getSettings()` caches the single `SystemConfig` row for the process lifetime;
freshness relies on the *same process* calling `updateSettings`. Cron and web share one process
today, so it's correct now — but any second Railway replica would serve stale timing thresholds
indefinitely after an update.
**Root cause:** Module-level cache without expiry or pub/sub invalidation.
**User impact:** After horizontal scaling, some requests/cron ticks could use old session/late/
auto-clock-out times.
**Technical impact:** Correctness under multi-instance deploys; also a manual DB edit wouldn't
reflect until restart.
**Recommended solution:** Add a short TTL (e.g. 30–60 s) or invalidate across instances; or
document "single instance only" as a deploy constraint.
**Estimated change risk:** Low.
**Verification method:** Update settings on instance A; instance B reflects within the TTL.

---

#### ADMIN-MED-006
**Title:** `uuid` moderate CVE via `exceljs` (transitive)
**Severity:** Medium
**Confidence:** Confirmed (advisory) / low reachability
**Affected files:** `server/package.json` (`exceljs` → `uuid < 11.1.1`)
**Evidence:** `npm audit`: *"uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided"*;
"fix available via `npm audit fix --force`, will install exceljs@3.4.0 (breaking)."
**Root cause:** exceljs depends on an old uuid.
**User impact:** Negligible — the vulnerable code path (`buf` argument) is not exercised by
report/template generation.
**Technical impact:** Advisory noise; the forced fix is a **breaking** exceljs downgrade — do
**not** apply blindly.
**Recommended solution:** Track upstream; do not `--force`. Optionally pin a patched `uuid` via an
overrides entry if the audit noise must be cleared.
**Estimated change risk:** Medium if forced (breaking); Low if left.
**Verification method:** Confirm exports still generate after any override.

---

### Low

| ID | Title | File | Note |
|---|---|---|---|
| ADMIN-LOW-001 | ✅ **RESOLVED 2026-07-19** — `console.error` → `logger.error` (Winston) | `server/controllers/invites.controller.js` | Fixed; no `console.*` left in any controller. |
| ADMIN-LOW-002 | ✅ **RESOLVED 2026-07-19** — added `auditLogsQuery` Zod schema + `validateQuery` on the route; blank UI filters pass through, malformed dates/uuid/page now 422 instead of a Prisma 500 | `server/routes/admin.routes.js`, `server/schemas/users.schema.js` | Fixed & verified. |
| ADMIN-LOW-003 | Webhook path-secret fallback still enabled (own `TODO`) | `server/routes/bot.routes.js:36` | Move to header-only + static path, drop `/:secret`. Informational-security. |
| ADMIN-LOW-004 | `hardDelete('student')` soft-deletes and skips the violation-preservation guard that `DELETE /students/:id` enforces | `server/controllers/users.controller.js:364` | Inconsistent delete semantics between the two Super-Admin delete paths. |
| ADMIN-LOW-005 | Node version drift: `.node-version`=20, local=22, `engines>=20.19.0` | root | Harmless for prod (Nixpacks pins 20); align local. |
| ADMIN-LOW-006 | Vestigial columns/enums retained | `schema.prisma`: `record_status`+`RecordStatus`/`ViolationChangeType.hidden`, `photo_path`/`photo_expires_at`, `students.semester_or_year`/`institution` | Documented as intentional dead weight; dropping needs a migration. Keep for now. |
| ADMIN-LOW-007 | `api.js` uses `process.env.NODE_ENV` (non-idiomatic in Vite; works via Vite `define`) | `client/src/utils/api.js:11` | Prefer `import.meta.env.PROD`. Works today. |

### Informational

| ID | Observation | Location |
|---|---|---|
| ADMIN-INFO-001 | ✅ **RESOLVED 2026-07-19** (commit `2c50d11`) — stale root `CreateUserDrawer.jsx` removed after verifying the live import resolves to `client/src/components/`. | root vs `client/src/components/` |
| ADMIN-INFO-002 | ◑ **PARTIAL 2026-07-19** (commit `2c50d11`) — removed 5 old reports + the screenshot + `SIMS DMS Problems 22.docx` after a full reference check. Kept referenced/current docs (`SIMS_API_Endpoints`, schema, `TELEGRAM_SYSTEM_GUIDE`, `MOBILE_*`, planning/quick-ref) and left `test-invite-flow.js`/`check-admin.sql`/`.understand-anything/` as out-of-scope judgement calls. | root |
| ADMIN-INFO-003 | `prisma format --check` reports the schema isn't canonically formatted. | `prisma/schema.prisma` |
| ADMIN-INFO-004 | `vite build` chunk-size warning (>500 kB) — see ADMIN-MED-004. | build |
| ADMIN-INFO-005 | `getPhoto` / `photo_access_log` / photo columns are Phase-1 foundation placeholders returning `501`. Intentional. | `violations.controller.js` |
| ADMIN-INFO-006 | Server test output shows expected `adminAuditLog.create` "denied on test_fake" warnings — best-effort audit path, not a failure. | `server/tests` |

---

## 5. Duplicate Code and Component Report

| Duplicate area | Files | Duplication type | Harmful? | Recommended action |
|---|---|---|---|---|
| CreateUserDrawer | root `CreateUserDrawer.jsx` + `client/src/components/CreateUserDrawer.jsx` | Stale exact-ish copy | **Yes** (confusion) | Remove the root copy (dead) |
| Student-violation report variants | `reports.controller.js` daily/weekly/monthly/PDF/export fns | Repeated range→where→fetch scaffolding | Partly | Already factored via `_getStudentViolations`/`_sendStudentViolationPdf`/`studentViolationWhere`; acceptable — small further extraction optional, not required |
| `monthRange`/`monthDateRange` | `reports.controller.js` + `duty-slots.controller.js` | Same helper defined twice | Mild | Share one helper in `lib/time.js` (also fixes ADMIN-HIGH-003 consistency) |
| Session label ternary (`morning`→`Morning`) | duty-slots, duty-reassignment-requests, reports controllers | Tiny repeated formatting | No | Leave — extracting a 1-line ternary adds indirection without reliability gain |
| Pagination clamp (`Math.min(100, Math.max(1, …))`) | most list controllers | Repeated 2-line idiom | No (acceptable) | Optional shared `parsePaging()`; low value |
| Telegram fire-and-forget `.catch(logger.warn)` blocks | duty-slots, duty-reassignment-requests | Intentional per-call error isolation | No | Keep — deliberate |

---

## 6. Admin Page-by-Page Review

> Backend read paths and route authorization were verified per page; frontend behaviour assessed
> from the page/hook source and lint output.

### Dashboard (`AdminDashboardPage.jsx`, `SuperAdminDashboardPage.jsx`)
- **Working well:** Consolidated to a single flagged-violation resolve flow (links out to Flagged
  Violations page); duplicate detail modals removed per constitution v3.16.
- **Confirmed issues:** None specific beyond the shared bundle size (ADMIN-MED-004).
- **Likely issues:** 30-second polling widgets are intentional (constitution).
- **Missing tests:** No FE test harness.
- **Priority:** Low.

### Users (`UsersPage.jsx`, `useUsers.js`, `users.controller.js`)
- **Working well:** Server-side pagination/search (name/email/SIMS-ID), mass-assignment whitelist
  on `updateProfile`, self-deactivate/self-delete guards, super-admin protection, `session_version`
  bump on every state change.
- **Confirmed issues:** None.
- **Missing tests:** `updateProfile` mass-assignment rejection is worth an explicit test.
- **Priority:** Low.

### Students (`StudentsPage.jsx`, `students.controller.js`)
- **Working well:** Upsert-by-registration_number, dry-run preview, scoped deactivation guarded
  against mass-deactivation, transactional import, violation-preservation block on hard delete.
- **Confirmed issues:** ADMIN-HIGH-002 (export formula injection); ADMIN-MED-001 (setState-in-effect
  at `StudentsPage.jsx:188`).
- **Likely issues:** Import loops `student.update` per row inside one transaction — fine at college
  scale, could be a long transaction for very large files.
- **Missing tests:** No coverage of the upload/reconciliation path.
- **Priority:** Medium.

### Attendance (`AttendanceLivePage.jsx`, `attendance.controller.js`)
- **Working well:** Live dashboard admin-gated; override requires a reason; check-in/out faculty-gated.
- **Confirmed issues:** None found in the reviewed paths.
- **Missing tests:** Override authorization has coverage (`attendance.test.mjs`).
- **Priority:** Low.

### Violations (`ViolationsPage.jsx`, `violations.controller.js`)
- **Working well:** Faculty-scope enforced in controller; soft delete excluded from every read
  path; edit blocked after flagging; immutable `violation_audit_log`.
- **Confirmed issues:** Export formula injection (ADMIN-HIGH-002) applies to violation exports.
- **Priority:** Medium (export fix).

### Duty Reassignment (`DutySlotsPage.jsx`, `duty-slots.controller.js`, `duty-reassignment-requests.controller.js`)
- **Working well:** DB unique constraint as final race guard on pick/assign; P2002 handled; two
  independent methods write one shared history table; approval auto-declines siblings.
- **Confirmed/likely issues:** ADMIN-MED-002 TOCTOU on eligibility + non-atomic status update.
- **Missing tests:** `duty-reassignment-requests.test.mjs` exists; add a concurrency case.
- **Priority:** Medium.

### Reports (`ReportsPage.jsx`, `reports.controller.js`)
- **Working well:** 24 endpoints, Zod query validation on most, `take` caps on display queries,
  in-memory summary avoids extra round-trips, admin-only.
- **Confirmed issues:** ADMIN-HIGH-003 timezone; ADMIN-HIGH-002 export injection.
- **Likely issues:** Uncapped export queries load all matching rows into Node (fine at scale now).
- **Missing tests:** **No** automated report coverage.
- **Priority:** High (timezone + export).

### Settings / Duty Timing (`DutyTimingSettingsPage.jsx`, `duty-timing-settings.controller.js`, `settings.service.js`)
- **Working well:** Shared `findOrderingViolation` invariant across both write endpoints; single-row
  config service.
- **Confirmed issues:** ADMIN-MED-005 cache staleness on scale; ADMIN-MED-001 setState-in-effect at
  `DutyTimingSettingsPage.jsx:87`.
- **Priority:** Medium.

### Notifications (`NotificationsPage.jsx`, `NotificationBell.jsx`, Telegram)
- **Working well:** Telegram is sole channel; fire-and-forget with per-message error isolation;
  webhook secret constant-time compared and log-redacted.
- **Priority:** Low.

### Inbox / Messages (`MessagesPage.jsx`, `messages.controller.js`)
- **Working well:** Ownership checks on read/delete; faculty↔faculty block enforced; physical delete
  only when both sides remove (per constitution); read-state transitions correct.
- **Missing tests:** No messaging coverage.
- **Priority:** Low.

### Audit Logs (`AuditLogsPage.jsx`, `getAuditLogs`)
- **Working well:** Super-admin-only, paginated, actor/action/date filters.
- **Confirmed issues:** ADMIN-LOW-002 (no query validation → malformed date can 500).
- **Priority:** Low.

### Imports / Exports
- Covered under Students/Reports above — formula injection is the material item.

---

## 7. API Contract Mismatch Report

No contract mismatches were found between the client hooks and the mounted routes — every
`use*.js` call targets an existing endpoint with a matching method and body shape, and role gates
line up with the UI. Items below are consistency notes, not breakages.

| Frontend caller | Expected endpoint | Backend endpoint | Mismatch | Impact |
|---|---|---|---|---|
| `useReports` daily/weekly export | `/reports/student-violations/daily/:date/export`, `/weekly/export` | Present (route order literal-before-param correct) | None | — |
| `useDutySlots` reassign | `POST /duty-slots/:id/reassign` | Present, admin-gated | None | — |
| `useAuth` OTP | `POST /auth/otp/request`, `/verify` | Present, CSRF-exempt, limited | None | — |
| `SIMS_API_Endpoints_v2.0.md` | Documented surface | Constitution notes this doc is **stale** vs current counts | Doc drift only | Regenerate the API doc |

---

## 8. Prisma and SQL Review

**Schema problems.** None invalidating. Vestigial `RecordStatus`/`record_status`,
`ViolationChangeType.hidden`, photo columns, and `students.semester_or_year`/`institution` remain
by explicit decision (§4/§5 of the constitution).

**Relation problems.** Clean. `DutyReassignmentRequest.dutySlot` uses `onDelete: Cascade`; all
other relations are `Restrict` by default which correctly prevents orphaning (users are
soft-deleted, never hard-deleted, so FK references from violations/audit survive).

**Uniqueness review.** Correct and load-bearing: `duty_slots(duty_date, session_type)` (one
faculty per session per day; the race guard on pick/assign), `calendar_config(config_month,
config_year)`, `users.sims_id`, nullable-unique `users.email`/`telegram_id`. OTP/login token
tables intentionally have **no** unique on the hashed code (bcrypt salts; lookup is by id).

**Migration review.** 27 migrations, committed, applied to live prod. Several are historically
destructive (`restructure_students`, `drop_section_and_not_checked_in_cutoff`,
`remove_cover_add_duty_reassignment`, `violation_nullable_duty_slot`, `add_sims_id_series`
backfill) but are already deployed and the app is live — no forward risk. No `TRUNCATE`/`DELETE
FROM` data-wipes found.

**Raw SQL review.** Only three uses, all safe: `SELECT 1` health check, and two parameterized
`FOR UPDATE` row locks in `lib/bot.js` (invite activation, relink) — the single sanctioned
non-report raw-SQL exception, correctly parameterized via tagged templates (no injection).

**Query performance / concurrency / integrity risks.** Missing predicate indexes (below);
reassignment TOCTOU (ADMIN-MED-002); uncapped export row loads; `sessionCompletionRate` runs 6
sequential monthly count-pairs (minor).

### Recommended indexes

| Table / model | Proposed index | Query supported | Necessity | Write cost |
|---|---|---|---|---|
| `violations` | `@@index([deleted_at])` or partial `WHERE deleted_at IS NULL` | Every list/report/analytics query filters `deleted_at: null` | Medium (grows with data) | Low |
| `duty_slots` | `@@index([status])` (or `[duty_date, status]`) | `absentFacultyReport`, coverage, completion-rate filter `status` | Medium | Low |
| `users` | `@@index([role, status])` | eligible-faculty, unassigned-faculty, directory, list filters | Medium | Low |
| `students` | `@@index([status, deleted_at])` | `listStudents`/`searchStudents`/roster filter both | Medium | Low |
| `admin_audit_log` | `@@index([created_at])` and `@@index([actor_id])` | Audit Logs page orders by `created_at desc`, filters `actor_id` | Low–Medium | Low |
| `violations` | `@@index([faculty_id, created_at])` | faculty "my violations" + activity report order by `created_at` | Low | Low |

*Every recommendation is tied to an existing query above; none is speculative. All are additive
(index-only) migrations with no semantic change.*

---

## 9. Security Review

| Security issue | Dependency or file | Severity | Reachable in production? | Recommendation |
|---|---|---|---|---|
| multer DoS CVE | `multer@2.1.1` / `students.routes.js` | High | Yes — admin-gated upload | Patch bump (ADMIN-HIGH-001) |
| Excel formula injection | `lib/excel.js` exports | High | Yes — any exported report | Neutralise `=+-@` on export (ADMIN-HIGH-002) |
| uuid bounds-check CVE | `exceljs → uuid` | Moderate | No (vulnerable path unused) | Track; don't force-downgrade (ADMIN-MED-006) |
| Webhook path-secret fallback | `bot.routes.js` | Low | Yes but secret-gated | Header-only + static path (ADMIN-LOW-003) |
| Missing audit-log query validation | `admin.routes.js` | Low | Yes | Add Zod query schema (ADMIN-LOW-002) |
| SQL injection | Prisma + 2 parameterized raw queries | — | No | None — parameterized |
| XSS | React escaping; no `dangerouslySetInnerHTML` found | — | No | None observed |
| CSRF | `middleware/csrf.js` double-submit + `timingSafeEqual`; login/OTP correctly exempt | — | Mitigated | None |
| CORS | `index.js` allow-list from `CORS_ORIGIN` | — | Mitigated | Ensure prod `CORS_ORIGIN` set |
| Cookie security | httpOnly JWT, `secure` in prod, `sameSite=lax`, CSRF cookie non-httpOnly by design | — | Good | None |
| Broken access control / IDOR | Ownership checks on messages, violations, slots, profile | — | Mitigated | None — well done |
| Brute force | Per-IP limiters + per-account OTP lockout (no per-account password lockout, by design) | Low | Mitigated | Accept (documented) |
| Secrets exposure | `.env`/`server/.env` untracked; `.env.example` placeholders only; webhook redacted in logs | — | No | None |
| Password storage | bcrypt cost 12; never logged | — | Good | None |
| Mass assignment | `updateProfile` whitelist + sensitive-field rejection | — | Mitigated | None |

**Reachability note:** the two "High" items are the only practically exploitable ones, and both
have limited blast radius (upload is admin-only; formula injection requires a malicious/mistaken
cell to later be opened by a human). Neither is a bypass of auth or authorization.

---

## 10. Test and Build Review

- **Passing suites:** `server` vitest — **130/130** across auth, csrf, lockout, bot, cron,
  duty-slots, duty-reassignment-requests, violations, violation-types, users, invites, sims-id,
  attendance, admin-settings.
- **Failing suites:** None. Client has **no** test runner configured.
- **Initialization failures:** None (audit-log "denied on test_fake" lines are expected best-effort
  warnings, not failures).
- **Missing coverage:** reports (24 endpoints), analytics (10), student Excel upload/reconciliation,
  messaging, and reassignment **concurrency**. No frontend/component/E2E tests. No authorization
  test asserting faculty cannot hit admin report routes.
- **CI weaknesses:** Client lint gate is red (ADMIN-MED-001); if CI runs `npm run lint` it fails.
  No client test step exists to gate regressions.
- **Deployment weaknesses:** Correctness depends on `TZ=Asia/Kolkata` and `CORS_ORIGIN` being set;
  no startup assertion validates required env vars beyond the webhook warn. Build works cleanly
  from the committed config.

---

## 11. Dead Code and Unfinished Features

| Feature or code | Location | Status | Recommendation |
|---|---|---|---|
| Root `CreateUserDrawer.jsx` | repo root | Stale duplicate, not imported | Remove |
| `record_status` / `RecordStatus` / `ViolationChangeType.hidden` | schema + read filters | Vestigial (Hide removed) | Retain now; drop later via migration |
| `photo_path`/`photo_expires_at`/`photo_access_log`/`getPhoto` | violations model + `501` handler | Phase-1 foundation placeholder | Retain intentionally |
| `students.semester_or_year` / `institution` | Student model | Legacy nullable, still written for display | Retain (used in some reports) |
| `otp_failed_attempts` history / `otp_sessions` | (removed table) | Superseded by `otp_login_codes` | Already removed — OK |
| Root one-off docs/artifacts (`FULL_SYSTEM_AUDIT_*.md`, `Screenshot*.jpg`, `test-invite-flow.js`, `check-admin.sql`, `mobile-nav-preview.html`) | repo root | Non-shipping clutter | Archive into `/docs` or delete |
| `SIMS_API_Endpoints_v2.0.md` | root | Stale vs real endpoint counts (constitution says so) | Regenerate |
| Webhook `/:secret` path fallback | `bot.routes.js` | Transitional per own TODO | Complete migration to header-only |

---

## 12. Large Component Review

| File | Responsibility count | Main problem | Refactor recommended? | Suggested boundaries |
|---|---|---|---|---|
| `reports.controller.js` (686 LOC) | ~16 report builders + shared helpers | Length, not tangle — already well-factored with shared `_get*`/`studentViolationWhere` | No (split optional) | If split, group by domain (attendance vs violation vs duty) |
| `ReportsPage.jsx` | Many report views + filters + export triggers | Large surface; candidate for lazy-loading | Only for code-splitting (ADMIN-MED-004), not structure | Lazy-load per report section |
| `StudentsPage.jsx` | List + filters + selection + bulk + upload drawer | setState-in-effect smell (ADMIN-MED-001) | Targeted fix, not a rewrite | Derive selection reset without an effect |
| `AdminDashboardPage.jsx` | Widgets + polling | Bundle weight | No | — |
| `users.controller.js` | Users + admin settings + audit + hard-delete | Mixed concerns but cohesive | Optional | Could split admin-settings out |

*No file warrants a structural rewrite. Length alone is not a defect where the code is already
decomposed into small, named helpers, as here.*

---

## 13. Prioritized Action Plan

### Must fix before client submission
- **ADMIN-HIGH-001** multer patch bump. *Benefit:* clears the only High CVE. *Risk:* Low. *Files:*
  `server/package.json`, lockfile. *Deps:* none.
- **ADMIN-HIGH-002** neutralise formula injection in `lib/excel.js`. *Benefit:* removes
  client-side-execution risk from every export. *Risk:* Low. *Files:* `lib/excel.js`. *Deps:* none.
- ~~**ADMIN-HIGH-003** unify report date boundaries.~~ ✅ **DONE 2026-07-19** — shared
  `lib/reportRange.js`, all report + analytics endpoints migrated, boundary tests added, 151 tests
  green. Correctness no longer depends on the process `TZ`.
- **Confirm `CORS_ORIGIN` is set in Railway production** (operational check, not code). `TZ` is no
  longer a correctness dependency for reports, but keep it set for cron/log consistency.

### Should fix before production rollout
- ~~**ADMIN-MED-001** fix lint config + real hook smells.~~ ✅ **DONE 2026-07-19** — 0 lint errors,
  build green, no hook rule disabled.
- **ADMIN-MED-002** atomic reassignment status transition + in-transaction eligibility recheck.
  *Files:* both reassignment controllers. *Deps:* add concurrency test.
- **ADMIN-MED-003** ⏸ evidence-gated, not blind. Run `db/index-diagnostics.sql` against prod
  first; apply only the justified entries from `db/candidate-indexes.sql`. `schema.prisma` left
  untouched until the evidence warrants it.
- **ADMIN-LOW-001** `console.error`→Winston. **ADMIN-LOW-002** audit-log query validation.

### Can be completed after release
- **ADMIN-MED-004** route-level code-splitting. **ADMIN-MED-005** settings cache TTL.
- **ADMIN-LOW-003** webhook header-only migration. **ADMIN-LOW-004** align student hard-delete
  semantics. Remove stale root `CreateUserDrawer.jsx` and regenerate the API doc.

### Optional improvements
- `prisma format`, repo-root cleanup, client test harness (Vitest + React Testing Library),
  report/analytics/upload integration tests, drop vestigial columns via a dedicated migration.

---

## 14. Findings That May Not Need Fixing

- **Vestigial columns/enums (`record_status`, photo fields, `semester_or_year`).** Removing them
  needs a migration against live data for zero user benefit; the constitution explicitly keeps
  them. Leaving them is the lower-risk choice.
- **No per-account password lockout.** Deliberate (constitution §4): IP-level limiting only, to
  avoid locking out faculty on shared college NAT. Reasonable for the threat model.
- **30-second polling in the inbox and dashboards.** Explicitly confirmed intentional (constitution
  §4 Notifications); not scope creep.
- **`uuid` moderate advisory (ADMIN-MED-006).** The vulnerable `buf` path is unused; the official
  fix is a *breaking* exceljs downgrade. Changing here is riskier than the advisory itself.
- **Report/PDF helper duplication.** The daily/weekly/monthly variants differ enough (params,
  labels, ranges) that further abstraction would add indirection for marginal reliability gain;
  the shared `_get*`/`studentViolationWhere` already remove the meaningful duplication.
- **`settings.service` cache with no TTL.** Correct today under a single process (web + cron share
  it). Only worth changing if/when the deploy scales horizontally — until then, added invalidation
  is complexity without payoff. Document the constraint instead.
- **Vite in `dependencies` not `devDependencies`.** Unusual, but deliberate so
  `npm install --omit=dev && npm run build` works on Railway. Do not "correct" it — it would break
  the build.

---

## 15. Final Production Readiness Decision

**Ready after mandatory fixes.**

The system is architecturally sound, secure in its core auth/authorization design, tested
(130 green server tests), and builds and deploys cleanly — it is *already* running the latest
feature in production. It is **not** blocked by any auth bypass, data-loss, or build failure. The
gate to a clean client hand-over is a small, low-risk mandatory set: bump multer
(ADMIN-HIGH-001), neutralise export formula injection (ADMIN-HIGH-002), make report date
boundaries consistent and confirm `TZ`/`CORS_ORIGIN` in production (ADMIN-HIGH-003), and turn the
client lint gate green (ADMIN-MED-001). None of these is a rewrite; all are hours-scale changes.
Address the "Should fix" list before broad rollout, and schedule the index migration and
code-splitting as fast-follows.
