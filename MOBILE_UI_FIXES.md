# SIMS DMS — Mobile UI Fixes
# Based on actual mobile screenshots (June 8, 2026)

⚠️  APPLIED & ARCHIVED — All 10 fixes incorporated during Mantine migration (Phase 2–3d, June 2026)
════════════════════════════════════════════════════════════
Fix status:
  Fix 1  (hamburger / PageHeader overlap)  → APPLIED — PageHeader now uses Mantine Group+Title
  Fix 2  (table cell padding / whitespace)  → APPLIED — Table.jsx rebuilt on Mantine; scroll handled by Table.ScrollContainer
  Fix 3  (UsersPage column hiding)         → APPLIED — hidden sm:table-cell / hidden md:table-cell already in UsersPage
  Fix 4  (StudentsPage column hiding)      → APPLIED — same pattern applied
  Fix 5  (ViolationsPage Faculty column)   → APPLIED — hidden md:table-cell in ViolationsPage
  Fix 6  (DutySlotsPage UUID bug)          → APPLIED — coveredBy?.name with fallback already in DutySlotsPage
  Fix 7  (ViolationTypes flex-wrap)        → APPLIED — flex flex-wrap gap-1 on action buttons
  Fix 8  (AttendanceLivePage grid)         → APPLIED — grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
  Fix 9  (LoginPage vertical centering)   → needs verification against current LoginPage
  Fix 10 (Sidebar.jsx mt-8 → mt-10)       → REPLACED — Sidebar.jsx deleted; AppShell handles nav
════════════════════════════════════════════════════════════


---

## What to tell Claude Code (paste this entire message):

I need you to fix mobile UI issues across multiple pages in the SIMS DMS frontend.
Here are the exact problems I can see on my phone and the exact fixes needed.
Apply all fixes. Do not change any backend logic, API calls, or data fetching.

---

## FIX 1 — ALL PAGES: Hamburger button covers page title and subtitle

PROBLEM: The hamburger menu button (top-left, fixed position) overlaps the page
title and subtitle text on every page. The title "User Management", "Violations",
"Duty Slots" etc. all start at x=0 with no left offset, so the hamburger sits on
top of the first 2-3 characters.

In client/src/components/Layout.jsx:

Find:
  <div className="max-w-7xl mx-auto px-4 md:px-6 pt-14 md:pt-6 pb-6">{children}</div>

Change to:
  <div className="max-w-7xl mx-auto px-4 md:px-6 pt-14 md:pt-6 pb-6 min-w-0">{children}</div>

