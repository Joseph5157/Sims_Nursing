# Handoff Report

## task_id
023-sims-id-series / apply pre-built feature from external zip (2026-07-15)

## status
complete

## completed
- **Source**: the full feature (schema, migration, controllers, client) arrived pre-written in
  `Sims_Nursing-SIMS-ID-series-updated.zip` (dropped in the project root by the owner, not built
  via the usual spec-kit flow in this session). Diffed every file in the zip against the working
  tree, confirmed it was additive to (not conflicting with) `022-telegram-magic-link-login`
  (`telegramLogin` control flow untouched, confirmed by grep + full test pass), then copied the
  new/changed files into the repo and applied it.
- **Schema**: `users.sims_id` / `pending_invites.sims_id` (`Int @unique`, range-checked by role),
  `users.email` / `pending_invites.email` changed from required to nullable, new `SimsIdCounter`
  model (`sims_id_counters` table, one row per role series: `admin`, `faculty`). Migration
  `20260715103000_add_sims_id_series` applied — backfills existing users/invites in creation
  order, raises rather than silently overflows if a role's range (100 admin / 8900 faculty slots)
  is exhausted. Prisma auto-generated a tiny follow-up migration
  (`20260715084006_add_sims_id_series`, drops a stray DB-level default on
  `sims_id_counters.updated_at` to match the Prisma-managed `@updatedAt`) — harmless, applied.
- **Backend**: `server/lib/simsId.js` (new — atomic counter allocation), `auth.controller.js`
  `login()` now accepts a bare 4-digit string as a SIMS ID or falls back to email,
  `invites.controller.js`/`users.controller.js` updated to allocate/carry `sims_id`,
  `bot.js` — `/myid` now replies with the SIMS ID (not the raw Telegram chat ID), and
  activation/password-reset messages show the SIMS ID. `telegramLogin` (022) is untouched.
- **Client**: `LoginPage.jsx` accepts SIMS ID or email in the identifier field,
  `CreateUserDrawer.jsx`/`UsersPage.jsx` surface the SIMS ID, `ProfileDrawer.jsx` and `useAuth.js`
  updated accordingly.
- **Tests**: new `server/tests/sims-id.test.mjs` (4 tests), `auth.test.mjs` and
  `invites.test.mjs` updated for the new identifier logic. Full suite:
  **111/111 pass** (13 test files) — includes the pre-existing `telegramLogin` tests, confirming
  022 is unaffected. `npm run build` (client) — 0 errors (same pre-existing chunk-size warning as
  every prior session, unrelated).
- **CONSTITUTION.md updated** (v3.17 → 3.18) — §2 Infrastructure Auth row, §4 Authentication (new
  "SIMS ID login" bullet), §5 Database (new `sims_id_counters` row, table count 17→18, new Key
  Schema Rules bullet on the now-nullable email columns). §6 Authentication endpoint count
  unchanged (still 4 — no new routes, `POST /auth/login` just accepts a second identifier shape).
- **Copied `SIMS_ID_IMPLEMENTATION.md`** from the zip into the repo root as the reference doc for
  the number ranges and deployment steps (`npm run migrate:deploy` before `npm start` on Railway).
