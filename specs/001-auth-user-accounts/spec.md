# Feature Specification: Week 1 — Authentication & User Accounts

**Feature Branch**: `001-auth-user-accounts`

**Created**: 2026-06-06

**Status**: Draft

**Input**: User description: "Week 1 — Auth and user accounts as defined in the constitution."

**Updated**: 2026-07-03 — rolled forward to the permanent email/password login model
(Option A2). Telegram OTP login and the Telegram Login Widget were built and then
abandoned in favor of email/password; Telegram remains in scope for notifications only,
including the new Admin-triggered password reset. See `handoff.md` for the full history.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Faculty Logs In via Email + Password (Priority: P1)

A faculty member opens the system and enters their registered email and password. On
success they gain access to the faculty dashboard. If this is their first login, or their
password was just reset by a Super Admin, they are required to set a new password before
doing anything else.

**Why this priority**: Authentication is the gateway to all other system features. Without a working login, nothing else can be tested or used. This is the single most critical P1 deliverable of Week 1.

**Independent Test**: Can be fully tested by attempting to log in with valid email/password credentials. Delivers a working authenticated session with a faculty-scoped dashboard view.

**Acceptance Scenarios**:

1. **Given** a registered faculty user with a password already set, **When** they submit the correct email and password, **Then** they are authenticated and redirected to their dashboard.
2. **Given** a user submits an incorrect password (or an email that doesn't exist), **When** they submit, **Then** the system rejects it with a generic "invalid email or password" error that never reveals which part was wrong or whether the account exists.
3. **Given** a user flagged `must_change_password = true` (first login, or after a Super Admin password reset), **When** they successfully authenticate, **Then** they are required to set a new password before accessing any other part of the system.
4. **Given** repeated login attempts from the same IP exceed the rate limit, **When** the limit is hit, **Then** the system responds with a rate-limited error — there is no per-account lockout counter, only IP-level throttling.
5. **Given** an authenticated user, **When** they close the browser and return, **Then** their session persists without re-authentication (within JWT validity window).

---

### User Story 2 — Admin Invites and Manages User Accounts (Priority: P2)

There is no direct account-creation endpoint (`POST /users` is retired — `410 GONE`). An Admin
invites a new Faculty account by submitting their details; the system creates a pending
invite and a Telegram activation link. The invited person taps the link in their own
Telegram app, and the bot creates their real account with a system-generated temporary
password (`must_change_password = true`) — the account does not exist until that happens.
Only a Super Admin can additionally invite Admin accounts. Admin can deactivate accounts and
view all accounts (active, deactivated, and pending invites) in the system.

**Why this priority**: Without user accounts, faculty cannot be registered to log in. Admin account management is prerequisite to all role-based access in Phase 1.

**Independent Test**: Can be fully tested by logging in as Admin, inviting a new Faculty account, tapping the generated Telegram link as that faculty member, and verifying the resulting account can subsequently log in with the temporary password.

**Acceptance Scenarios**:

1. **Given** a logged-in Admin, **When** they invite a new Faculty account (`POST /invites`), **Then** a pending invite is created and a Telegram activation link is generated — no user account exists yet.
2. **Given** an invited person, **When** they tap their activation link and message the bot (`/start invite_<token>`), **Then** the bot creates their real account with a generated temporary password, sets `must_change_password = true`, and deletes the pending invite.
3. **Given** a logged-in Admin, **When** they deactivate a user account, **Then** that user can no longer authenticate until reactivated.
4. **Given** a logged-in Admin, **When** they view the user list, **Then** all active and deactivated accounts are listed with their roles and status, and pending (not-yet-activated) invites are shown separately.
5. **Given** a logged-in Admin, **When** they attempt to invite a user with an email that already belongs to an active user or an existing pending invite, **Then** the system rejects the request with a clear duplicate error.
6. **Given** a logged-in Admin, **When** they attempt to invite an Admin or Super Admin account, **Then** the system denies the request with a clear permission error — Admin may only invite Faculty.
7. **Given** a logged-in Super Admin, **When** they invite a new user as Faculty or Admin, **Then** the same pending-invite + Telegram-activation flow applies.
8. **Given** a logged-in Admin or Super Admin, **When** they attempt to deactivate their own account, **Then** the system rejects the request with a clear error and their account remains active.
9. **Given** a logged-in Super Admin, **When** they attempt to invite a new account with role Super Admin, **Then** the system currently rejects it — see the known gap noted under FR-016.

---

### User Story 3 — Super Admin Resets a User's Password (Priority: P3)

A Super Admin can reset any user's password — generating a temporary password and forcing
them to change it on next login — restoring their ability to log in without needing direct
database access. This is the system's only "forgot password" recovery path.

**Why this priority**: Without this, a faculty member who forgets their password (or is otherwise locked out) cannot be recovered without database intervention. This is critical for operational continuity but depends on P1 and P2 being functional first.

**Independent Test**: Can be fully tested by having Super Admin trigger a password reset on a test account, confirming the temp password arrives via Telegram, and verifying the user can log in and is forced to change it.

**Acceptance Scenarios**:

1. **Given** a user who cannot log in (forgotten password or otherwise locked out), **When** Super Admin triggers a password reset for their account, **Then** a temporary password is generated, the user's existing session is revoked, and the user is notified of the temporary password via Telegram — no email, no SMS.
2. **Given** a Super Admin resets a user's password, **When** the action completes, **Then** an audit log entry is created recording who reset whose password and when.
3. **Given** a non-Super Admin user (Admin or Faculty), **When** they attempt to access password-reset functionality for another user, **Then** the system denies access.
4. **Given** a user whose password was just reset, **When** they log in with the temporary password, **Then** they are immediately required to set a new password before proceeding (`must_change_password`).

---

### User Story 4 — Role-Based Access Control Enforced on All Routes (Priority: P2)

Every user, once authenticated, can only access screens and actions permitted for their role. Accessing a route outside their role results in a clear denial — not a crash or blank screen.

**Why this priority**: Role boundaries prevent data leakage and ensure system integrity. Without enforced RBAC, any logged-in user could access any feature.

**Independent Test**: Can be fully tested by logging in as a Faculty user and attempting to access an Admin-only page or action, verifying denial.

**Acceptance Scenarios**:

1. **Given** a Faculty user, **When** they attempt to access Admin functions, **Then** they receive a clear "access denied" response.
2. **Given** an unauthenticated user, **When** they attempt to access any protected page, **Then** they are redirected to the login screen.
4. **Given** any authenticated user, **When** their session JWT expires, **Then** they are automatically redirected to login on their next action.

---

### Edge Cases

- **What happens if an invited person never taps their Telegram activation link?** Resolved — no user account is ever created; the invite sits as `pending` until it expires (7 days) or Admin/Super Admin regenerates it. Once an account exists, Telegram linkage is independent of login going forward — login itself is email + password, not Telegram.
- **How does the system handle repeated login attempts in rapid succession?** Resolved — IP-based rate limiting (50 requests / 15 min in production); there is no per-account failed-attempt lockout.
- **What happens if Telegram is unreachable when a Super Admin triggers a password reset?** OPEN — not yet decided whether the reset should still succeed (with the temp password shown in the API response as a fallback for the Super Admin to relay manually) or fail outright. See `handoff.md` open questions.
- **What if an Admin tries to deactivate their own account?** Resolved — the system blocks this (see FR-017).
- **What if the only Super Admin account is locked out (password forgotten, no other Super Admin to reset it)?** Resolved — no in-app recovery path exists; requires direct database intervention (see Assumptions).

---

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**

- **FR-001**: System MUST authenticate users via registered email + password — no Telegram OTP, no SMS, no email OTP.
- **FR-002**: System MUST hash all passwords with bcrypt (cost factor 12); plaintext passwords are never stored or logged.
- **FR-003**: System MUST issue an authenticated session token (JWT) stored in an httpOnly cookie upon successful login — never in browser storage — together with a CSRF token required on all mutating requests.
- **FR-004**: System MUST embed `session_version` in the JWT and validate it against the user's current `session_version` on every request, so incrementing it (on deactivation, reactivation, deletion, role change, or password reset) instantly revokes that user's existing sessions.
- **FR-005**: System MUST force a password change (`must_change_password`) on first login and after any Admin-triggered password reset, before the user can access the rest of the system.
- **FR-006**: System MUST rate-limit login attempts per IP address; there is no per-account failed-attempt lockout.
- **FR-007**: System MUST enforce authentication on all routes except the login endpoint.

**User Accounts**

- **FR-008**: System MUST support exactly 3 roles: Super Admin, Admin, Faculty.
- **FR-009**: Admin MUST be able to invite new Faculty accounts only, via `POST /invites` (there is no direct account-creation endpoint — `POST /users` is retired and returns `410 GONE`). Admin MUST NOT be able to invite Admin or Super Admin accounts.
- **FR-010**: Admin MUST be able to deactivate user accounts. Deactivated users cannot authenticate.
- **FR-011**: Admin MUST be able to view a list of all user accounts with their roles and active/deactivated status.
- **FR-012**: Super Admin MUST be able to trigger a password reset for any user — generating a temporary password, forcing a password change on next login (`must_change_password = true`), revoking the user's existing sessions (`session_version` increment), and notifying the user of the temporary password via Telegram (no email, no SMS).
- **FR-013**: System MUST prevent duplicate accounts and duplicate pending invites based on email address — an email cannot belong to both an active user and a pending invite, nor to two pending invites at once. Telegram ID is likewise unique once an account is activated.
- **FR-014**: System MUST enforce role-based access — each role can only access the actions and data permitted to them as defined in the project constitution.
- **FR-015**: System MUST log every Super Admin-triggered password reset in the audit log, recording the actor, the target user, and the timestamp.
- **FR-016**: Super Admin MUST be able to invite new Admin accounts, in addition to the Faculty-only invite scope granted to Admin, via the same `POST /invites` flow. **Known gap**: the live invite schema (`createInviteSchema`) only accepts `role: 'admin' | 'faculty'` — there is currently no path, even for Super Admin, to create an additional Super Admin account after the initial database seed. This does not yet fully satisfy the original "Super Admin can create any role" intent; flagged as an open question rather than silently implemented.
- **FR-017**: System MUST prevent a user from deactivating their own account; the attempt is rejected with a clear error.
- **FR-018**: System MUST only convert a pending invite into a real user account when the invited person confirms via the Telegram bot (`/start invite_<token>`) — never before. Activation generates a temporary password (`must_change_password = true`) and deletes the pending invite.
- **FR-019**: Pending invites MUST expire after 7 days. Admin/Super Admin MAY regenerate an invite (expired or not) to produce a new token and link, and MAY cancel a pending invite outright.

### Key Entities

- **User**: Represents any system participant. Has a role (Super Admin / Admin / Faculty), email + password credentials, a Telegram ID (set at invite-activation time; used for notifications and re-activation, not for login itself), active/deactivated status, `must_change_password` flag, and timestamps.
- **Pending Invite**: Represents an invited-but-not-yet-activated account. Holds name, email, role (`admin` or `faculty` only — see FR-016 gap), invite token, 7-day expiry, and who issued it. Activated into a real `User` by the Telegram bot, which also generates the account's temporary password; deleted upon activation.
- **Audit Log**: Immutable record of sensitive system actions (password resets, account changes), recording actor, action type, target, and timestamp.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can complete the full login flow (enter email + password → reach dashboard) in under 10 seconds under normal conditions.
- **SC-002**: Invalid credentials (wrong email or password) are rejected 100% of the time with a generic error message that never reveals whether the account exists.
- **SC-003**: Every Super Admin-triggered password reset immediately revokes the affected user's existing session and forces a password change on next login — no bypass path exists.
- **SC-004**: All 3 roles are independently accessible, and each role's access boundaries are enforced with zero cross-role data or action leakage.
- **SC-005**: Admin can invite a Faculty account, deactivate any account, and list all user accounts within 3 clicks from their dashboard. Attempts by Admin to invite an Admin or Super Admin account are rejected with zero exceptions.
- **SC-006**: 100% of protected routes reject unauthenticated requests — no unprotected route exists except the login endpoint.
- **SC-007**: Every Super Admin-triggered password reset appears in the audit log within the same request cycle — no reset goes unlogged.

---

## Assumptions

- New Faculty/Admin accounts are created via an invite → Telegram-activation flow (`POST /invites`, activated by the bot) — there is no direct creation endpoint and no bulk import for users (only students use Excel import). Telegram is required to *activate* an invite, but not required for *login* afterward — login is email + password.
- The Telegram Bot is operational and able to deliver invite links, notification messages, and password-reset temporary passwords; if it is unreachable, delivery fails gracefully (logged, does not block the underlying action) but no fallback delivery channel is provided.
- The first Super Admin account is seeded directly into the system (via a setup script or database seed) with a real password — there is no self-registration flow, and (per the FR-016 known gap) currently no way to create a second one afterward either.
- Users do not share Telegram accounts — one Telegram identity maps to exactly one system user.
- Session token validity is 7 days, as configured in the environment. This is not user-configurable.
- Mobile responsiveness is required (PWA), but native mobile app builds are out of scope for Week 1.
- If the only active Super Admin account cannot log in (password forgotten or lost, and no other Super Admin exists to trigger a reset), no in-app recovery path is provided in Phase 1 — recovery requires direct database intervention (e.g. a script setting a new `password_hash`) performed by the system owner or developer.