Then find the PageHeader component in the same file:
  export function PageHeader({ title, subtitle, action }) {
    return (
      <div className="flex items-start justify-between mb-6">

Change to:
  export function PageHeader({ title, subtitle, action }) {
    return (
      <div className="flex items-start justify-between mb-4 gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-semibold text-slate-900 truncate">{title}</h1>
          {subtitle && <p className="text-[12px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

Remove the existing inner div and h1/p from the original PageHeader since we
are replacing the whole return block. The new version wraps title and subtitle
in a flex-1 min-w-0 div so they don't overflow, and puts the action button in
a shrink-0 div so it doesn't get crushed.

---

## FIX 2 — ALL TABLE PAGES: Tables overflow horizontally, columns run off screen

PROBLEM: Every table page (Users, Students, Violations, Duty Slots, Violation
Types) shows columns running off the right edge of the screen. The last 1-2
columns are partially visible or completely cut off.

Affected pages:
- admin/UsersPage.jsx — STATUS column cut off
- admin/StudentsPage.jsx — STATUS column cut off
- admin/ViolationsPage.jsx — FLAG column cut off
- admin/DutySlotsPage.jsx — COVERED BY column cut off
- admin/ViolationTypesPage.jsx — SYSTEM and action buttons cut off
- admin/AttendanceLivePage.jsx — attendance cards too narrow

The Table component already has overflow-x-auto which is correct. The problem
is the tables have too many columns for a 390px screen.

In client/src/components/ui/Table.jsx:

Find the Td component:
  export function Td({ children, className = '' }) {
    return (
      <td className={`text-[13px] text-slate-700 px-3 py-2.5 whitespace-nowrap ${className}`}>

Change whitespace-nowrap to allow wrapping on mobile for content cells:
  export function Td({ children, className = '' }) {
    return (
      <td className={`text-[13px] text-slate-700 px-2 py-2 ${className}`}>

And update Th to reduce padding:
  export function Th({ children, className = '' }) {
    return (
      <th className={`text-[11px] font-semibold text-slate-500 uppercase tracking-[.04em] bg-slate-50 px-2 py-2 text-left whitespace-nowrap ${className}`}>

---

## FIX 3 — Users Page: Too many columns visible on mobile

PROBLEM: Users table shows NAME, ROLE, DEPARTMENT, TELEGRAM ID, STATUS all
on a 390px screen. Columns are crushed together and text overlaps.

In client/src/pages/admin/UsersPage.jsx:

Find the table header row with all column headers (Th components).
Wrap the DEPARTMENT and TELEGRAM ID header cells with a hidden class:

Find:
  <Th>Department</Th>
Change to:
  <Th className="hidden sm:table-cell">Department</Th>

Find:
  <Th>Telegram ID</Th>
Change to:
  <Th className="hidden md:table-cell">Telegram ID</Th>

Then find the corresponding Td cells in each table row:
Find the td that shows department:
  <Td>{u.department ?? '—'}</Td>
Change to:
  <Td className="hidden sm:table-cell">{u.department ?? '—'}</Td>

Find the td that shows telegram_id:
  <Td>{u.telegram_id ?? '—'}</Td>
Change to:
  <Td className="hidden md:table-cell">{u.telegram_id ?? '—'}</Td>

---

## FIX 4 — Students Page: Too many columns on mobile

PROBLEM: Students table shows REG NO, NAME, COURSE, SEMESTER/YEAR, ACAD YEAR,
STATUS, ACTIONS — 7 columns on a 390px screen. All columns are crushed.

In client/src/pages/admin/StudentsPage.jsx:

Hide COURSE and ACAD YEAR columns on mobile:

Find the COURSE header:
  <Th>Course</Th>
Change to:
  <Th className="hidden sm:table-cell">Course</Th>

Find the ACAD YEAR header:
  <Th>Acad. Year</Th>
Change to:
  <Th className="hidden sm:table-cell">Acad. Year</Th>

Find the corresponding Td for course in each row:
  <Td>{s.course}</Td>
Change to:
  <Td className="hidden sm:table-cell">{s.course}</Td>

Find the Td for academic_year:
  <Td>{s.academic_year}</Td>
Change to:
  <Td className="hidden sm:table-cell">{s.academic_year}</Td>

---

## FIX 5 — Violations Page: Columns crushed on mobile

PROBLEM: Violations table shows STUDENT, FACULTY, TYPE, FINE, STATUS, FLAG
all on mobile. The FINE column value "Warning only" appears cramped next to
the TYPE column. The FLAG column is cut off.

In client/src/pages/admin/ViolationsPage.jsx:

Hide FACULTY column on mobile (Admin can see it on desktop):

Find the FACULTY header:
  <Th>Faculty</Th>
Change to:
  <Th className="hidden md:table-cell">Faculty</Th>

Find the Td for faculty in each row:
  <Td>{v.faculty?.name ?? '—'}</Td>
Change to:
  <Td className="hidden md:table-cell">{v.faculty?.name ?? '—'}</Td>

---

## FIX 6 — Duty Slots Page: COVERED BY shows raw UUID on mobile

PROBLEM: The COVERED BY column shows the raw UUID string
"51fc1529-c..." and "53d447a7-..." instead of the faculty name.
This is a data display bug, not just a mobile issue.

In client/src/pages/admin/DutySlotsPage.jsx:

Find the Td that renders covered_by:
  <Td>{slot.covered_by ?? '—'}</Td>
Change to:
  <Td>{slot.coveredBy?.name ?? (slot.covered_by ? slot.covered_by.slice(0, 8) + '…' : '—')}</Td>

Also hide the COVERED BY column on mobile since it takes too much space:
Find the COVERED BY header:
  <Th>Covered By</Th>
Change to:
  <Th className="hidden sm:table-cell">Covered By</Th>

And the corresponding Td:
  <Td>{slot.coveredBy?.name ?? ...}</Td>
Change to:
  <Td className="hidden sm:table-cell">{slot.coveredBy?.name ?? (slot.covered_by ? slot.covered_by.slice(0, 8) + '…' : '—')}</Td>

---

## FIX 7 — Violation Types Page: Action buttons overflow off screen

PROBLEM: The Violation Types table shows "Edit Deactivate Delete" action
buttons as plain text links all on one line. On mobile they overflow off
the right edge of the screen and the Delete button is not reachable.

In client/src/pages/admin/ViolationTypesPage.jsx:

Find the Td that contains the Edit/Deactivate/Delete buttons:
  <Td>
    <div className="flex gap-1">
      <button ...>Edit</button>
      <button ...>Deactivate</button>
      <button ...>Delete</button>
    </div>
  </Td>

Change the flex gap to wrap on mobile:
  <Td>
    <div className="flex flex-wrap gap-1">
      <button ...>Edit</button>
      <button ...>Deactivate</button>
      <button ...>Delete</button>
    </div>
  </Td>

---

## FIX 8 — Live Attendance Page: Faculty card is too narrow

PROBLEM: The live attendance faculty card shows "Test Facu..." (truncated)
because the card is only about 220px wide. The card layout uses a fixed
narrow width that doesn't work on mobile.

In client/src/pages/admin/AttendanceLivePage.jsx:

Find the grid that wraps faculty attendance cards:
  <div className="grid grid-cols-...

If it uses grid-cols-2 or grid-cols-3, change to:
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

Also find the faculty name text inside the card:
  <p className="font-semibold text-slate-800 truncate">

Make sure it has min-w-0 on its parent so truncate works properly.

---

## FIX 9 — Login Page: Form is vertically centered too low on mobile

PROBLEM: The login form on mobile shows a large blank white space ABOVE
the Sign In heading and form. The form appears in the bottom half of the
screen with the top half empty. This happens because the flex container
uses items-center justify-center but the min-h-screen makes the container
taller than needed on small phones.

In client/src/pages/auth/LoginPage.jsx:

Find the right panel div:
  <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center min-h-screen lg:min-h-0 ...">

Change to:
  <div className="w-full lg:w-1/2 xl:w-2/5 flex items-start sm:items-center justify-center min-h-screen lg:min-h-0 pt-8 sm:pt-0 ...">

This makes the form align to the top with padding on very small screens,
and center vertically on slightly larger screens (sm: and up).

---

## FIX 10 — Sidebar drawer: "Su" text visible behind sidebar on open

PROBLEM: When the mobile sidebar drawer is open, the word "Su" (from
"Super Admin" role subtitle) is visible behind the sidebar. This happens
because the sidebar top section does not have enough top margin to
account for the close button.

In client/src/components/Sidebar.jsx:

Find the Brand div inside the aside:
  <div className="px-5 py-4 border-b border-slate-800 mt-8 md:mt-0">

Change to:
  <div className="px-5 py-4 border-b border-slate-800 mt-10 md:mt-0">

---

## Summary — All 10 fixes in one sentence each:

1. Layout.jsx — Add gap-2 and min-w-0 to PageHeader so title doesn't go under hamburger
2. Table.jsx — Reduce cell padding px-3→px-2, remove whitespace-nowrap from Td
3. UsersPage.jsx — Hide Department (sm) and Telegram ID (md) columns on mobile
4. StudentsPage.jsx — Hide Course and Acad Year columns on mobile (sm)
5. ViolationsPage.jsx — Hide Faculty column on mobile (md)
6. DutySlotsPage.jsx — Fix UUID showing instead of name; hide column on mobile
7. ViolationTypesPage.jsx — Add flex-wrap to action buttons row
8. AttendanceLivePage.jsx — Change grid to grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
9. LoginPage.jsx — Change items-center to items-start sm:items-center with pt-8 sm:pt-0
10. Sidebar.jsx — Increase mt-8 to mt-10 on brand div when drawer is open

---

## After all fixes are applied:

Test each page at 390px width in browser DevTools (responsive mode).
Every table should be readable without horizontal scrolling.
Every page title should be fully visible and not hidden behind the hamburger.
The login form should appear near the top of the screen on mobile, not the middle.
