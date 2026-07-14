---
name: sims-dms-design
description: Use this skill to generate well-branded interfaces and assets for SIMS DMS (the SIMS College of Pharmacy Discipline Management System), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick map
- `readme.md` — full brand guide: content voice, visual foundations, iconography, manifest.
- `styles.css` — global entry point; `@import`s every token + base file. Link this one file.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `fonts.css`, `base.css`.
- `guidelines/` — foundation specimen cards (Type / Colors / Spacing / Brand).
- `components/` — React primitives: Button, Badge, StatCard, Avatar, Card, Input, Select,
  Alert, SectionHeader, MobileCard, EmptyState, BrandMark. Each has a `.prompt.md` with usage.
- `ui_kits/faculty-pwa/` — interactive Faculty mobile PWA (login, dashboard, attendance, violations, slots, messages).
- `ui_kits/admin-desktop/` — Admin desktop (1280×720): users table, Pending Invites section, invite-only Create User drawer.

## Essentials
- **Mobile-first, 390px.** Slate neutrals, one brand blue (`#2563eb`). DM Sans + DM Mono.
- **Icons:** Lucide (desktop, 15px/stroke-2) + a fixed emoji vocabulary (mobile). No custom SVG set.
- **Cards** white, 14–16px radius, hairline border, soft shadow; stat cards get a 4px left
  accent bar; alerts get a 3px left border on a tint.
- Reuse the **status lexicon** verbatim (Active, Late, Cover needed, Checked in, …).
- Restrained motion (150ms ease); no bounce, no decorative loops.

To reuse components in an HTML artifact, link `styles.css`, load `_ds_bundle.js`, then
`const { Button, Badge } = window.SIMSDMSDesignSystem_019e12`.
