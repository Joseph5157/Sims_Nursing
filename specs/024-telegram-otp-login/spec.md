# Feature Specification: Telegram OTP Login

**Feature Branch**: `024-telegram-otp-login`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Telegram OTP login as the primary login method, with password login retained as a hidden break-glass fallback. Owner has explicitly approved reopening the previously-abandoned Telegram-OTP decision. 6-digit numeric code delivered via the existing Telegram bot. Password login is not deleted — only hidden from the default login page and kept reachable at a separate URL for emergencies. User enters their 4-digit SIMS ID, receives a code in Telegram, types it in, and gets the same session password login issues today."

## Context: Why This Reopens a Settled Decision

`CONSTITUTION.md` §4 currently states: *"No Telegram OTP (the code-entry kind), no SMS, no email OTP."* The project built a Telegram-OTP login early on (an `otp_sessions` table), abandoned it in favour of password login, and later added a Telegram **magic link** (022) that was explicitly scoped as *not* reopening the OTP question.

This feature deliberately reopens it, with the project owner's explicit approval, for one concrete reason the magic link cannot serve:

> **The magic link logs you in on whatever device you tap it on.** A faculty member reading Telegram on their phone cannot use it to log in on a desktop browser. A typed code can cross that device boundary; a tapped link cannot.

This is **additive**. The magic link and password login both remain. Nothing is deleted. `CONSTITUTION.md` must be updated with a version-history entry recording this as a deliberate, owner-approved change — following the precedent set by 022 — not a silent reversal.

## Clarifications

### Session 2026-07-15

- Q: When an account is locked after repeated wrong codes, what unlocks it? → A: **A time-based cool-off, and nothing else.** The lock lifts on its own a fixed interval after the account was locked. There is deliberately no administrator unlock action and no "log in with your password to clear it" shortcut — waiting is the only path. Chosen for simplicity, and because it cannot be weaponised: no attacker can lock anyone out permanently, and no user can be stranded waiting on someone else to act. Rejected: admin-only unlock, which would let anyone permanently lock out the Super Admin (whose SIMS ID is `1000` — the first ID in the admin range, and trivially guessable) with only that same locked-out Super Admin able to undo it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log in on a desktop using a code from my phone (Priority: P1)

A faculty member sits at a shared desktop in the college. Their Telegram is on their personal phone. They open the SIMS DMS login page, type their 4-digit SIMS ID, and submit. Within seconds the bot messages a 6-digit code to their phone. They read it off their phone, type it into the desktop, and they are logged in — without ever installing Telegram on, or logging into Telegram from, that desktop.

**Why this priority**: This is the entire point of the feature and the one thing no existing login method can do. The magic link cannot cross devices; password login requires remembering a password most users only ever set once under duress. Without this story there is no feature.

**Independent Test**: Fully testable on its own — open the login page in a browser with no Telegram session, enter a known SIMS ID, read the code from a separate Telegram client, enter it, and confirm arrival at the correct role-appropriate dashboard with a working session. Delivers the complete cross-device login value by itself.

**Acceptance Scenarios**:

1. **Given** an active user with a linked, verified Telegram account, **When** they submit their SIMS ID on the login page, **Then** a 6-digit code arrives in their Telegram within seconds and the page advances to an "enter your code" step.
2. **Given** a user who has just been sent a code, **When** they enter the correct code before it expires, **Then** they are logged in with exactly the same session, permissions, and role-appropriate landing page that password login would have given them.
3. **Given** a user who has just been sent a code, **When** they request a second code before using the first, **Then** the first code stops working and only the newest code is accepted.
4. **Given** a user whose account requires a password change, **When** they log in via a code, **Then** they are taken to the same forced password-change step that password login would have taken them to.
5. **Given** a user who entered a correct code, **When** they try to reuse that same code a second time, **Then** it is rejected.
6. **Given** a code that was issued more than its lifetime ago, **When** the user enters it, **Then** it is rejected and they are told to request a new one.

---

### User Story 2 - Get in when Telegram is unavailable (Priority: P1)

Telegram is down, blocked on the college network, or the bot's access has been revoked. An administrator needs to get into the system to fix things. They navigate to the fallback login address, sign in with their SIMS ID and password exactly as they do today, and get in.

