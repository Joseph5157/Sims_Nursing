# Handoff Report

## task_id
017-profile-avatar-persistence / "Profile Settings – Avatar, Title, and Profile Persistence Improvements" ticket

## status
partial

## completed
- **Root-caused the actual persistence bug** (ticket items 3, 4, 6, 7): it is a backend response
  bug, not a frontend state bug. `server/controllers/auth.controller.js` `login()` hand-built its
  response object and never included `avatar` (unlike `GET /users/me`'s `safeUser()`). Worse,
  `changePassword()` returned **no user fields at all** (`{ message: '...' }`), yet
  `client/src/hooks/useAuth.js` `useChangePassword()`'s `onSuccess` overwrites the entire
  `currentUser` React Query cache with whatever the endpoint returns — wiping name/avatar/role
  from every screen (sidebar, greeting, popup) until a later background `/users/me` refetch
  quietly repaired it. This is the real explanation for "select avatar → save → logout → login →
  resets", and for name/department/designation/title appearing to "not save" right after
  login/password-change even though the DB write was correct all along.
- **Extracted `safeUser` into `server/lib/safeUser.js`** — previously defined locally inside
  `users.controller.js` (used only by `GET /users/me` and friends). Both `users.controller.js` and
  `auth.controller.js` now import the same function, so the two can no longer drift on which
  fields a "user" response includes.
- **`server/controllers/auth.controller.js`**:
  - `login()` now returns `{ ...safeUser(user), must_change_password }` instead of a hand-picked
    field list — adds `avatar`, `telegram_id`, `activation_notification_failed` to the login
    response, matching `/users/me` exactly.
  - `changePassword()`'s `prisma.user.update` call no longer restricts `select` to
    `{ id, role, session_version }` (fetches the full row); responds with
    `{ ...safeUser(updated), must_change_password }` instead of a bare message. Confirmed safe:
    `client/src/pages/auth/ChangePasswordPage.jsx` only reads `err.response.data.message` on the
    error path, never `res.data.message` on success, so the response shape change is a no-op there.
- **Avatar labels + icons** (ticket items 1, 2) — `client/src/utils/avatars.js`:
  - Renamed display labels only: `Male Professor` → `Male Faculty`, `Female Professor` → `Female
    Faculty`. Left the underlying enum `value`s (`male_professor`/`female_professor`) unchanged —
    they still must match `AVATAR_OPTIONS` in `server/schemas/users.schema.js`, and changing them
    would need a data migration for anyone who'd already picked one. Admin/Super Admin labels and
    icons untouched, per the ticket.
  - Replaced the generic Tabler `IconMan`/`IconWoman` (bathroom-sign glyphs) with two new custom
    inline SVG components — `MaleFacultyIcon`/`FemaleFacultyIcon`, new file
    `client/src/components/ui/icons/FacultyAvatarIcons.jsx` — depicting a bust/shoulders
    silhouette with a shirt collar + blazer lapels (male: V-collar + tie; female: rounded blouse
    neckline + fuller head silhouette suggesting hair). Same 24x24 viewBox / stroke-2 /
    `currentColor` convention as the Admin/Super Admin Tabler icons they sit alongside, and render
    inside the *existing* gradient-circle wrapper in `UserAvatar.jsx`/`ProfileDrawer.jsx`
    unchanged — since the glyph is `stroke="currentColor"` resolving to the container's
    `text-white`, it's light/dark-theme-safe automatically, same as the icons it replaces.
  - Split the icons into their own `.jsx` file rather than inlining them in `avatars.js`: Vite's
    esbuild/rolldown JSX transform refused to parse JSX in a `.js`-extensioned file
    (`Unexpected JSX expression... JSX syntax is disabled`), and even after a `.jsx` rename,
    ESLint's `react-refresh/only-export-components` flagged mixing component exports with the
    `AVATAR_OPTIONS` data export in the same file. Moving the two icon components out fixed both;
    `avatars.js` is back to being a plain `.js` data/lookup module.
- **Greeting formula** (ticket item 5) — `client/src/pages/admin/AdminDashboardPage.jsx:87` and
  `client/src/pages/faculty/DashboardPage.jsx:281`: removed `.split(' ')[0]` truncation so both
  render `Good {morning/afternoon/evening}, {title} {Full Name}` using the complete stored name,
  never truncating to first name only. The title-prefix logic itself was already correct
  (built in `010-dashboard-greeting-titles`) and is untouched.
- **Profile preview completeness** (ticket item 6) — `client/src/components/ProfileDrawer.jsx`
  preview block: now shows Title-prefixed full name on the first line and a
  `Designation · Department` line underneath (each gracefully omitted when unset), instead of just
  avatar + bare name. Sourced from local `form` state so it already updates live as the user
  types/picks, before Save.
- **Cross-app sync audit** (ticket item 7) — investigated via a codebase search rather than new
  code: confirmed the app already has exactly one source of truth for the logged-in user
  (`useCurrentUser()` in `App.jsx`, backed by `GET /users/me`, passed as a `user` prop through
  `Layout` into every page) and that other-users' name displays (messages, duty slots, violations,
  reassignment history) already join live from the `User` table via Prisma `select`/`include`
  rather than a denormalized snapshot column — no counter-example found in
  `messages.controller.js`, `duty-slots.controller.js`, `violations.controller.js`,
  `duty-reassignment-requests.controller.js`. `UserAvatar` (the only avatar-rendering component)
  is used only for the logged-in user (`Layout.jsx` sidebar, `ProfileDrawer.jsx`); no other-user
  avatar UI exists anywhere to be out of sync. So fixing item (3)/(4) above is the actual fix for
  item (7) — no new sync plumbing was needed or added.

