# SIMS DMS Bootstrap Super Admin Instructions

## Purpose

SIMS DMS is moving to a Telegram PendingInvite onboarding system:

```txt
Admin creates PendingInvite
User opens Telegram invite link
System creates real User only after Telegram activation
User logs in with Email + Telegram OTP
```

Because there are currently no old accounts in the system, the project needs exactly one initial account to start the process.

That first account should be a **Bootstrap Super Admin**.

---

## Required design decision

Do **not** create the first account through PendingInvite.

There is no existing admin yet to create or approve an invite. Therefore, the first account must be created by a secure seed/bootstrap script.

After the Bootstrap Super Admin is created, all future accounts should use the new PendingInvite + Telegram activation flow.

---

## Final desired flow

```txt
1. Developer sets bootstrap admin details in .env
2. Developer runs Prisma seed/bootstrap command
3. System creates one active super_admin user
4. Super Admin logs in using Email + Telegram OTP
5. Super Admin creates PendingInvites for all other users
6. Other users activate through Telegram invite links
```

---

## Environment variables to add

Add these to `.env` and `.env.example`:

```env
BOOTSTRAP_SUPER_ADMIN_EMAIL=admin@sims.local
BOOTSTRAP_SUPER_ADMIN_NAME=SIMS Super Admin
BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID=
BOOTSTRAP_SUPER_ADMIN_PHONE=
BOOTSTRAP_SUPER_ADMIN_DEPARTMENT=Administration
BOOTSTRAP_SUPER_ADMIN_DESIGNATION=Super Admin
```

Important:

- `BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID` is required for production bootstrap.
- Do not hardcode a real Telegram ID in source code.
- Do not commit real production Telegram IDs to Git.

---

## How to get Telegram ID

Add or keep a simple Telegram bot command:

```txt
/myid
```

When the user sends `/myid` to the bot, the bot should reply with their Telegram chat ID.

Example reply:

```txt
Your Telegram ID is: 123456789
```

The project owner/developer should put this value into:

```env
BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID=123456789
```

---

## Prisma/User seed behavior

Create or update the Prisma seed script so it creates exactly one Bootstrap Super Admin if no super admin exists.

Expected seed logic:

```txt
1. Read BOOTSTRAP_SUPER_ADMIN_EMAIL and BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID from env.
2. Validate both are present.
3. Check whether a super_admin already exists.
4. If a super_admin already exists, do nothing.
5. If no super_admin exists, create one active super_admin user.
6. Set telegram_verified=true.
7. Set status=active.
8. Set session_version=1 or default.
9. Do not create password fields.
10. Do not create PendingInvite for this first account.
```

---

## Example Prisma seed logic

Adapt field names according to the actual `User` model in `prisma/schema.prisma`.

```js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
  const name = process.env.BOOTSTRAP_SUPER_ADMIN_NAME || 'SIMS Super Admin';
  const telegramId = process.env.BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID;
  const phone = process.env.BOOTSTRAP_SUPER_ADMIN_PHONE || null;
  const department = process.env.BOOTSTRAP_SUPER_ADMIN_DEPARTMENT || 'Administration';
  const designation = process.env.BOOTSTRAP_SUPER_ADMIN_DESIGNATION || 'Super Admin';

  if (!email) {
    throw new Error('BOOTSTRAP_SUPER_ADMIN_EMAIL is required');
  }

  if (!telegramId) {
    throw new Error('BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID is required');
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      role: 'super_admin',
      deleted_at: null,
    },
  });

  if (existingSuperAdmin) {
    console.log('Bootstrap skipped: super_admin already exists');
    return;
  }

  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (existingEmail) {
    throw new Error(`Cannot bootstrap: email already exists: ${email}`);
  }

  const existingTelegram = await prisma.user.findUnique({
    where: { telegram_id: telegramId },
  });

  if (existingTelegram) {
    throw new Error(`Cannot bootstrap: Telegram ID already exists: ${telegramId}`);
  }

  await prisma.user.create({
    data: {
      name,
      email,
      phone,
      role: 'super_admin',
      department,
      designation,
      status: 'active',
      telegram_id: telegramId,
      telegram_verified: true,
      session_version: 1,
      approved_at: new Date(),
    },
  });

  console.log(`Bootstrap super_admin created: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## Important database constraints

