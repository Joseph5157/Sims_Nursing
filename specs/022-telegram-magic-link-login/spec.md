# Feature Specification: Telegram Magic-Link Login

**Feature Branch**: `022-telegram-magic-link-login`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Add Telegram magic-link (passwordless) login as an additional login method alongside the existing email+password login (do not remove password login). Flow: a user requests a Telegram login link (e.g. via a `/login` bot command, or a "Log in via Telegram" button on the web login page that triggers the bot to send it to their linked Telegram account); the bot sends a message containing a secure, single-use, time-limited login link; clicking it authenticates the user and redirects into the appropriate dashboard for their role (Faculty / Admin / Super Admin), issuing the same session the password login path uses today, including the existing session-revocation mechanism. Only users with a linked, verified Telegram account can use this method — others still use password login. Token must be validated for expiry, single-use, and that the account is active/not deleted. This project previously built and deliberately abandoned a similar OTP-based Telegram login in favor of password-only auth — this feature revives passwordless Telegram login but this time as an addition, not a replacement, so both flows must coexist cleanly. After the feature is implemented, the project's governing decisions doc needs to be updated to document this new login method as an accepted, current decision."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log in with a Telegram link instead of a password (Priority: P1)

A Faculty, Admin, or Super Admin user who has already linked their Telegram account wants to get into the app without typing their password. They open the login page, tap "Log in via Telegram" (or message the bot directly), receive a one-time login link back in Telegram, tap it, and land on their normal dashboard already signed in.

**Why this priority**: This is the entire point of the feature — without it working end-to-end, there's nothing to ship. Every other story only hardens or bounds this core path.

