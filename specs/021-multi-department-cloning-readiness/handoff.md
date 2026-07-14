# Handoff Report

## task_id
021-multi-department-cloning-readiness / externalize branding + seed script + clone checklist (2026-07-14)

## status
complete

## completed
- **Hardcoded department references audited.** Grepped `client/src` and `server` (excluding
  docs/design-system/generated files) for "Pharmacy", "SIMS College", "SIMS DMS". Found 10
  client-side text spots + 6 server-side text spots hardcoding the Pharmacy institution name
  or the "SIMS DMS" app short name. `TELEGRAM_BOT_TOKEN` was already env-driven — confirmed no
  code hardcodes it. Two test-fixture uses of `department: 'Pharmacy'`
  (`server/tests/auth.test.mjs`, `users.test.mjs`) are sample data, not hardcoding — left as-is.
- **Branding externalized.**
  - `client/src/utils/branding.js` (new) — exports `INSTITUTION_NAME` /
    `APP_SHORT_NAME` from `import.meta.env.VITE_*`, falling back to the current Pharmacy
    values. Wired into `LoginPage.jsx`, `ChangePasswordPage.jsx`, `Layout.jsx`,
    `DashboardPage.jsx` (faculty), `AdminDashboardPage.jsx`, `PWAUpdatePrompt.jsx`, `App.jsx`.
  - `server/lib/branding.js` (new) — exports `APP_SHORT_NAME` from `process.env.APP_SHORT_NAME`.
    Wired into `server/lib/bot.js` (7 Telegram message strings), `server/lib/pdf.js` (PDF report
    header), `server/controllers/users.controller.js` (admin password-reset Telegram message),
    `server/index.js` (startup log line), `server/scripts/backfill-passwords.mjs` (legacy
    one-time backfill message).
  - `client/index.html` now uses Vite's native `%VITE_INSTITUTION_NAME%` / `%VITE_APP_SHORT_NAME%`
    HTML replacement for `<title>`, meta description, and apple-mobile-web-app-title — confirmed
    at build time that the placeholders resolve correctly (see commands below), not left literal.
  - Added `VITE_INSTITUTION_NAME` / `VITE_APP_SHORT_NAME` to `client/.env.example` and
    `client/.env` (client/.env is gitignored, so this only fixes the local dev build — a fresh
    clone must set its own). Added `APP_SHORT_NAME` to root `.env.example` only (server has a
    working code fallback, so `server/.env`'s real secrets file was left untouched rather than
    edited for a non-required cosmetic var).
  - **Not templated — logo image and `client/public/manifest.json`.** The logo is a build-time
    ES import (`sims-logo.png`); `manifest.json` is explicitly self-managed
    (`vite.config.js` → `VitePWA({ manifest: false })`), so neither picks up env vars.
    Documented as manual per-clone edits in the checklist instead of over-engineering a
    templating layer for two files.
- **`db/seed-department.mjs`** (new) — idempotent CLI script. Takes `--institution`,
  `--admin-email`, `--admin-name`, `--admin-telegram-id` (optional — a user with no Telegram
  can still log in per Constitution §4), `--admin-phone`, `--admin-designation`,
  `--admin-password`. Creates the first Super Admin (mirrors `prisma/seed.js`'s bootstrap logic,
  parameterized instead of env-only), seeds a generic non-pharmacy-flavored default violation-type
  list (dropped "lab coat" / "haircut" from the existing `prisma/seed-violation-types.js`, kept
  the rest, replaced with "Dress code violation"), and creates the `system_config` row via
  Prisma schema defaults if missing. `prisma/seed.js` and `prisma/seed-violation-types.js` were
  left untouched — they remain this (Pharmacy) instance's own bootstrap path.
  Added `npm run seed:department` to root `package.json`.
- **`deploy/clone-checklist.md`** (new) — human-readable runbook: copy repo → new Telegram bot →
  new Railway project/Postgres → env var table → manual branding-asset swap (logo, manifest,
  icons) → run seed script → deploy → update the *new* repo's own CONSTITUTION.md/API-doc
  title lines → verification checklist. Explicitly states what's shared (all business
  logic/schema/endpoints) vs. per-department (branding, bot, DB, secrets).
- **`SIMS_API_Endpoints_v2.0.md`** — added a short pointer blockquote after the title
  referencing the new checklist; did not touch the Pharmacy-specific title/content itself.
- **CONSTITUTION.md deliberately NOT touched** — asked the owner directly given the file's own
  "do not modify without project owner approval" rule; owner chose to skip it entirely and keep
  all cloning guidance in `deploy/clone-checklist.md` instead (see
  `open_questions_for_owner` — resolved, not actually open).
- **Build verified**: `npm run build` (root) and `npx vite build` (client) both pass clean,
  0 errors, and the built `dist/index.html` was inspected directly to confirm the `%VITE_*%`
  placeholders resolved to real values rather than staying literal. `npx vitest run` (server):
  98/98 pass, including `bot.test.mjs` which exercises the Telegram message strings that were
  edited — no regressions.