- **Deployed to production and verified live** (2026-07-15): pushed to `origin/main`, which
  Railway auto-deploys via `railway.toml`'s `startCommand: npm run migrate:deploy && npm run
  start`. Confirmed live by sending `/myid` to the production Telegram bot and getting back the
  new SIMS ID reply (`1000`) instead of the old raw-chat-ID reply, plus clean migration logs
  (`27 migrations found`, `All migrations have been successfully applied`) and a healthy
  `/health` check. See `failed_or_blocked` below for the real trouble this took — it was not a
  clean first push.

## failed_or_blocked
- Nothing left blocked, but getting the local dev Postgres container reachable took real effort
  before the migration could even run — see `constraints_discovered`.
- **The first two production deploy attempts failed/didn't take** — resolved by the third
  attempt (`railway up`). Full sequence, in case this pattern recurs:
  1. First push (commit `800821e`) auto-deployed and **FAILED** with `P3018` — the
     auto-generated follow-up migration (`20260715084006_...`, dropping a stray column
     default) has a filename timestamp that sorts *before* the main migration
     (`20260715103000_...`) that creates the table it alters. On a fresh database (production,
     unlike local dev where the main migration was already applied before the follow-up was
     generated), Prisma applies strictly in filename order and hit the follow-up first, which
     referenced a table that didn't exist yet. This also left `20260715084006_...` marked
     `FAILED` in production's `_prisma_migrations` table, which blocks *all* future migrations
     (`P3009`) until explicitly resolved — a schema fix alone isn't enough. **No outage**:
     Railway keeps the previous healthy container running when a new deploy fails its
     healthcheck.
  2. Fixed by merging the follow-up migration's change directly into the main migration
     (removed the DB-level default from the `CREATE TABLE` instead of adding-then-dropping it)
     and deleting the now-redundant follow-up file. Resolved production's failed-migration flag
     via `railway ssh -- node node_modules/prisma/build/index.js migrate resolve --rolled-back
     20260715084006_add_sims_id_series` (SSH into the live service to reach
     `postgres.railway.internal`, which isn't reachable from a local machine — `railway run`
     only injects env vars locally and cannot resolve that internal hostname).
  3. Pushed the fix (commit `1b023c2`). The GitHub-triggered auto-deploy showed as **SKIPPED**
     in `railway deployment list` instead of building — never rebuilt at all, for reasons not
     fully diagnosed (likely debounced by the previous deployment's `on_failure` restart
     retries still being in-flight).
  4. Tried `railway redeploy -y` next — this **reused the last-built Docker image** rather than
     rebuilding from source, so it silently redeployed the *broken* `800821e` image again (still
     showed `28 migrations found`, i.e. the pre-fix migration set) and failed identically,
     creating a second failed-migration record that had to be resolved the same way as step 2.
     **Lesson: `railway redeploy` is "rerun the last build," not "rebuild from latest commit" —
     it will not pick up a fix that was never successfully built.**
  5. `railway up -c` (uploads the local working directory directly and forces a genuinely fresh
     build) is what finally worked — confirmed via its own build log (`27 migrations found`,
     `Applying migration 20260715103000_add_sims_id_series`, `All migrations have been
     successfully applied`) and by sending `/myid` to the live Telegram bot and getting the new
     SIMS-ID-based reply back instead of the old raw-chat-ID one.
  - **Takeaway for next time a Railway deploy needs to be forced**: `git push` → if
    `railway deployment list` doesn't show a fresh `BUILDING` entry for the new commit within a
    couple minutes, don't reach for `railway redeploy` (it can replay a stale/broken image
    instead of rebuilding) — go straight to `railway up` from a clean local checkout of the
    pushed commit.

## commands_run
```
npm run migrate -- --name add_sims_id_series   # applied cleanly after DB container fixed
npx vitest run                                  # 111/111 pass, 13 test files
npm run build                                   # client build: 0 errors
docker ps -a / docker start / docker stop / docker rm / docker run ...  # see below
git push origin main                            # x2 (feature, then migration-order fix)
railway ssh -- node node_modules/prisma/build/index.js migrate resolve --rolled-back \
  20260715084006_add_sims_id_series             # x2 (once per failed deploy attempt)