## failed_or_blocked
- **No in-browser visual verification.** Local Postgres (port 5433, `sims_dms_dev`) is still
  unreachable this session — same Docker Desktop-engine-not-running gap noted in the
  `010-dashboard-greeting-titles` handoff, unchanged since. Could not start `npm run dev`, log in,
  or click through Profile Settings / the greeting / the Change Password flow. Verification for
  this task is build + lint + direct reading of the changed response shapes and call sites only —
  flagging this explicitly rather than claiming a false pass. **Next session with a working local
  DB should do a 2-minute manual pass**: log in, confirm avatar/full-name greeting appear
  immediately (not just after a few seconds), change the avatar and refresh, log out and back in,
  and run Change Password once to confirm the sidebar name/avatar survive it.
- Item 2's "high-quality vector-style illustration" ask is inherently limited by the ~18–40px
  render size these avatars actually appear at in the UI — a literal illustrated portrait
  wouldn't read as anything but a blur at that size. What was built is a more detailed,
  professional-attire *icon* (collar/lapels/tie vs. blouse neckline) in the same family as the
  existing Admin/Super Admin icons, not a photographic-style illustration. Worth a visual check
  once the dev server is reachable to confirm this reads well at actual size, and revisit if the
  owner wants something more illustrative (would likely mean static image assets instead of inline
  SVG, a bigger change).

## commands_run
```
node --check server/lib/safeUser.js server/controllers/auth.controller.js server/controllers/users.controller.js
cd client && npx vite build            # clean, twice (once pre-, once post- icon-file split)
cd client && npx eslint <changed files>  # only pre-existing errors remain (confirmed via git stash diff)
git mv client/src/utils/avatars.js client/src/utils/avatars.jsx   # then back to .js after splitting icons out
docker ps                              # confirms Docker Desktop engine still not running
(bash /dev/tcp probe on 127.0.0.1:5433) # confirms local Postgres still unreachable
```

## constraints_discovered
- **JSX cannot live in a `.js`-extensioned file under this project's Vite/rolldown build** — fails
  with `Unexpected JSX expression... JSX syntax is disabled`. Any new file that needs JSX must be
  `.jsx` from the start (or import JSX from a `.jsx` file, as done here for the new avatar icons).
- **ESLint's `react-refresh/only-export-components` rejects a file that exports both a React
  component and plain data/constants** — relevant if a future change wants to keep small icon
  components colocated with a data-lookup table like `AVATAR_OPTIONS`; they must live in separate
  files.
- Confirmed (again) that local Postgres/Docker Desktop is not running in this environment and
  there's still no documented start command in the repo — same gap flagged in the
  `010-dashboard-greeting-titles` handoff, still unresolved.

## deviations_from_constitution
None. No schema/migration changes; `avatar` already existed on `User` (constitution §5, already
documented). No new endpoints. No role/table changes.

## files_touched
- `server/lib/safeUser.js` (new — shared serializer, moved out of `users.controller.js`)
- `server/controllers/users.controller.js` (imports `safeUser` instead of defining it locally)
- `server/controllers/auth.controller.js` (`login()` and `changePassword()` now use `safeUser`)
- `client/src/utils/avatars.js` (renamed labels; icons now imported from the new icons file)
- `client/src/components/ui/icons/FacultyAvatarIcons.jsx` (new — `MaleFacultyIcon`/`FemaleFacultyIcon`)
- `client/src/components/ProfileDrawer.jsx` (preview block shows title/name/designation/department)
- `client/src/pages/admin/AdminDashboardPage.jsx` (greeting uses full name)
- `client/src/pages/faculty/DashboardPage.jsx` (greeting uses full name)

## open_questions_for_owner
- No live visual confirmation of the new avatar icons or the fixed persistence flow — see
  `failed_or_blocked` above. Please do a quick manual pass once the local DB (or a deployed
  environment) is reachable.
- If the new icons don't feel "illustrative" enough at actual render size, say so — the
  alternative is static image assets (PNG/SVG files) rather than inline stroke icons, which is a
  bigger change (asset pipeline, retina sizes, etc.) and wasn't pursued here without a concrete
  visual review first.
