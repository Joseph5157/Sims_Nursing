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

## failed_or_blocked
- Nothing left blocked, but getting the local dev Postgres container reachable took real effort
  before the migration could even run — see `constraints_discovered`.

## commands_run
```
npm run migrate -- --name add_sims_id_series   # applied cleanly after DB container fixed
npx vitest run                                  # 111/111 pass, 13 test files
npm run build                                   # client build: 0 errors
docker ps -a / docker start / docker stop / docker rm / docker run ...  # see below
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
- Production deploy still needs `npm run migrate:deploy` run against Railway before the updated
  server starts there (per `SIMS_ID_IMPLEMENTATION.md`) — not done as part of this session, which
  only touched the local dev database.
- The stray `sims-dms-dev-db` container/port conflict will resurface on the next Docker Desktop
  restart. Worth deciding whether to just `docker rm` it for good since it appears to be dead
  weight from an earlier, differently-named setup.
