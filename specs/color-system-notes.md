# Color System — Deferred Notes & Backlog

> **Status: NOT scheduled work.** This is a backlog reference for a future session or a
> future project. The color system currently **works correctly** as verified in production
> (light + dark, desktop + mobile). Nothing here is a live bug — the concrete live bugs
> (indigo-tint tree-shaking, hardcoded-hex duplicates) were already fixed. See the commit
> that closed "Fix A + F" and `specs/001-auth-user-accounts/handoff.md`.
>
> Do **not** start any of this without an explicit decision from the project owner. In
> particular, the single-source-of-truth Mantine refactor (item C) was **intentionally
> declined** as too big a structural change for this project's current stage.

## Background: three parallel color systems

The app defines color in three places that are kept aligned **by hand**:

| Layer | Location | Dark mode via | Consumed by |
|-------|----------|---------------|-------------|
| 1. Tailwind `@theme` `--color-*` | `client/src/index.css` (`@theme {}`) | `html.dark {}` CSS override | utility classes (`bg-emerald-bg`) + inline `var()` |
| 2. Raw `:root` `--*` ramps | `client/src/index.css` (`:root {}`) | partial / none | **nobody (dead)** |
| 3. Mantine `colors` ramps | `client/src/App.jsx` (`createTheme`) | Mantine shade-index selection | Mantine components only |

They work today because the hex values happen to line up and a sync comment in `App.jsx`
reminds maintainers to update both. The items below are the structural friction that
comment is papering over.

---

## B — Success/warning colors have four different names

The same two semantic colors are named differently in each layer:

| Concept | CSS / Tailwind | Mantine ramp | `StatCard` accent key | `StatPill` color key |
|---------|----------------|--------------|-----------------------|----------------------|
| success | `emerald`      | `green`      | `green` → emerald     | `green` → emerald    |
| warning | `amber`        | `yellow`     | `yellow` → amber      | `amber` → amber      |

`StatCard` (`components/ui/StatCard.jsx`) and `StatPill` (`pages/admin/AttendanceLivePage.jsx`)
don't even agree with each other on whether warning is keyed `yellow` or `amber`. A dev must
memorize the per-component mapping.

**Future fix:** pick one vocabulary (recommend `success`/`warning`/`danger`/`info` semantic
names, or commit to `emerald`/`amber` everywhere) and alias the others to it.

## C — Mantine ramps are a hand-synced second source of truth (DECLINED for now)

`App.jsx` hardcodes 10-shade hex arrays that "MUST stay in sync" with `index.css @theme`
(their own comment). Worse, the two layers do dark mode by different mechanisms:

- CSS tokens **hard-invert** on `html.dark` (e.g. `--color-slate-50` flips light→dark).
- Mantine keeps the **fixed** arrays and swaps which shade index it reads.

So a Mantine `<Badge color="gray">` and a Tailwind `bg-slate-200` can render **different**
colors in dark mode. This is structural, not a discipline problem.

**Future fix (option 3, intentionally declined):** drive Mantine from the `@theme` CSS
variables (Mantine v7 `cssVariablesResolver` / `--mantine-color-*` mapping) so there is one
source of truth and dark mode is handled once. This is a real improvement but a sizable
refactor touching every Mantine component's theming — **not** worth it at the current stage.

## D — M3 surface tiers are not first-class Tailwind tokens ✅ RESOLVED

**Done.** The tiers were promoted into `@theme` as `--color-surface-container-low/-/-high`, so
`bg-surface-container-*` utilities now generate and the old `:root` duplicates were removed
(single source of truth). Adopted on the faculty dashboard, empty states, and the Reports inner
stat grids. Also added a `--page-canvas` token (subtle blue-tinted radial gradient in light,
flat in dark) applied to the app-shell main so white cards separate from the background.

Original problem (kept for context): the tiers lived only in `:root` + `html.dark`, not
`@theme`, so no `bg-surface-container-*` utility existed and they could only be used via inline
`style={{}}` — which is why adoption had been stuck at just `StatCard`.

## E — Dead duplicate token layer

The raw `:root` color ramps in `index.css` (`--blue-*`, `--slate-*`, `--emerald-*`,
`--amber-*`, `--red-*`, `--cyan-*`, `--purple-*`, `--orange-*`, ~27 tokens) are **referenced
nowhere** in the app (only their own defining block mentions them, in a comment). They also
have **incomplete** dark-mode coverage — e.g. `--blue-700` / `--blue-800` are never inverted
while their `--color-blue-700/800` twins are — so anyone who *did* start using them would get
wrong values in dark mode.

**Future fix:** delete the dead raw ramps. Keep only the semantic raw tokens that are actually
used (`--surface-*`, `--text-*`, `--brand*`, `--border*`, `--radius-*`, `--space-*`,
`--shadow-*`, `--control-*`, `--selection-*`). Verify with a grep for `var(--<name>)` before
removing each.

---

## Original M3 naming-convention tasks (carried over)

These were part of the M3 tonal-system work and were never completed:

- **On-color pairing docs.** M3's model pairs every container/surface role with a matching
  "on-" foreground (e.g. `on-primary`, `on-secondary-container`) guaranteed to meet contrast.
  The codebase has `--text-on-dark` / `--text-on-brand` but no documented, complete pairing
  table. Document which text token is the guaranteed-legible foreground for each surface/accent
  token, in **both** themes. Optionally encode the pairings as tokens.
- **Named type scale.** The type scale is numeric px tokens (`--text-stat`, `--text-h2`,
  `--text-body`, …). M3 uses role-named styles (display / headline / title / body / label,
  each with size + weight + line-height + tracking bundled). Consider a role-named scale so
  typography is chosen by role, not raw px, matching how the color roles are meant to work.
- **Complete the indigo family (or don't).** `--color-indigo-tint` was removed in the Fix A
  cleanup because it was half-shipped and unused (see `index.css` note). If indigo is meant to
  be a full first-class status family like emerald/amber, re-add `-tint` **and reference it**
  so it survives Tailwind tree-shaking. Otherwise leave indigo with just bg/text/solid/border.

---

## Guardrail worth remembering (root cause of Fix A)

Tailwind v4 **tree-shakes `@theme` variables that are not referenced anywhere in scanned
source**. A `--color-*` token added to `@theme` but never used (no utility class, no literal
`var(--…)` in a `.jsx`/`.css` file) will be **dropped from the light-mode bundle**. If that
same token also has an `html.dark {}` override (a plain rule, never shaken), you get a token
that is **empty in light mode and colored in dark mode** — exactly the indigo-tint bug.

**Rule:** when adding a `@theme` color token, reference it in the same change, or don't add it.