## failed_or_blocked
- Nothing blocked. `db/seed-department.mjs` was syntax-checked (`node --check`) and its
  `--help` path was run successfully (confirms module resolution for `bcryptjs` and
  `@prisma/client` interop works from the new `db/` folder), but the actual seeding logic was
  **not** executed against a live database — doing so would have written test data into this
  session's real Pharmacy dev/production database, which wasn't requested.

## commands_run
```
npx vite build                                    # client: builds clean, PWA SW regenerated
grep title/description/apple-mobile-web-app-title dist/index.html   # confirmed %VITE_*% resolved
node -e "require('./lib/branding'); require('./lib/bot'); ..."      # server modules load OK
npx vitest run                                    # server: 98/98 pass (run twice, before/after)
npm run build                                     # root workspace build: passes
node --check db/seed-department.mjs               # syntax OK
node db/seed-department.mjs --help                # confirms CLI parsing + module loading, no DB hit
node -e "JSON.parse(...)" on package.json and client/public/manifest.json  # still valid JSON
```

## constraints_discovered
- `client/.env` and root `.env`/`server/.env` are all gitignored (`.gitignore:5`) — safe to add
  non-secret defaults directly to `client/.env` for local dev/build without any commit risk.
- Vite's `%VITE_VAR%` HTML-replacement in `index.html` requires the variable to actually be
  defined somewhere in the resolved env (`.env` here) — referencing an undefined one would have
  failed the build, not silently left the placeholder literal. This is why `client/.env` needed
  the two new vars added, not just `client/.env.example`.
- `VitePWA` is configured with `manifest: false` (`client/vite.config.js`) — `manifest.json` is
  hand-maintained, not generated from the plugin config, so it can't inherit `VITE_*` env vars
  without a templating step that wasn't built (kept as a documented manual edit instead — see
  clone checklist §5).
- `@prisma/client`'s generated output lives specifically at
  `server/node_modules/@prisma/client` (not hoisted to root despite npm workspaces) — the new
  `db/seed-department.mjs` mirrors the exact same relative require path pattern already used by
  `prisma/seed.js` and `prisma/seed-violation-types.js`.
- `bcryptjs` and `dotenv` *are* hoisted to root `node_modules`, so a plain `import` from the new
  top-level `db/` folder resolves them fine via normal Node module resolution.
- The existing `prisma/seed-violation-types.js` list is pharmacy-flavored ("Improper uniform /
  not in lab coat", "Haircut / grooming violation") — not reused verbatim in the new department
  seed script; replaced with more generic equivalents.

## deviations_from_constitution
- None to the *code*. One process deviation from the original task instructions: the task
  asked for the seed/setup process to "update CONSTITUTION.md ... to reflect the new
  department name (as a stub)". Given CONSTITUTION.md's own explicit "do not modify without
  project owner approval" clause, and that this repo is still the live Pharmacy production
  instance (not an actual new-department clone), I surfaced this conflict to the owner via
  `AskUserQuestion` rather than silently rewriting a governance document. Owner chose to skip
  CONSTITUTION.md edits entirely — guidance now lives only in `deploy/clone-checklist.md` §8,
  which instructs a *future* cloned repo's own team to update their own copy.

## files_touched
- client/src/utils/branding.js — NEW
- server/lib/branding.js — NEW
- db/seed-department.mjs — NEW
- deploy/clone-checklist.md — NEW
- specs/021-multi-department-cloning-readiness/handoff.md — NEW (this file)
- client/index.html — %VITE_*% HTML replacement for title/description/apple-mobile-web-app-title
- client/.env.example — added VITE_INSTITUTION_NAME, VITE_APP_SHORT_NAME
- client/.env — added same two vars (gitignored, local-only)
- .env.example (root) — added APP_SHORT_NAME
- client/src/App.jsx — SplashScreen brand text
- client/src/components/Layout.jsx — sidebar + mobile-header brand text
- client/src/components/PWAUpdatePrompt.jsx — update-available toast message
- client/src/pages/auth/LoginPage.jsx — logo alt text + institution name
- client/src/pages/auth/ChangePasswordPage.jsx — institution name + version footer
- client/src/pages/faculty/DashboardPage.jsx — zero-state welcome message
- client/src/pages/admin/AdminDashboardPage.jsx — header subtitle
- server/index.js — startup log line
- server/lib/bot.js — 7 Telegram message strings
- server/lib/pdf.js — PDF report header
- server/controllers/users.controller.js — admin password-reset Telegram message
- server/scripts/backfill-passwords.mjs — legacy backfill Telegram message
- SIMS_API_Endpoints_v2.0.md — added cloning pointer blockquote after title
- package.json — added `seed:department` script

## open_questions_for_owner
- None outstanding — the CONSTITUTION.md question was asked and resolved during this session
  (owner chose "skip entirely").
- Worth deciding later (not blocking): should `client/public/manifest.json` get an actual
  build-time templating step (e.g. a small pre-build script that writes it from the same
  `VITE_*` vars) instead of a manual per-clone edit? Only worth it once you're cloning to a
  third or fourth department and the manual step starts to sting.