**Why this priority**: Also P1, and **must ship at the same time as User Story 1, never after**. The moment the code-based login becomes the face of the login page, Telegram becomes the front door for every user. If the fallback is not reachable and proven on the same day, a Telegram outage locks every user — including the Super Admin — out of the system with no way back in. This story is what makes User Story 1 safe to ship.

**Independent Test**: Fully testable on its own and independent of the code flow — navigate directly to the fallback address, log in with SIMS ID and password, confirm a normal session. Can be verified even with the bot completely switched off, which is exactly the scenario it exists for.

**Acceptance Scenarios**:

1. **Given** the Telegram bot is completely unavailable, **When** a user goes to the fallback login address and enters a correct SIMS ID and password, **Then** they log in normally.
2. **Given** a user is on the fallback login page, **When** they enter wrong credentials, **Then** they get the same generic rejection they get today, revealing nothing about whether the account exists.
3. **Given** a user on the main login page who cannot use Telegram, **When** they look for another way in, **Then** the page tells them a fallback exists and how to reach it, without requiring them to guess the address.
4. **Given** any existing user, **When** the feature ships, **Then** their existing password still works unchanged — no user is required to re-enrol, reset, or re-register anything.

---

### User Story 3 - Be protected from someone guessing my code (Priority: P2)

An attacker knows a faculty member's SIMS ID (they are short, sequential, and printed on things). They request a code for that account and start guessing. The system stops them long before they can work through a meaningful fraction of the possibilities, and the real user is not permanently locked out of their own account as collateral.

**Why this priority**: P2 only because Stories 1 and 2 have no value without it being *present* — but it is separated here because it is independently testable and has its own distinct acceptance criteria. A 6-digit code has only a million possibilities; without a hard attempt limit, an unattended script would break in. This is not optional hardening, it is a precondition of shipping.

**Independent Test**: Testable on its own by repeatedly submitting wrong codes for a test account and confirming that guessing stops at the limit, that the account state reflects the lockout, and that a legitimate user can still recover.

**Acceptance Scenarios**:

1. **Given** a user has been sent a code, **When** wrong codes are submitted repeatedly, **Then** after a small fixed number of wrong attempts no further codes are accepted for that account, even correct ones.
2. **Given** an attacker is requesting codes for an account they do not control, **When** they request repeatedly, **Then** they are throttled — both to stop code-guessing and to stop the real user's Telegram being spammed as a nuisance.
3. **Given** a user successfully enters a correct code, **When** their login succeeds, **Then** their failed-attempt count resets to zero so ordinary typos never accumulate toward a lockout across separate sessions.
4. **Given** an account is locked from failed attempts, **When** the cool-off interval has elapsed, **Then** the account accepts codes normally again with a clean attempt count, without anyone having to intervene.
5. **Given** an account is locked from failed attempts, **When** the user requests a fresh code during the cool-off, **Then** the lock still holds — asking for a new code is not a way around the attempt limit.
6. **Given** an account is locked from failed attempts, **When** the user is told what happened, **Then** they are told they must wait and roughly how long, rather than being left with an unexplained refusal.

---

### Edge Cases

- **User has no linked Telegram** (e.g. an account created directly by an admin rather than via a Telegram invite): the code flow cannot work for them at all. They must be told, without being told whether the account exists, that they should use the fallback login.
- **User is deactivated or soft-deleted**: must not be able to obtain a code, and must not be able to redeem one issued before deactivation.
- **Someone submits a SIMS ID that does not exist**: must be indistinguishable — same message, same page transition, same timing characteristics — from a real account. SIMS IDs are short, sequential, and semi-public; the login page must not become a tool for discovering which ones are real.
- **Telegram delivery silently fails** (user blocked the bot, bot token revoked): the user waits for a code that will never arrive. They need a visible way out to the fallback login rather than a dead end.
- **User requests a code, then requests another, then enters the first**: the older code must be dead.
- **User leaves the code page open past expiry and then submits**: rejected with a clear "request a new code" outcome, not a generic failure.
- **A code is correct but the account was deactivated in the seconds between issue and entry**: must be rejected.
- **Concurrent redemption of the same code twice** (double-clicked submit, or a race): exactly one must succeed. This exact class of bug was found and fixed in 022 by an explicit concurrency test; the same guarantee is required here.
- **A locked-out user requests a new code during cool-off**: the new code is useless to them until the cool-off elapses. Whether to suppress sending it at all (to avoid handing the user a code they cannot use, and to avoid the Telegram noise) or to send it anyway is a design detail for `plan.md`; either way the lock must hold.
- **The Super Admin locks themselves out** by mistyping five times: they wait out the cool-off like anyone else. There is no one above them to appeal to, which is precisely why cool-off was chosen over an administrator-unlock model.

