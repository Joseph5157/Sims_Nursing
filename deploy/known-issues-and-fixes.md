# Known Issues & Fixes

A running log of real bugs and environment gotchas found while working on this codebase, kept
specifically so the fix doesn't have to be rediscovered in another department's clone (see
`clone-checklist.md`). Every clone shares the same business logic, schema, and tooling, so a bug
found in one instance is a bug waiting to happen in all of them.

Add a new entry here whenever you find and fix something non-obvious — especially anything that
took real investigation to track down. Skip anything that's just a typo or is already obvious from
the code/commit itself.

---

## 1. Single-use token claim: check *after* the claim, not before

**Where**: `server/controllers/auth.controller.js` `telegramLogin()` — the Telegram magic-link
login endpoint (`022-telegram-magic-link-login`), but this is a **pattern bug**, not a one-off —
watch for it in any future single-use-token feature (password reset links, invite links, etc.).

**Symptom**: When two requests race to use the same single-use token at nearly the same moment,
the loser gets the wrong error message — it reported the token as "not found" instead of "already
used."

**Root cause**: The code did a read-only lookup ("why might this fail?") *before* attempting the
atomic claim (`updateMany` with `used_at: null` in the `WHERE` clause). By the time the loser's
diagnostic lookup ran, the read was based on a snapshot taken before the winner's claim committed
— it correctly saw an unused-looking token, so none of the "expired / used / inactive" checks
matched, and the code fell through to a generic "not found."

**Fix**: Always attempt the atomic claim *first*. Only do the diagnostic read-only lookup
*afterward*, and only when the claim actually failed (`count !== 1`). That lookup then correctly
reflects post-claim-attempt state, including whatever a concurrent winner just committed.

```js
// WRONG — diagnostic read happens before the claim, can see stale state
const existing = await prisma.someToken.findUnique({ where: { token } });
const claim = await prisma.someToken.updateMany({ where: { token, used_at: null, ... }, data: { used_at: new Date() } });
if (claim.count !== 1) { /* existing is now stale */ }

// RIGHT — claim first, diagnose only on failure
const claim = await prisma.someToken.updateMany({ where: { token, used_at: null, ... }, data: { used_at: new Date() } });
if (claim.count !== 1) {
  const existing = await prisma.someToken.findUnique({ where: { token } }); // reflects current state
  // ... pick the right error code from `existing`
}
```

**How this was caught**: A Vitest test that fired two concurrent claims at the same token via
`Promise.all` and asserted the loser got `telegram_error=used`. It initially got `not_found`
instead — the test failure is what surfaced the bug. If you're porting this pattern elsewhere,
write that concurrency test; it's the only thing that reliably catches this class of bug (a
single-request test can't).

**Applies to other department clones?** Yes, directly — the Telegram magic-link login feature is
shared code, not department-specific. If a clone was made before this fix, port the fix. Also
relevant to any *new* single-use-token feature added in any clone.

---

## 2. Windows: `npm run generate` fails with `EPERM` while the dev server is running

**Symptom**: After changing `prisma/schema.prisma` and running `npm run migrate`, the automatic
`generate` step (or a manual `npm run generate`) fails with:

```
EPERM: operation not permitted, rename '...\@prisma\client\query_engine-windows.dll.node.tmp...' -> '...\query_engine-windows.dll.node'
```

**Root cause**: On Windows, a running Node process (the dev server, via `nodemon`) holds a file
lock on the Prisma query engine binary. Prisma can't replace it while it's loaded and in use.

**Fix**: Stop the dev server (all of it — `npm run dev` at the root spawns `concurrently`, which
spawns `nodemon` for the server and `vite` for the client, each as separate `node.exe` processes)
before regenerating, then restart it afterward.

```powershell
# Find the processes first — don't blind-kill every node.exe on the machine,
# there may be unrelated Node processes running for other projects.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId, CommandLine

# Stop only the ones whose CommandLine clearly belongs to this project's dev command
Stop-Process -Id <ids> -Force

npm run generate
npm run dev   # restart
```

**Applies to other department clones?** Yes — this is a Windows + Prisma + nodemon interaction,
not specific to this app's code. Anyone developing this codebase on Windows will hit it after any
schema change.

---

## 3. Windows: Docker Postgres container conflicts with a pre-existing native Postgres on port 5432

**Symptom**: A Postgres container started with `-p 5432:5432` accepts connections
(`pg_isready` succeeds), but Prisma fails with:

```
Error: P1000: Authentication failed against database server at `localhost`, the provided database
credentials for `<user>` are not valid.
```

even though the credentials are correct for the container.

