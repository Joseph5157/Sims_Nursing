# Bug Fix Instructions: Issues 1, 2, 3, 5
**Project**: SIMS DMS — `001-auth-user-accounts`
**Date**: 2026-06-07
**Read before starting**: `CONSTITUTION.md`

These are targeted bug fixes to 7 files. Do not refactor anything outside the scope described. Do not add new dependencies. Do not change the database schema.

---

## Fix 1 — `telegram_id` missing from create user flow

**Problem**: Admin can create a user with no Telegram ID. That user can never log in because OTP delivery requires a Telegram ID.

### File 1 of 3: `server/schemas/users.schema.js`

In `createUserSchema`, add `telegram_id` as an optional field:

```
telegram_id: z.string().max(50).optional(),
```

### File 2 of 3: `server/controllers/users.controller.js`

In the `createUser` function:
- Destructure `telegram_id` from `req.body` alongside the existing fields
- Pass `telegram_id` into the `prisma.user.create` data object

### File 3 of 3: `client/src/pages/admin/UsersPage.jsx`

In `CreateUserModal`:
- Add `telegram_id: ''` to the initial `form` state object
- Add a Telegram ID `<Input>` field to the form, placed after the Email field and before the Role select
- Label it "Telegram ID" with placeholder "@username or numeric ID"

---

## Fix 2 — Frontend routes not enforcing role boundaries

**Problem**: A logged-in faculty user can navigate directly to `/admin/users` or `/super-admin/audit` and the page renders. Only the API rejects them — the UI does not.

### File 1 of 2: `client/src/components/ProtectedRoute.jsx`

- Change the prop from `requiredRole` (single string) to `requiredRoles` (array of strings)
- Update the role check from `user.role !== requiredRole` to `!requiredRoles.includes(user.role)`
- When the role check fails, render a full-page "Access denied" message — not just a small text div. Centre it on screen, include the user's current role so they understand why.
- Keep the loading spinner and unauthenticated redirect logic exactly as-is

### File 2 of 2: `client/src/App.jsx`

- Remove the unused `adminRoute` helper function (lines ~40–42)
- On the admin route group `<Route element={...}>`, pass `requiredRoles={['admin', 'super_admin']}` to `ProtectedRoute`
- On the super-admin route group `<Route element={...}>`, pass `requiredRoles={['super_admin']}` to `ProtectedRoute`
- The faculty route group does not need a `requiredRoles` prop — any authenticated user reaching a faculty route is fine since admins have superset access. Leave it as a bare authenticated check.
- Update all `requiredRole=` prop usages to `requiredRoles=` to match the renamed prop

---

## Fix 3 — `GET /users/:id` incorrectly restricted to Admin only

**Problem**: The spec says this endpoint is "All Auth". Faculty cannot fetch any user profile, which will break future features that need to look up who owns a duty slot.

### File 1 of 1: `server/routes/users.routes.js`

On the `GET /:id` route, remove the `authorize('admin', 'super_admin')` middleware call. The route should only require `authenticate` — which is already applied to the whole router via `router.use(authenticate)` at the top of the file. So the route simply becomes:

```
router.get('/:id', ctrl.getUser)
```

No changes needed to the controller — it already returns the correct data.

---

## Fix 5 — Seed environment variables missing from `.env.example`

**Problem**: `prisma/seed.js` reads `SUPER_ADMIN_TELEGRAM_ID`, `SUPER_ADMIN_NAME`, and `SUPER_ADMIN_EMAIL` from the environment but none of these are documented in `.env.example`. Running `npm run seed` on a fresh setup crashes immediately.

### File 1 of 1: `.env.example`

Add a new section at the bottom of the file:

```
# Seed — required only when running: npm run seed
# Run once on fresh setup to create the first Super Admin account
SUPER_ADMIN_TELEGRAM_ID=your_telegram_numeric_id
SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_EMAIL=superadmin@sims.edu
```

---

## Verification Steps

After making all changes, verify the following manually or by review:

1. **Issue 1**: Create a user via the Admin UI — the form should have a Telegram ID field. The created user record in the DB should have `telegram_id` populated. That user should be able to request an OTP and log in.

2. **Issue 2**: Log in as a faculty user. Attempt to navigate to `/admin/users` directly in the browser. You should see the "Access denied" page, not the Users table. Log in as Admin — `/admin/users` should work. Log in as Admin — `/super-admin/audit` should show "Access denied".

3. **Issue 3**: Make an authenticated request as a faculty user to `GET /users/:some-id`. It should return the user profile with a 200, not a 403.

4. **Issue 5**: Open `.env.example` — the three `SUPER_ADMIN_*` variables should be present with clear comments.

---

## What NOT to change

- Do not touch `prisma/schema.prisma` — no schema changes required
- Do not touch any controller other than `users.controller.js`
- Do not touch any route file other than `users.routes.js`
- Do not add any new npm packages
- Do not change the OTP flow, JWT logic, or cookie handling
- Do not modify any other frontend pages or hooks
