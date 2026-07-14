# Handoff Report

## task_id
012-frontend-design-consistency-audit / full audit + fix batches A-C + cleanup pass + label a11y + polish

## status
complete

## completed
- **Preceding this batch, same session**: removed the "system" theme mode (light/dark only) in
  `client/src/lib/theme.js`, and fixed the mobile bottom tab bar being hardcoded to dark navy
  in both themes (`client/src/components/Layout.module.css` / `Layout.jsx`) — commit `a730083`.
- **Read-only audit** of `client/src/` across 7 categories (design token consistency, dark-mode
  coverage, Mantine-vs-custom component drift, responsive/mobile-first violations, accessibility
  regressions, empty/loading/error state consistency, typography/spacing rhythm), done via 3
  parallel research agents, then synthesized into a severity-ranked report (🔴 breaks in
  production / 🟠 visually inconsistent / 🟢 minor polish). No files touched during the audit
  itself.
- **Batch A — broken/undefined CSS token references** (commit `0596519`):
  - `utils/constants.js`: `reassigned` badge referenced `bg-indigo-tint`, a CSS var that was
    **never defined** anywhere in `index.css` (badge rendered with no background at all) →
    `bg-indigo-bg`. `upcoming` badge used `text-blue-600`, which has **no `html.dark` override**
    (only 50/100/200/700/800 are overridden) → ~2.2:1 contrast in dark mode → `text-blue-700`
    (already dark-mode-mapped, ~6.4:1).
  - `pages/shared/MessagesPage.jsx`: duplicated the same broken `blue-600` pill, fixed identically.
  - `components/UploadStudentsDrawer.jsx`: `var(--color-blue-bg)` doesn't exist (blue ramp only
    has `-50`, not `-bg`) → dry-run panel had no background → `var(--color-blue-50)`.
- **Batch B — keyboard accessibility dead-ends** (commit `0596519`):
  - `components/ui/Table.jsx`: shared `Tr` component now gets `role="button"`/`tabIndex`/
    `onKeyDown` (Enter/Space) whenever `onClick` is passed — fixes every clickable table row
    app-wide from one place.
  - `pages/admin/StudentsPage.jsx`: same fix applied standalone to the mobile student card (was
    a bare `<div onClick>`, fully unreachable via keyboard); also removed 3 inline
    `style={{outline:'none'}}` overrides that were silently killing the global `:focus-visible`
    ring (inline style wins over the CSS rule regardless of source order).
  - `components/NotificationBell.jsx`: message list items had `role="button" tabIndex={0}` but
    no `onKeyDown` — looked accessible, Enter/Space did nothing. Added the handler.
- **Batch C — swallowed query errors** (commit `0596519`):
  - `pages/admin/ReportsPage.jsx`: daily/weekly report modes hardcoded `isError={false}`,
    actively discarding real query errors — now wired to the real `isError`/`refetch` from
    `useDailyViolationReport`/`useWeeklyViolationReport`.
  - `pages/shared/MessagesPage.jsx`: inbox/sent list and `ThreadPanel` never destructured
    `isError` — a failed fetch showed infinite "Loading…" with no retry. Added error+retry
    branches to both.
- **Cleanup pass** (commit `3a04951`):
  - Deleted `components/ui/PageHeader.jsx` — confirmed zero imports anywhere; every page actually
    imports a *different* `PageHeader` re-exported from `Layout.jsx`. Dead duplicate.
  - `pages/admin/AttendanceLivePage.jsx`: `border-l-green-500` (only fully off-palette Tailwind
    class found in the whole tree — theme has no "green" family, only "emerald"). While fixing
    it, noticed the adjacent `border-l-amber-500`/`border-l-red-500` in the same ternary have the
    *same* underlying bug — amber/red only define `-600`/`-700`/`-tint`/`-solid`/etc. in the
    theme, not `-500`, so those were also silently falling back to Tailwind's un-themed default
    shade. Swapped all three to `-600`, confirmed identical hex in light and dark theme blocks.
  - `components/NotificationBell.jsx`: added `Escape`-key handling to close the dropdown and
    return focus to the trigger button (it's a fully custom dropdown, unlike Mantine
    Menu/Drawer elsewhere which get this for free); unread-badge ring was hardcoded
    `border-white` → `border-[var(--surface-card)]` (verified both mobile and desktop headers
    the bell renders in use `var(--surface-card)` as background, so this is correct in both
    themes and both placements).
  - `utils/constants.js`: `hidden` status badge was `text-slate-400` on `bg-slate-100` (~2.5:1,
    real AA failure) → `text-slate-500`, matching the already-established `inactive`/
    `not_checked_in` pairing (codebase's own comment documents that pairing as ~4.6:1,
    AA-passing).
