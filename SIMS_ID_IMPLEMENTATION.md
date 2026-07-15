# SIMS Short ID Implementation

## Number ranges

- `1000`–`1099`: `super_admin` and `admin`
- `1100`–`9999`: `faculty`

IDs are allocated sequentially by an atomic database counter. They are permanent and are not reused when a user or invite is deleted.

## Deployment

Run the normal production migration before starting the updated server:

```bash
npm run migrate:deploy
npm run generate
npm run build
npm start
```

Migration `20260715103000_add_sims_id_series` automatically assigns IDs to existing users and pending invites in creation order. It stops safely if the configured four-digit ranges do not have enough capacity.

## User flow changes

- New invites receive a SIMS ID immediately.
- Email is optional for new Telegram-first users.
- Activated users keep the SIMS ID originally assigned to the invite.
- The login form accepts the four-digit SIMS ID.
- Existing email login remains supported by the backend during migration.
- Telegram activation and password-reset messages show the SIMS ID.
- Linked users can send `/myid` to the Telegram bot to recover their SIMS ID.

## Operational note

The existing Telegram magic-link login remains available. This change establishes the short identifier and onboarding foundation; it does not replace the magic-link flow with a typed Telegram OTP flow.