## Requirements *(mandatory)*

### Functional Requirements

**Requesting a code**

- **FR-001**: The default login page MUST ask only for a 4-digit SIMS ID as the first step.
- **FR-002**: On submitting a SIMS ID for an active, non-deleted user with a linked and verified Telegram account, the system MUST generate a 6-digit numeric code and deliver it to that user's Telegram.
- **FR-003**: The response to a code request MUST be identical — in wording, page behaviour, and observable timing — whether the SIMS ID exists, does not exist, belongs to a deactivated user, or belongs to a user with no linked Telegram. It MUST NOT be possible to use this endpoint to discover which SIMS IDs are real.
- **FR-004**: Requesting a new code MUST invalidate any previous unused code for that same user.
- **FR-005**: Code requests MUST be rate-limited per account, to prevent both code-guessing and using the bot to spam a user's Telegram.
- **FR-006**: A code MUST expire a short, fixed time after issue.

**Redeeming a code**

- **FR-007**: Submitting the correct, unexpired, unused code for an active, non-deleted user MUST establish exactly the same authenticated session that password login establishes today — same session mechanics, same duration, same role, same session-invalidation behaviour.
- **FR-008**: A code MUST be single-use. Redeeming it MUST atomically consume it such that two concurrent redemptions of the same code result in exactly one successful login.
- **FR-009**: A code MUST be rejected if it is expired, already used, does not match, or belongs to a user who is no longer active or has been deleted.
- **FR-010**: Codes MUST NOT be stored in a form that allows anyone with database read access to learn the code.
- **FR-011**: After a successful code login, the user MUST be subject to the existing forced password-change behaviour exactly as they would be after a password login.
- **FR-012**: A successful code login MUST be recorded in the system audit trail under an action distinct from password login and magic-link login.

**Brute-force protection**

- **FR-013**: The system MUST count consecutive failed code attempts per account and MUST stop accepting codes for that account once a small fixed limit is reached, using the account attempt counter that already exists on the user record.
- **FR-014**: A successful code login MUST reset that account's failed-attempt counter to zero.
- **FR-015**: Code redemption MUST additionally be rate-limited by origin, independently of the per-account counter, so an attacker cannot cheaply cycle across many accounts.
- **FR-016**: A locked account MUST unlock automatically once a fixed cool-off interval has passed since it was locked, and MUST accept codes normally again from that moment with its failed-attempt count cleared.
- **FR-016a**: The cool-off MUST be the *only* recovery path. There MUST NOT be an administrator "unlock" action, and a successful fallback-password login MUST NOT clear an active lock. This is a deliberate constraint, not an omission: it guarantees a lockout can neither be weaponised for permanent denial-of-service nor leave any user — including the Super Admin — dependent on someone else to regain access.
- **FR-016b**: While an account is in cool-off, requesting a new code MUST NOT lift the lock or reset the attempt count. Otherwise the limit would be trivially bypassable by simply asking for another code.

**Fallback and preservation**

- **FR-017**: Password login MUST remain fully functional and MUST be reachable at a distinct, stable address separate from the default login page.
- **FR-018**: The default login page MUST make it discoverable that a fallback login exists, so a user with no Telegram or with undelivered codes is not stranded.
- **FR-019**: The existing Telegram magic-link login MUST continue to work unchanged and remain offered.
- **FR-020**: All existing password-related flows MUST continue to work unchanged: temporary passwords issued on invite activation, the self-service password reset via the bot, administrator-initiated login resets, and the forced password-change step.
- **FR-021**: No existing user may be required to re-enrol, reset a password, or take any migration action as a result of this feature shipping.
- **FR-022**: `CONSTITUTION.md` MUST be updated to record this reversal explicitly, with a version-history entry stating that it is deliberate and owner-approved, following the precedent set by 022.