- **Label association fix** (commit `6d4b835`): `ProfileDrawer.jsx` and `ComposeDrawer.jsx`'s
  shared local `FieldLabel` rendered a bare `<label>` with no `htmlFor`, paired inputs had no
  `id` — screen readers announced Name/Department/Designation/Title/Email and To/Subject/Message
  fields with no accessible name. Added matching `htmlFor`/`id` pairs on every field in both
  drawers.
- **Polish pass** (commit `ace0440`):
  - `ProfileDrawer.jsx`: avatar-picker grid `grid-cols-4` → `grid-cols-3 sm:grid-cols-4` (was
    cramped at 375px).
  - `components/faculty/PendingReassignmentRequests.jsx`: loading and "no pending requests" both
    rendered `null`, indistinguishable. Loading now shows a small skeleton block matching the
    widget's own rounded-card shape (not the generic table skeleton); only collapses to nothing
    once confirmed empty.
- **Verification per batch**: `npx eslint <touched files>` + `npm run build --workspace=client`
  after every batch. All pre-existing lint errors surfaced (2 in `NotificationBell.jsx`/
  `StudentsPage.jsx`/`ComposeDrawer.jsx`/`ProfileDrawer.jsx` — unused `user` param,
  `react-hooks/set-state-in-effect`) were confirmed via `git diff --unified=0` to be **outside**
  every line touched in this batch — pre-existing, not introduced. No UI smoke-test in a live
  browser was done for this batch beyond the earlier theme/bottom-nav work (which was verified
  live via chrome-devtools MCP, light+dark, at commit `a730083`) — these were narrower,
  build/lint-verified code fixes, not new user-facing flows.

## failed_or_blocked
- None. Everything attempted in this batch was completed.

## commands_run
```
npm run build --workspace=client         # clean after every batch (4 times)
npx eslint <touched files>               # after every batch, non-zero-exit findings all
                                          # confirmed pre-existing via git diff --unified=0
git add / git commit / git push          # 4 commits to origin/005-duty-reassignment:
                                          #   0596519, 3a04951, 6d4b835, ace0440
                                          # (preceded by a730083, same session, theme work)
```

## constraints_discovered
- **Tailwind v4's `@theme` block auto-generates utility classes from custom tokens.** Classes
  like `text-blue-600`, `bg-slate-100`, `border-emerald-border` are token-driven and correct —
  NOT "raw Tailwind classes" to flag in a design-token audit. Only palettes *not* defined in
  `@theme` (gray/teal/lime/rose/fuchsia/neutral/zinc/stone/yellow/pink/sky/violet — no "green"
  either, only "emerald") are true offenders. Important for any future token-consistency pass.
- **Partial color-family definitions are a silent trap.** `amber` and `red` in `index.css` only
  define `-bg/-tint/-text/-solid/-600/-700/-border` — no `-500`. A class like `border-l-amber-500`
  or `border-l-red-500` still "works" (Tailwind falls back to its own un-themed default hex for
  the undefined shade) but silently doesn't track the app's dark-mode overrides. Worth grepping
  for `-500` usage on amber/red/(any family missing that shade) in a future pass — this session
  only found it by coincidence while fixing an adjacent `green-500`.
- **The slate ramp intentionally inverts under `html.dark`** (`--color-slate-50` is `#f8fafc` in
  light, `#1e293b` in dark, etc.) — so `bg-slate-100`/`text-slate-600` etc. are dark-mode-safe by
  design. Don't flag slate-* usage in future dark-mode audits.
- **`--color-*-solid` tokens (emerald-solid, amber-solid, red-solid, etc.) are intentionally
  fixed across both themes** — confirmed by comparing the light `@theme` block against the
  `html.dark` override block (identical hex in both). This is the correct token to reach for when
  a color must stay saturated/legible regardless of theme (status dots, checkmarks) — don't try
  to "fix" these into theme-varying colors.
- **`--surface-sidebar` / `--color-sidebar*` and the mobile bottom nav are intentionally
  permanently dark navy in both themes** — confirmed with the project owner (`a730083` work);
  don't flag this as a dark-mode bug in future passes, it's deliberate nav-chrome styling.
