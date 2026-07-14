# Clone Checklist — Standing Up a New Department

This is a human runbook, not a script. Follow it top to bottom when spinning
up a new department's instance of this app (e.g. Engineering, Science,
Medicine) from the SIMS Pharmacy codebase. Each department gets its **own**
repo copy, its **own** Railway project, its **own** Postgres database, and
its **own** Telegram bot — this app is single-tenant per deployment, not
multi-tenant (see `CONSTITUTION.md` §2 Infrastructure: monolithic, single
repo, single deploy). Cloning the repo *is* the multi-department strategy.

Budget about half a day for a first clone; faster once you've done one.

---

## 1. Copy the repo

- Use this repo as a GitHub template (or `git clone` + push to a new empty
  repo). Don't fork in a way that keeps a live link back to the Pharmacy
  repo — you want independent history so department-specific commits don't
  cross-pollinate.
- Rename the new repo to something that identifies the department (e.g.
  `sims-dms-engineering`).

## 2. Create a new Telegram bot

Each department needs its **own bot** — do not reuse the Pharmacy bot's
token. Messages, notifications, and `/resetpassword` all route through
whichever bot token is configured.

1. Message [@BotFather](https://t.me/BotFather) on Telegram → `/newbot`.
2. Name it something recognizable (e.g. "SIMS Engineering DMS Bot").
3. Save the token BotFather gives you — this becomes `TELEGRAM_BOT_TOKEN`.
4. Note the bot's `@username` (without the `@`) — this becomes
   `TELEGRAM_BOT_USERNAME`.
5. You'll register the webhook automatically the first time the server
   boots with `APP_URL` set correctly (see `server/index.js`
   `registerTelegramWebhook()`) — nothing manual to do here beyond getting
   the token.

## 3. Provision infrastructure on Railway

1. Create a **new Railway project** for this department (do not add it as
   an environment inside the existing Pharmacy project — full isolation,
   per §2 Infrastructure: "single repo, single deploy").
2. Add a **PostgreSQL** plugin to the new project — this becomes
   `DATABASE_URL` (Railway injects it automatically if you reference
   `${{Postgres.DATABASE_URL}}` in your service variables).
3. Connect the new GitHub repo as the deploy source. `railway.toml` at the
   repo root already defines the build/start commands
   (`npm run generate && npm run build`, then
   `npm run migrate:deploy && npm run start` on boot) — nothing to change
   there.

## 4. Set environment variables

Set these in Railway → your service → Variables (and mirror the ones you
need locally in `.env` / `client/.env` — both are gitignored, so local
copies never leak into the repo). Full reference: `.env.example` and
`client/.env.example` at the repo root.

| Variable | Where | New value for this department |
|---|---|---|
| `DATABASE_URL` | server (Railway auto-injects if using their Postgres plugin) | — |
| `APP_URL` | server | `https://<your-new-service>.up.railway.app` |
| `JWT_SECRET` | server | Generate a new 64+ char random secret — **never reuse the Pharmacy secret** |
| `JWT_EXPIRES_IN` | server | `7d` (same default is fine) |
| `TELEGRAM_BOT_TOKEN` | server | Token from step 2 |
| `TELEGRAM_BOT_USERNAME` | server | Bot username from step 2 |
| `TELEGRAM_WEBHOOK_SECRET` | server | Generate a new 64+ char random string — **never reuse the Pharmacy secret** |
| `APP_SHORT_NAME` | server | e.g. `SIMS Engg DMS` — used in Telegram messages, PDF report headers, startup log |
| `CORS_ORIGIN` | server | Your new frontend's exact URL, no trailing slash |
| `TZ` | server | `Asia/Kolkata` (or whatever timezone the new department's campus is in — this affects every check-in/cutoff/cron calculation) |
| `NODE_ENV` | server | `production` |
| `BOOTSTRAP_SUPER_ADMIN_*` | server | Only needed if you use `npm run seed` instead of `db/seed-department.mjs` (step 6) — see that script's own flags |
| `VITE_INSTITUTION_NAME` | client (build-time) | e.g. `SIMS College of Engineering` — shown on the login/change-password screens |
| `VITE_APP_SHORT_NAME` | client (build-time) | e.g. `SIMS Engg DMS` — shown in the nav bar, dashboards, PWA title/splash |

**`VITE_*` variables are baked in at build time**, not read at runtime —
if you change them after the first deploy, you must trigger a rebuild
(a new Railway deploy) for the change to take effect. `APP_SHORT_NAME`
(no `VITE_` prefix, server-side) takes effect on the next process restart,
no rebuild needed.

## 5. Swap branding assets (manual — not templated)

These are static files, not env-driven, so edit them directly in the new
repo before your first deploy:

- **Logo**: replace `client/src/assets/sims-logo.png` in place — keep the
  same filename so you don't have to touch the `import simsLogo from
  '../assets/sims-logo.png'` lines in `LoginPage.jsx`, `Layout.jsx`, and
  `App.jsx`. If you'd rather rename it, grep for `sims-logo.png` first
  (3 files) and update every import.
- **PWA manifest** (`client/public/manifest.json`): update `name`,
  `short_name`, and `description` by hand. This file is deliberately
  self-managed rather than generated (`vite.config.js` has
  `VitePWA({ manifest: false })`), so it does **not** pick up the
  `VITE_INSTITUTION_NAME` / `VITE_APP_SHORT_NAME` env vars automatically.
- **App icons** (`client/public/icons/*.png`, `favicon.svg`): swap if the
  new department wants distinct iconography; optional otherwise.
- **Theme color** (`client/index.html` `<meta name="theme-color">`,
  `manifest.json` `theme_color`/`background_color`): optional — only
  needed if the new department wants a different brand color from the
  shared Tailwind/Mantine token system described in
  `CONSTITUTION.md` §2 Frontend.

## 6. Run the department seed script

From the repo root, against the **new** database (make sure `DATABASE_URL`
in your local `.env` points at the new department's DB, not Pharmacy's,
before running this):

```bash
npm run migrate:deploy   # apply the schema to the fresh database
npm run generate         # generate the Prisma client if you haven't already

node db/seed-department.mjs \
  --institution "SIMS College of Engineering" \
  --admin-email admin@engineering.example.edu \
  --admin-name "Admin Name" \
  --admin-telegram-id 123456789
```

(`--admin-telegram-id` is optional — omit it if the admin isn't linking
Telegram yet; they can still log in with email + password and link
Telegram later from their Profile page. Get a Telegram numeric ID by
messaging the new bot and sending `/myid`.)

This creates the first Super Admin (prints a one-time temporary password
to the console — copy it now, it's never stored in plaintext), seeds a
generic set of default violation types (mobile phone use, dress code,
missing ID, late arrival, etc. — edit/add more from the Violation Types
page once logged in), and creates the `system_config` row with default
duty-timing thresholds (8:00 AM / 1:00 PM session starts — adjust from
Duty Timing Settings if the new department's schedule differs).

The script is idempotent — safe to re-run if it fails partway through;
it skips anything that already exists.

## 7. Deploy

- Push to the branch Railway is watching (or trigger a manual deploy).
- Watch the build logs for the `npm run build` step — confirm no errors.
- Once live, hit `https://<your-service>.up.railway.app/health` to
  confirm the server booted and migrations applied.
- Log in as the Super Admin using the temporary password from step 6 —
  you'll be forced to set a new password immediately
  (`must_change_password`).

## 8. Update documentation for the new department's own repo

These are prose edits in the **new repo only** — never touch the Pharmacy
repo's copies of these files:

- **`CONSTITUTION.md`** — this file is the project's own single source of
  truth and explicitly says not to modify without project-owner approval
  (see its final lines). In the new repo, that approval is implicit (it's
  now *their* constitution) — update at minimum:
  - §1 Project Identity table: `Institution`, `Purpose` if scope differs
  - §4 Authentication / Notifications: only if this department's Telegram
    setup or auth rules genuinely differ (they shouldn't, by design —
    the business rules are shared across departments; only branding is)
  - Bump the version-history line at the bottom to note "Cloned from
    Pharmacy instance, rebranded for <department>"
- **`SIMS_API_Endpoints_v2.0.md`** and **`SIMS_Database_Schema_v2.1.md`** —
  update the title/subtitle line identifying the institution; the
  endpoint/schema content itself is identical across departments and
  needs no changes.
- **`README.md`** — already flagged as stale even in the Pharmacy repo
  (references an abandoned Telegram-OTP login architecture); worth a
  proper rewrite in the new repo rather than copying the stale version
  forward.

## 9. Verify before handing off

- [ ] `npm run build` succeeds (client)
- [ ] `npx vitest run` passes (server, from `server/`)
- [ ] Super Admin can log in and is forced through change-password
- [ ] Telegram bot responds to `/myid` and `/menu`
- [ ] Login page shows the new institution name/logo, not Pharmacy's
- [ ] PWA install prompt shows the new short name (check on a phone —
  installed PWA icon/title uses `manifest.json` from step 5, not the
  `VITE_*` vars)
- [ ] A test violation can be recorded and appears on a PDF export with
  the new `APP_SHORT_NAME` in the header
- [ ] `/health` returns 200

---

## What's shared vs. what's per-department

To set expectations: **all business logic, roles, database schema, and
API endpoints are identical** across every department's clone — that's
the entire point of cloning rather than building multi-tenancy into one
app (see `CONSTITUTION.md`'s rejected-SDUI note, §2, for the same
reasoning applied elsewhere). Only these differ per clone:

- Institution name / app short name (`VITE_INSTITUTION_NAME`,
  `VITE_APP_SHORT_NAME`, `APP_SHORT_NAME`)
- Logo image and PWA manifest
- Telegram bot (own token, own webhook secret)
- Database (own Postgres instance, own data)
- Secrets (`JWT_SECRET`, `TELEGRAM_WEBHOOK_SECRET` — never shared between
  departments; a leaked Pharmacy secret should never grant access to
  Engineering's data or vice versa)
- Default violation types and duty-timing thresholds (seeded once, then
  independently editable per department from the Admin UI)

If a future feature request turns out to need real cross-department
behavior (e.g. one admin overseeing multiple departments from a single
login), that's a materially different architecture from "clone the repo"
and should be scoped as its own spec rather than retrofitted here.
