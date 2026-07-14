# SIMS DMS — Design System

A design system for the **SIMS Discipline Management System (SIMS DMS)** — a mobile-first
PWA built for **SIMS College of Pharmacy** to digitize faculty discipline duties: monthly
slot scheduling, attendance (In/Out) tracking, and student violation logging, with a
Telegram-OTP login flow.

This system captures the product's real visual language — a slate-neutral, blue-accented,
data-dense UI tuned for 390px phones first — as reusable tokens, components, foundation
specimen cards, and a click-through Faculty PWA recreation.

## Sources

Built by reading the product's own front-end code. Explore these to go deeper:

- **GitHub:** [`Joseph5157/SIMSDMS`](https://github.com/Joseph5157/SIMSDMS) (branch `001-auth-user-accounts`)
  — primary source. Tokens lifted from `client/src/index.css` (`@theme`) and
  `client/src/utils/constants.js`; components from `client/src/components/ui/*`; layout +
  rules from `MOBILE_DESIGN_RULES.md`; screens from `client/src/pages/**`.
- Related repos by the same author (context only, not used directly):
  [`Joseph5157/SDMS`](https://github.com/Joseph5157/SDMS),
  [`Joseph5157/Sims`](https://github.com/Joseph5157/Sims),
  [`Joseph5157/openSIS-Classic`](https://github.com/Joseph5157/openSIS-Classic).

The reader is encouraged to browse the SIMSDMS repository for additional screens and copy
when building new designs against this product.

---

## CONTENT FUNDAMENTALS

How SIMS DMS writes copy:

- **Voice — direct, second person, task-first.** The app talks *to* the user about *their*
  next action: "You have duty today", "Check your upcoming slots below", "Enter your email
  address to receive your OTP". Headings are imperative ("Sign in", "Enter OTP", "Record
  Violation").
- **Greeting personalization.** Dashboards open with a time-aware, first-name greeting:
  "Good morning, Priya" / "Welcome, Priya", followed by a long-form date
  ("Thursday, 13 March 2025", `en-IN` locale).
- **Casing.** Sentence case for headings and body. **UPPERCASE** only for small labels —
  section headers, field labels, stat-card labels (11px, semibold/bold, `0.06–0.08em`
  tracking). Never all-caps for sentences.
- **Status language is a fixed lexicon.** Statuses always render through the badge map:
  *Active, Pending, Awaiting Telegram, Open, Covered, Expired, Cover needed, Scheduled,
  Completed, Absent, On time, Late, Checked in, Checked out, Flagged.* Reuse these exact
  words — don't invent synonyms.
- **Counts are spelled into sentences with correct pluralization:** "3 accounts awaiting
  approval", "1 open cover request — awaiting a volunteer", "2 users haven't linked
  Telegram yet". Singular/plural is always handled.
- **Numbers & money.** Fines in Indian rupees (`₹50`, `₹200`). Times in 12-hour IST
  ("9:15 AM", "4:30 PM"). Dates as "13 Mar" (compact) or full long form.
- **Arrows & affordances in copy.** Primary actions end with "→" ("Send OTP →",
  "Verify & Sign in →", "View →"). "Tap to…" phrasing on mobile alerts.
- **Emoji as functional glyphs, not decoration.** Used as compact iconography in nav,
  stat-card labels, quick actions, and alerts (🎓 brand, 📋 attendance, ⚠️ violations,
  🔄 cover, ✈️ Telegram, ⏳ pending, ⚑ flagged, ✅ done). One per element, leading position.
- **Tone — calm, operational, reassuring.** Empty states are encouraging, not blank
  ("No duty today" + "Check your upcoming slots below"). Errors are plain and actionable
  ("OTP expired. Send a new one", "Account locked — Contact your Admin to reset").

---

## VISUAL FOUNDATIONS

- **Color vibe.** Cool, professional, slate-on-white. Neutral backbone is the Slate ramp
  (`#f8fafc` page → `#0f172a` ink/sidebar). A single brand blue (`#2563eb`) carries every
  primary action. Status tints (emerald/amber/red/cyan/purple/orange) are always the
  *light tint + dark ink* pairing seen in badges and stat cards — never saturated fills for
  large areas. No teal/coral, no brand purple except the `super_admin` role + the brand
  gradient.
- **The one gradient.** `linear-gradient(135deg, #3b82f6, #6366f1)` (blue→indigo) is
  reserved for the **brand mark tile** and large primary CTAs on the dark login screen.
  Everywhere else, flat fills. No rainbow or mesh gradients.
- **Type.** `DM Sans` for everything; `DM Mono` for codes, OTP digits, IDs, and timers.
  A tight, role-based scale (40 stat / 28 display / 22 h2 / 18 page-title / 15 body / 13 /
  12 / 11 micro). Weights run 400–800; stat numbers and hero headings are 800 with
  `-0.02em` tracking. This is a dense data app — sizes stay small and purposeful.
- **Backgrounds.** Solid `#f8fafc` app canvas; white cards. The login screen is the one
  rich surface: dark slate with faint radial blue/indigo glows and a white form sheet that
  slides up with `28px` top corners. No photography, no illustration, no texture or pattern.
- **Corner radii.** Generous but consistent: `12` buttons/alerts, `14` cards & inputs,
  `16` mobile list containers & hero panels, `20` brand mark, `28` bottom sheets, full
  pills for badges & avatars.
- **Cards.** White, `1px #e2e8f0` border, `14–16px` radius, very soft shadow
  (`0 1px 3px rgb(0 0 0 / 0.06)`). Edge-to-edge list cards divide with `1px #f1f5f9`
  hairlines (no gaps). **Stat cards** add a `4px` colored left accent bar (RULE 5).
  **Alerts** add a `3px` colored left border on a tinted fill.
- **Shadows.** Soft and low-spread. A small card shadow, a slightly stronger dropdown, a
  deep modal/sheet shadow, and one **brand glow** (`0 8px 32px rgba(59,130,246,0.35)`) under
  the login mark and primary CTA.
- **Borders & dividers.** Hairlines everywhere: `#e2e8f0` for structural borders, `#f1f5f9`
  for in-card dividers, `#cbd5e1` for stronger separators.
- **Motion.** Restrained. State changes use `150ms ease` on color/background/border. The
  mobile drawer and login sheet slide with `cubic-bezier(0.4, 0, 0.2, 1)` (~280ms). A single
  spinner keyframe for loading. **No bounce, no decorative loops, no parallax.**
- **Hover / press.** Buttons darken one step on hover (`blue-600 → blue-700`) and another on
  active (`→ blue-800`); secondary/ghost shift to a slate tint. List rows tint to `#f8fafc`
  on hover. No scale/translate on press. Disabled = `0.5` opacity, not-allowed cursor.
- **Focus.** `2px` blue outline (`#3b82f6`) with `2px` offset, plus a `3px` soft brand ring
  on inputs (`rgba(59,130,246,0.30)`). Always visible — accessibility matters on shared
  devices.
- **Transparency & blur.** Used sparingly: the mobile drawer backdrop is
  `rgba(0,0,0,0.5)` with a light `blur(2px)`; login glows are low-alpha radial gradients.
  No frosted-glass panels.
- **Layout rules (from `MOBILE_DESIGN_RULES.md`).** Mobile-first at 390px. Page padding
  `16px` (phone) / `28px` (desktop). Tables become **card lists** on mobile. Stat cards are
  always a 2- or 3-col grid. Touch targets ≥ `44px`. Sections always carry an uppercase
  label. Desktop adds a fixed `220px` dark sidebar; mobile uses a fixed `60px` bottom tab
  bar + "More" drawer.

---

## ICONOGRAPHY

- **Primary icon set: [Lucide](https://lucide.dev).** The product imports Lucide React
  (`LayoutDashboard, Users, GraduationCap, Calendar, ClipboardCheck, AlertTriangle, Tag,
  ArrowLeftRight, Mail, BarChart3, LogOut, ChevronRight, …`) at small sizes (13–15px,
  stroke width 2) for the **desktop** sidebar and inline affordances. Lucide is
  CDN-available — load it from `https://unpkg.com/lucide@latest` (or `lucide-react`) and
  keep `size={15} strokeWidth={2}`.
- **Emoji as functional iconography.** On **mobile** (bottom tab bar, drawer grid, stat-card
  labels, quick actions, alerts) the product uses a fixed emoji vocabulary instead of an icon
  font: 🎓 brand · 📊 dashboard · 👥 users · 🎓 students · 📅/📆 calendar/slots · ✅
  attendance · ⚠️ violations · 🏷️ types · 🔄 cover · ✉️ messages · ⏳ pending · ⚑ flagged ·
  ✈️/📲 Telegram · 🔑 sessions · 📋 audit/check-in. Use these exact glyphs; one per element,
  leading position. This is intentional — keep it.
- **No custom SVG icon set, no icon font, no PNG sprites.** The repo's `icons.svg`/`hero.png`
  were unrelated starter-template boilerplate (Bluesky/Discord/X marks, a 3D box) and were
  **discarded** — they are not part of the brand. Do not reintroduce them.
- **Brand mark.** There is no standalone logo file. The mark is a **🎓 graduation cap on the
  blue→indigo gradient tile** — rebuild it with the `BrandMark` component (or the gradient
  tokens). Wordmark is "SIMS DMS" in DM Sans 700.

---

## Index / manifest

**Root**
- `styles.css` — the single global entry point (consumers link this). `@import`s only.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `base.css`.
- `guidelines/` — foundation specimen cards (Type, Colors, Spacing, Brand).
- `components/` — reusable React primitives (below).
- `ui_kits/` — full-screen product recreations.
- `SKILL.md` — Agent-Skill manifest for use in Claude Code.

**Components** (`window.SIMSDMSDesignSystem_019e12.*`)
- `core/` — **Button**, **Badge**, **StatCard**, **Avatar**, **Card**
- `forms/` — **Input**, **Select**
- `feedback/` — **Alert**
- `patterns/` — **SectionHeader**, **MobileCard**, **EmptyState**, **BrandMark**

**UI kits**
- `ui_kits/faculty-pwa/` — interactive Faculty mobile PWA (login → dashboard → attendance →
  violations → slots → messages).
- `ui_kits/admin-desktop/` — Admin desktop (1280×720 dark sidebar layout): Users page with
  filter bar, user table, **Pending Invites section**, Create User Drawer (invite-only).

## Invite-only onboarding flow (branch `001-auth-user-accounts` + PR redesign)

The product moved from direct user creation to an **invite-link flow** in June 2026. Key changes reflected in this design system:

| Change | Impact on DS |
|---|---|
| `CreateUserDrawer` — Telegram ID field removed; always generates invite link | `invited` / `invite_expired` Badge statuses added |
| `UsersPage` — new **Pending Invites** section (amber tint, list of outstanding links) | Admin Desktop UI kit shows the full section |
| `POST /invites` replaces `POST /users`; `GET /invites` returns pending list | Mock data in `ui_kits/admin-desktop/AdminScreens.jsx` |
| `POST /admin/users/:id/reset-login` now returns `relink_link` instead of temp password | `pending_telegram` status covers the relink state (same badge, new flow) |
| Old `POST /users`, `GET /users/pending`, `POST /users/:id/regenerate-invite` → 410 GONE | Deprecated patterns removed from UI kit |

**New `BadgeStatus` values:** `invited` (blue tint, "Invite sent") · `invite_expired` (red, "Link expired").

**Pending Invites section copy pattern:**
> "3 pending invites · Links expire after 7 days — regenerate to extend"
> Row actions: **Regenerate** (extends expiry) · **✕** (cancel/delete)
> On creation success: "Account created. Share this link with [Name]." → copy + WhatsApp share buttons.

## Using the system

Link the stylesheet and read components off the namespace:

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
<script>
  const { Button, Badge, StatCard, Alert } = window.SIMSDMSDesignSystem_019e12;
</script>
```

## Caveats

- **Fonts load from the Google Fonts CDN** (`tokens/fonts.css`), not self-hosted binaries —
  DM Sans and DM Mono are pixel-identical to the product's `@fontsource` build. If you need
  offline/self-hosted `.woff2` files, ask and we'll vendor them in.
- This system covers the **Faculty** mobile surface in depth; the Admin / Super-Admin desktop
  surfaces (sidebar layout, data tables, reports) are documented in tokens + components but
  not yet built as a full UI kit.