**Independent Test**: Using a test account with a linked, verified Telegram, trigger a login-link request, retrieve the link the bot sends, open it, and confirm the user lands on the dashboard matching their role, fully authenticated (same as if they'd typed their password).

**Acceptance Scenarios**:

1. **Given** a user with a linked, verified Telegram account, **When** they request a login link (via the bot command or the web page's "Log in via Telegram" link) and then open the link they receive, **Then** they are signed in and taken to the dashboard for their role, with no password entry required.
2. **Given** a signed-in-via-Telegram-link session, **When** the user performs any authenticated action (e.g. views their dashboard, checks in for duty), **Then** it behaves identically to a session created via password login — same permissions, same session lifetime rules, same forced-logout behavior if an Admin later resets their session.
3. **Given** the "Log in via Telegram" entry point on the web login page, **When** a visitor taps it, **Then** they are taken into a conversation with the bot with the login request already prepared, requiring only a single confirmation step on the Telegram side.

---

### User Story 2 - Expired or reused links are rejected (Priority: P2)

A login link is only good once and only good for a short time. If someone waits too long, or tries to use a link a second time (including someone else who intercepted a forwarded link), the attempt is refused and the legitimate user is told how to get a fresh one.

**Why this priority**: Without this, the feature is a security hole rather than a convenience — this is what makes Story 1 safe to ship.

**Independent Test**: Generate a login link, let it sit unused past its validity window (or use it once successfully), then attempt to open/use it again — confirm the second attempt is rejected with a clear explanation, and confirm no session is created from a rejected attempt.

**Acceptance Scenarios**:

1. **Given** a login link older than its validity window, **When** a user opens it, **Then** they see a clear message that the link expired and are told to request a new one — no session is created.
2. **Given** a login link that has already been used once successfully, **When** it is opened again (by anyone), **Then** the attempt is rejected — the original successful session is unaffected, but no new session is created.
3. **Given** two attempts to use the same valid, unused link happen at nearly the same moment, **When** both are processed, **Then** exactly one succeeds and the other is rejected as already used — never both.
4. **Given** a user requests a new login link while an earlier one they requested is still unused and unexpired, **When** they then try the earlier link, **Then** it no longer works — only the newest requested link is valid.

---

### User Story 3 - Accounts that can't or shouldn't use this method fall back safely (Priority: P3)

Users without Telegram linked keep using password login exactly as before. Deactivated or deleted accounts can never be signed in this way, even if a link was generated before they lost access.

**Why this priority**: Ensures the new method doesn't create a bypass around existing account-status controls, and confirms zero regression for the majority of today's login traffic.

**Independent Test**: Confirm a user with no linked Telegram has no way to obtain a login link and must use password login; confirm an account that is deactivated or soft-deleted after a link was generated cannot use that link even if it hasn't expired yet.

**Acceptance Scenarios**:

1. **Given** a user with no linked Telegram account, **When** they message the bot's login command (or reach it via the deep link), **Then** they are told to log in with their password and link Telegram from their profile first — no login link is issued.
2. **Given** a login link generated for a user, **When** an Admin deactivates or a Super Admin deletes that account before the link is used, **Then** opening the link fails and no session is created, even though the link itself hasn't expired.
3. **Given** a user who only ever uses password login, **When** this feature ships, **Then** their password login experience is completely unchanged.

---

### Edge Cases

- What happens when a user requests a login link, then immediately requests another before using the first? → Only the newest link is valid (see Story 2, Scenario 4).
- How does the system handle a burst of login-link requests from the same user in a short period (accidental double-taps, or abuse)? → Requests beyond a reasonable per-user limit in a short window are throttled, independent of existing password-login and password-reset rate limits.
- What happens if the bot message fails to send (e.g. user blocked the bot)? → The user is informed the link could not be delivered and is directed to password login.
- What happens if a user taps a login link on a different device than the one they're browsing on? → The link works from any device — it's a normal identity check, not a device-bound one.
- What happens if someone forwards their login link to another person? → Whoever opens it first gets the session (see Story 2, Scenario 2/3); this is the same trust model as any single-use magic link, and is called out so operators understand the boundary (don't forward login links).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a user with a linked, verified Telegram account request a one-time login link, either by messaging a login command directly to the bot, or by using a "Log in via Telegram" entry point on the web login page that opens a conversation with the bot with the same request already prepared.
- **FR-002**: System MUST generate a unique, non-guessable, single-use login token each time a login link is requested, valid for a limited time window after issuance.
- **FR-003**: Requesting a new login link MUST invalidate any earlier, still-unused login link previously issued to that same user.
- **FR-004**: System MUST deliver the login link only to the Telegram account linked to the requesting user, via the existing bot.
- **FR-005**: Opening a valid, unused, unexpired login link MUST sign the user into the same kind of session that password login produces today — same permissions, same session-lifetime behavior, same responsiveness to an existing forced-logout/session-revocation action taken by an Admin or Super Admin.
- **FR-006**: At the moment a login link is opened, System MUST verify that the token exists, has not expired, has not already been used, and belongs to an account that is currently active and not deleted — rejecting the attempt with a clear explanatory message if any check fails.
- **FR-007**: System MUST treat a login token as consumed the instant it is used successfully, so it can never grant a second session, including when two attempts arrive at nearly the same moment (only one may ever succeed).
- **FR-008**: Users without a linked, verified Telegram account MUST have no way to obtain a Telegram login link, and MUST continue to log in only with email + password.
- **FR-009**: System MUST throttle login-link requests per user to prevent abuse, as a limit independent of the existing password-login and self-service password-reset rate limits.
- **FR-010**: After a successful Telegram-link login, the user MUST land on the same role-appropriate dashboard (Faculty / Admin / Super Admin) they would reach via password login.
- **FR-011**: System MUST record each Telegram-link login in the same audit trail used for other authentication events, in a way that distinguishes it from a password login.
- **FR-012**: An expired, already-used, or otherwise invalid login link MUST show a clear, actionable message explaining why it didn't work and how to request a new one — never a generic or silent failure.
- **FR-013**: Email + password login MUST continue to work unchanged for every user after this feature ships, regardless of whether they have Telegram linked.

### Key Entities

- **Telegram Login Token**: A short-lived, single-use credential tied to exactly one user account, tracking when it was issued, when it expires, and whether it has already been used. Superseded automatically whenever that user requests a newer one.
- **User** *(existing entity, extended behavior)*: Can now be authenticated via either their password or a valid Telegram login token tied to their linked, verified Telegram account — no new attributes to the user's identity itself, just an additional way to prove it.
- **Authentication Event** *(existing audit concept, extended)*: Each login is attributable to the method used (password vs. Telegram link), alongside whatever is already recorded for a login event today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with linked Telegram can go from initiating the login request to landing on their dashboard in under 15 seconds under normal conditions.
- **SC-002**: 100% of expired or already-used login links are rejected rather than granting access, verified across repeated testing including near-simultaneous reuse attempts.
- **SC-003**: 0% of accounts without a linked, verified Telegram can be signed in via a Telegram link, under any tested condition.
- **SC-004**: 100% of existing password-based login scenarios continue to work exactly as before — zero regression.
- **SC-005**: Among users who have linked Telegram, at least a noticeable share of logins shift from password to Telegram-link within the first month of availability, indicating the option is discoverable and usable (directional, not a hard gate).

## Assumptions

- Login links expire 10 minutes after issuance — the same order of magnitude already used elsewhere in the system for short-lived, security-sensitive tokens (e.g. self-service password reset).
- "Log in via Telegram" on the web login page is a link that opens the user's Telegram app directly to a conversation with the existing bot, with the login request already pre-filled — it does not require the browser to already have an authenticated session or any live connection to the server beyond the initial page load.
- Only one Telegram login token is valid per user at any given time; each new request supersedes the last.
- Telegram-link login is available equally to all three existing roles (Faculty, Admin, Super Admin) — no role is excluded from using it.
- This feature is purely additive: it introduces no changes to the email + password login path, its rate limiting, or its account-lockout behavior.
- A user's Telegram must already be linked and verified (an existing prerequisite state in the system, established separately from this feature) before they can use this method at all; linking Telegram for the first time is out of scope for this feature.