### Key Entities

- **Login Code**: A short-lived, single-use credential belonging to exactly one user. Holds who it is for, an unreadable representation of the code itself, when it expires, and whether it has been consumed. Superseded when a newer one is issued for the same user. Conceptually parallel to the existing magic-link token, which has the same lifecycle shape.
- **User (existing, extended in use only)**: Already carries a dormant consecutive-failed-attempt counter left over from the abandoned OTP system. This feature puts that existing field back into service rather than introducing a new one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can complete a full login on a desktop browser, using only a code read from a phone, in under 60 seconds from landing on the login page — with no Telegram account present on the desktop.
- **SC-002**: A person who knows a valid SIMS ID but has no access to that account's Telegram cannot log in via the code flow, at any number of attempts.
- **SC-003**: Submitting a non-existent SIMS ID is indistinguishable from submitting a real one — no difference in message, page behaviour, or response timing that could be used to enumerate accounts.
- **SC-004**: An account stops accepting codes within 5 consecutive wrong attempts, capping an attacker's success probability at a negligible fraction of the 1,000,000-code space before being cut off.
- **SC-004a**: A locked account becomes usable again with no human intervention once the cool-off elapses — meaning no lockout can ever become permanent, and no lockout can ever require a support request.
- **SC-005**: With the Telegram bot fully switched off, an administrator can still log in through the fallback path in under 2 minutes without any prior preparation.
- **SC-006**: Zero regression: every login method that works the day before this ships still works the day after, and no user is asked to change anything about their account.
- **SC-007**: A code is unusable after its first successful use, after its expiry, and after a newer code is issued — verified in all three cases.
- **SC-008**: Two simultaneous redemptions of the same valid code result in exactly one session, never two.

## Assumptions

- **Code lifetime: 5 minutes.** Chosen to match the original OTP design recorded in `.specify/memory/constitution.md` ("OTP expires in 5 minutes, max 5 attempts before lockout") — the same design that left the dormant attempt-counter field on the user record. Long enough to switch devices and read a message, short enough to limit exposure.
- **Attempt limit: 5 consecutive failures**, from the same original design.
- **Cool-off interval: 15 minutes.** Long enough that sustained guessing is pointless (5 guesses per 15 minutes, against a code that has itself expired after 5 minutes — so a patient attacker is guessing at a target that no longer exists), short enough that a legitimate user who fat-fingered their code five times is not meaningfully obstructed.
- **A cool-off needs a "locked at" moment, which the existing counter alone cannot express.** The dormant `otp_failed_attempts` field on the user record is a bare integer — it records *how many* failures, not *when*. Time-based auto-unlock is therefore not implementable from that field alone, and this feature will need one additional piece of per-user state to carry the timestamp. This is a known, deliberate departure from the original "reuse the existing column rather than adding anything" instruction: the existing column is still reused for the count, but the count alone cannot answer "has the cool-off elapsed?". `plan.md` decides the exact mechanism.
- **Per-account code-request throttle: roughly one per minute.** Sits between the existing magic-link throttle (1 per 30 seconds) and the existing bot password-reset throttle (1 per hour). Frequent enough not to obstruct a user who mistypes their SIMS ID, slow enough that the bot cannot be used to harass someone's Telegram.
- **Every user who can use this feature already has a linked Telegram account.** Accounts are onboarded by activating an invite inside Telegram, which links and verifies the account as a side effect, so in practice this is the whole active user base. Accounts created by other means remain served by the fallback.
- **The fallback login address is not a secret.** Hiding it from the main page reduces confusion for the common case; it is not a security control, and the spec does not treat it as one. Password login retains its own existing protections.
- **The magic link stays exactly as it is.** This feature adds a second Telegram-based route rather than replacing 022. Both are offered.
- **Delivery is best-effort and unacknowledged.** The system cannot know whether a Telegram message was actually read, so the design cannot depend on delivery confirmation — hence the requirement that the user always has a visible escape to the fallback.
- **`.specify/memory/constitution.md` is stale** (it describes 4 roles, 14 tables, and OTP-only auth — none of which match the current system) and is treated here only as a historical record of the original OTP parameters. `CONSTITUTION.md` at the project root is the source of truth, per its own header and `CLAUDE.md`.