Make sure the `User` table has these protections:

```txt
email unique
telegram_id unique nullable
```

The unique `telegram_id` is important so one Telegram account cannot be linked to multiple users.

---

## Login behavior for Bootstrap Super Admin

The Bootstrap Super Admin should use the same login flow as everyone else:

```txt
Email entered on login page
OTP sent to linked Telegram ID
OTP verified
JWT httpOnly cookie created
Redirect to Super Admin dashboard
```

Do not add a password login just for bootstrap.

Do not bypass OTP login in production.

---

## Frontend behavior

No special frontend page is required for bootstrap.

The Bootstrap Super Admin should log in from the normal login page using their email.

After login, they should see:

```txt
Super Admin dashboard
Invite User / Pending Invites section
Users list
```

---

## What not to do

Do not:

```txt
❌ Create a default password
❌ Store a password in .env
❌ Hardcode Telegram IDs in source code
❌ Create the first admin through PendingInvite
❌ Allow public self-registration
❌ Allow anyone to create the first admin from the browser in production
❌ Keep multiple bootstrap super admins created by repeated seed runs
```

---

## Recommended one-time setup steps

```bash
# 1. Set environment variables
BOOTSTRAP_SUPER_ADMIN_EMAIL=your-email@example.com
BOOTSTRAP_SUPER_ADMIN_NAME="Your Name"
BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID=your_telegram_chat_id

# 2. Run migrations
npx prisma migrate deploy

# 3. Run seed
npx prisma db seed

# 4. Start app
npm run start

# 5. Login with BOOTSTRAP_SUPER_ADMIN_EMAIL
# 6. Receive OTP in Telegram
# 7. Invite all other users from dashboard
```

---

# Claude Code / Codex Prompt

Use this prompt in Claude Code or Codex:

```txt
We are implementing a Telegram PendingInvite onboarding system in SIMS DMS.

There are currently no old accounts in the system. To start the process, we need exactly one Bootstrap Super Admin account created by seed/bootstrap logic.

Goal:
Create one initial active super_admin user directly from environment variables. After this first account exists, all other users must be created through the PendingInvite + Telegram activation flow.

Requirements:
1. Do not create the first account through PendingInvite.
2. Do not add password login.
3. Do not add public self-registration.
4. Do not hardcode Telegram IDs in source code.
5. Keep the normal login flow: Email + Telegram OTP + httpOnly JWT cookie + CSRF.
6. The Bootstrap Super Admin must have telegram_verified=true and status=active.
7. The Bootstrap Super Admin must log in using the same Email + Telegram OTP flow as everyone else.

Add these environment variables to .env.example:
- BOOTSTRAP_SUPER_ADMIN_EMAIL
- BOOTSTRAP_SUPER_ADMIN_NAME
- BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID
- BOOTSTRAP_SUPER_ADMIN_PHONE
- BOOTSTRAP_SUPER_ADMIN_DEPARTMENT
- BOOTSTRAP_SUPER_ADMIN_DESIGNATION

Seed/bootstrap behavior:
1. Read bootstrap admin details from env.
2. If no super_admin exists, create one active super_admin user.
3. If a super_admin already exists, skip creation safely.
4. Validate email and Telegram ID are provided.
5. Check duplicate email and duplicate telegram_id before creating.
6. Set role=super_admin.
7. Set status=active.
8. Set telegram_id from BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID.
9. Set telegram_verified=true.
10. Set approved_at=now if the User model has this field.
11. Do not create any password.
12. Do not create a PendingInvite for this bootstrap user.

Telegram bot:
1. Add or keep a /myid command.
2. When a Telegram user sends /myid, reply with their Telegram chat ID.
3. This helps the owner place their Telegram ID in .env for bootstrap.

Database:
1. Ensure users.email is unique.
2. Ensure users.telegram_id is unique nullable.

Tests:
1. Test seed creates super_admin when none exists.
2. Test seed skips when super_admin already exists.
3. Test seed fails if BOOTSTRAP_SUPER_ADMIN_EMAIL is missing.
4. Test seed fails if BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID is missing.
5. Test Bootstrap Super Admin can request OTP through normal login.
6. Test Bootstrap Super Admin can verify OTP and access super_admin dashboard.

After this is complete, continue implementing the PendingInvite flow for all future users.
```