- **Inline `style={{outline:'none'}}` silently defeats the global `:focus-visible` CSS rule**
  regardless of stylesheet source order, because inline styles always win the cascade. A
  className-based `outline-none` (Tailwind utility) does NOT have this problem here, because
  Tailwind's utility layer loads before the `:focus-visible` rule in `index.css`, so the later
  rule wins on the specificity tie — only the inline-style form is broken. Worth remembering
  before flagging every `outline-none` hit as broken; check whether it's inline vs. className.
- Chrome DevTools MCP (`mcp__chrome-devtools__*`) was usable for visual verification when the
  `claude-in-chrome` extension wasn't connected — `evaluate_script` can inject/toggle
  `document.documentElement.classList` and DOM elements directly for isolated visual checks
  without needing to log in past the auth-gated app shell.

## deviations_from_constitution
- None. This entire batch was pure frontend code-quality/consistency/accessibility work — no
  API endpoints, database schema, or business rules changed, so no `CONSTITUTION.md` version
  bump was made (consistent with the constitution's own scope, which tracks backend/API/schema/
  business-rule changes, not internal frontend styling conventions).

## files_touched
- `client/src/lib/theme.js` (system mode removed — `a730083`, precedes this batch's Batch A/B/C)
- `client/src/components/Layout.jsx`, `client/src/components/Layout.module.css`
  (bottom nav theme-aware — `a730083`)
- `client/src/utils/constants.js` (Batch A + cleanup pass — indigo-tint, blue-600, hidden badge)
- `client/src/pages/shared/MessagesPage.jsx` (Batch A + Batch C)
- `client/src/components/UploadStudentsDrawer.jsx` (Batch A)
- `client/src/components/ui/Table.jsx` (Batch B — shared `Tr` keyboard fix)
- `client/src/pages/admin/StudentsPage.jsx` (Batch B — mobile card + 3 outline removals)
- `client/src/components/NotificationBell.jsx` (Batch B, cleanup pass — onKeyDown, Escape,
  badge ring token)
- `client/src/pages/admin/ReportsPage.jsx` (Batch C — real isError/refetch)
- `client/src/components/ui/PageHeader.jsx` (deleted — cleanup pass, confirmed orphan)
- `client/src/pages/admin/AttendanceLivePage.jsx` (cleanup pass — amber/emerald/red -500→-600)
- `client/src/components/ProfileDrawer.jsx` (label a11y fix + polish pass — avatar grid)
- `client/src/components/ComposeDrawer.jsx` (label a11y fix)
- `client/src/components/faculty/PendingReassignmentRequests.jsx` (polish pass — loading state)

## open_questions_for_owner
- **`pages/NotificationsPage.jsx` is dead code** — the whole feature is gated behind
  `NOTIFICATIONS_ENABLED = false` and is unreachable. Needs a product decision: delete the page/
  route, or finish and ship it. Not touched in this batch (owner's call, not mine to make).
- **Deferred backlog, explicitly not scheduled** (owner reviewed and agreed to skip for now):
  - Button/filter-bar consolidation — no shared `Button.jsx`; raw `<button>` coexists with
    Mantine `<Button>` app-wide; `StudentsPage.jsx`/`UsersPage.jsx` use raw `<select>`/`<input>`
    filter bars while most other list pages use Mantine `Select`/`TextInput`. Real inconsistency,
    but a multi-file component-extraction project with real regression risk this close to
    launch — recommended as a dedicated post-launch pass, not squeezed into a fix sprint.
  - Loading/empty-state consolidation — 3 different empty-state treatments coexist
    (`EmptyState.jsx`, `Table.jsx`'s `EmptyRow`, ad hoc text divs) and most admin list pages
    fall back to bare `"Loading…"` text instead of the shared `Skeleton`/`CardSkeleton`
    components. Same story as Button consolidation — real, but a refactor not a bugfix.
  - Off-scale magic-number spacing/font-sizes (~30-40 scattered one-line literals across ~12
    files) — recommended fix-when-already-in-that-file, not a dedicated pass.
  - `App.jsx`'s Mantine `createTheme()` color ramps are hardcoded hex, duplicating `index.css`
    tokens — structurally required by Mantine's API (can't consume CSS custom properties), file
    already has its own drift-warning comment. Not actionable without a bigger runtime-theme-sync
    change; recommended to leave as-is permanently.
  - Dimension-only arbitrary width values (`max-w-[440px]`, `min-w-[200px]`, etc.) — no token
    scale exists for these and none is recommended; leave as-is permanently.