**Root cause**: A native Windows Postgres service was already listening on `0.0.0.0:5432`
alongside Docker's port-forwarding proxy. Connections to `localhost:5432` were being served by the
native install (which doesn't have the container's user/database), not the container.

**Fix**: Check for a port conflict before assuming the container is the problem:

```powershell
netstat -ano | findstr :5432
Get-Process -Id <pid>   # if it's not docker's proxy, something else already owns the port
```

If something else owns 5432, map the container to a different host port instead
(e.g. `-p 5433:5432`) and update `DATABASE_URL` to match
(`postgresql://user:pass@localhost:5433/dbname`).

**Applies to other department clones?** Only if that machine also has a native Postgres install.
Worth a 30-second check (`netstat -ano | findstr :5432`) before assuming a fresh Docker Postgres
setup will "just work" on port 5432 on any given Windows dev machine.

---

## 4. Spec Kit tooling: `update-agent-context.ps1` is broken

**Symptom**: Running the agent-context-update step (used by `/speckit-plan` and as an
`after_specify` hook) fails:

```
SyntaxError: '(' was never closed
WARNING: agent-context: unable to parse ...agent-context-config.yml; skipping update.
```

**Root cause**: The PowerShell script (`.specify/extensions/agent-context/scripts/powershell/update-agent-context.ps1`)
embeds a Python snippet to parse the YAML config, and that embedded snippet has a genuine syntax
error (an unclosed parenthesis) in the version of Spec Kit vendored into this repo. It's not
something this project's own code broke.

**Fix (workaround, not a real fix)**: Edit the `<!-- SPECKIT START -->` / `<!-- SPECKIT END -->`
block in `CLAUDE.md` by hand instead of running the script — it's a two-line pointer to the
current feature's `plan.md`, trivial to update manually.

**Applies to other department clones?** Yes — this is a bug in the vendored Spec Kit tooling
itself (`.specify/`), which every clone inherits verbatim. Worth actually fixing upstream in the
Spec Kit script at some point rather than working around it forever, but that's a separate,
non-urgent task.

---

## 5. Spec Kit tooling: `.specify/memory/constitution.md` is a stale, unsynced mirror

**Symptom**: The file's own header comment claims it's "Synced from CONSTITUTION.md," but its
content describes a much older version of the project — e.g. it still says "Auth is Telegram OTP
Only," lists 4 roles (including a "Coordinator" that no longer exists anywhere in the real system),
and gives table/endpoint counts nothing like the current root `CONSTITUTION.md`.

**Root cause**: Nothing keeps this file in sync automatically. It was written once (early in the
project, v2.0) and never updated as root `CONSTITUTION.md` evolved through v3.x.

**Fix (not yet done — flagging, not fixing)**: When running `/speckit-plan`, read the gate rules
from root `CONSTITUTION.md`, not this mirror — call that out explicitly in the plan's Constitution
Check section (as done in `specs/022-telegram-magic-link-login/plan.md`). A real fix would mean
either deleting this file (if nothing actually depends on it) or wiring an actual sync step —
neither was done here since it's out of scope for any single feature and deserves its own
look.

**Applies to other department clones?** Yes — every clone inherits this same stale file (it was
already stale before the Nursing clone existed). Worth resolving once, centrally, rather than
re-discovering it in every department's copy.

---

## 6. Railway auto-creates a redundant, broken `client` service on first connect

**Symptom**: After connecting the GitHub repo to a new Railway project (per `clone-checklist.md`
step 3), the project ends up with **three** services instead of two: `Postgres`, `sims-dms-server`
(the real one — builds and serves both API and client, per the monolith design), and an extra
`client` service showing "Build failed" in the dashboard.

**Root cause**: Railway's repo auto-detection sees the `client/` folder (with its own
`package.json`) and offers/creates it as a second deployable service, on top of the root service
that `railway.toml` actually configures. It's never valid for this app — the client isn't meant to
be deployed standalone; `sims-dms-server`'s build step already runs `npm run build --workspace=client`
and serves the result statically (`server/index.js`, `NODE_ENV === 'production'` block). The extra
service has no working build command of its own, hence the failure.

**Fix**: Delete the redundant service — `railway service delete -s client -y` (or via the
dashboard). Confirm only `Postgres` and `sims-dms-server` remain with `railway service list`.
Harmless either way (it never serves traffic even if left alone, since nothing points a domain at
it), but it's confusing clutter and worth a 10-second cleanup.

**Applies to other department clones?** Yes — this is Railway's own auto-detection behavior
against this repo's structure, not something specific to the Nursing clone. Expect it every time a
new department connects this repo to a fresh Railway project, and check for it right after step 3
of `clone-checklist.md`.