railway redeploy -y                              # reused stale image, failed again
railway up -c -m "Fix migration ordering (1b023c2)"   # actually rebuilt + deployed the fix
railway deployment list / railway logs --deployment <id>   # used throughout to diagnose
```

## constraints_discovered
- **Local dev Postgres container needed a full recreate.** Two Postgres containers both claim
  host port 5433 (`sims-nursing-postgres` — the real one, matching `.env`'s `DATABASE_URL`
  creds `sims`/`sims_nursing_dms` — and `sims-dms-dev-db`, a stale leftover from an older setup
  with different creds `postgres`/`sims_dms_dev`). After a Docker Desktop restart, `docker start
  sims-nursing-postgres` repeatedly came up without its port-forward attaching (`docker ps` showed
  bare `5432/tcp`, no `0.0.0.0:5433->`) even after a full `wsl --shutdown` + relaunch. Root-caused
  by testing password auth *inside* the container (`docker exec ... psql -h localhost` — worked
  fine, proving credentials were correct) versus from the Windows host through the port mapping
  (failed) — isolated it to a broken Docker Desktop/WSL2 port-proxy specific to that container
  object, not the credentials or Postgres itself. **Fix**: stop + remove the container (data is
  safe — it uses the named volume `sims_nursing_pg_data`, not an anonymous one) and `docker run`
  it fresh from the same image/volume/port/env — the recreated container's port-forward attached
  immediately. If this recurs: check `docker inspect <container> --format '{{json
  .NetworkSettings.Ports}}'` — an empty map (`{"5432/tcp":[]}` ) despite `HostConfig.PortBindings`
  showing the mapping is the tell; recreate rather than debugging the proxy further.
- `sims-dms-dev-db` auto-restarts whenever Docker Desktop starts even though its `RestartPolicy`
  is `no` — this looks like Docker Desktop's own "resume previous session" behavior, independent
  of the container's restart policy. Worth remembering it'll come back and steal port 5433 again
  on the next Docker Desktop restart unless it's stopped or removed for good.
- Confirmed via grep + the full passing test suite that this feature is genuinely additive to
  `022-telegram-magic-link-login` — no shared code paths were changed in a way that affects the
  magic-link flow.

## deviations_from_constitution
- Already reconciled — see `completed` above. CONSTITUTION.md itself now documents this decision
  (v3.17 → 3.18), so it's a recorded capability, not an outstanding deviation.

## files_touched
- prisma/schema.prisma — `sims_id` columns, nullable `email`, new `SimsIdCounter` model
- prisma/migrations/20260715103000_add_sims_id_series/ — NEW (copied from zip)
- prisma/migrations/20260715084006_add_sims_id_series/ — NEW (Prisma auto-generated drift fix)
- prisma/seed.js, db/seed-department.mjs — seed data updated for `sims_id`
- server/lib/simsId.js — NEW
- server/lib/bot.js, server/lib/safeUser.js
- server/controllers/auth.controller.js, invites.controller.js, users.controller.js
- server/schemas/auth.schema.js, invites.schema.js
- server/tests/sims-id.test.mjs — NEW
- server/tests/auth.test.mjs, invites.test.mjs, server/vitest.config.mjs
- client/src/components/CreateUserDrawer.jsx, ProfileDrawer.jsx
- client/src/hooks/useAuth.js
- client/src/pages/admin/UsersPage.jsx, pages/auth/LoginPage.jsx
- SIMS_ID_IMPLEMENTATION.md — NEW (copied from zip, reference doc)
- CONSTITUTION.md — §2, §4, §5, version history (v3.17 → 3.18)
- specs/023-sims-id-series/handoff.md — this file

## open_questions_for_owner
- The zip's origin isn't part of this session's history — it appears to have been built entirely
  outside the spec-kit workflow (no `specs/023-.../spec.md`/`plan.md`/`tasks.md` came with it,
  only the implementation itself + `SIMS_ID_IMPLEMENTATION.md`). If this was written by a
  different tool/session, consider whether a spec should be backfilled for traceability — not
  blocking, just flagging the gap in process for this one feature.
- Production deploy is done and verified live (see `completed` above) — no longer open.
- The stray `sims-dms-dev-db` container/port conflict will resurface on the next Docker Desktop
  restart. Worth deciding whether to just `docker rm` it for good since it appears to be dead
  weight from an earlier, differently-named setup.
- Worth asking Railway support or checking project settings about why the GitHub-triggered
  auto-deploy for commit `1b023c2` showed as `SKIPPED` instead of building — it worked fine for
  the very first push of this session (`800821e` built and ran, just failed at the migration
  step), so auto-deploy isn't broken in general, but something about the second push in quick
  succession didn't trigger a real build. Not blocking (worked around via `railway up`), but
  worth understanding before the next time a hotfix needs to go out fast.
