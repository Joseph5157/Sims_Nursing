require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../server/node_modules/@prisma/client');

const prisma = new PrismaClient();
const { allocateSimsId } = require('../server/lib/simsId');

function generatePassword() {
  return crypto.randomBytes(12).toString('base64url');
}

async function main() {
  const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
  const name = process.env.BOOTSTRAP_SUPER_ADMIN_NAME || 'SIMS Super Admin';
  const telegramId = process.env.BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID;
  const phone = process.env.BOOTSTRAP_SUPER_ADMIN_PHONE || null;
  const department = process.env.BOOTSTRAP_SUPER_ADMIN_DEPARTMENT || 'Administration';
  const designation = process.env.BOOTSTRAP_SUPER_ADMIN_DESIGNATION || 'Super Admin';

  if (!email) {
    throw new Error('BOOTSTRAP_SUPER_ADMIN_EMAIL is required in .env to seed');
  }

  if (!telegramId) {
    throw new Error('BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID is required in .env to seed');
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      role: 'super_admin',
      deleted_at: null,
    },
  });

  if (existingSuperAdmin) {
    console.log(`Bootstrap skipped: super_admin already exists (${existingSuperAdmin.email})`);
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

  const generatedPassword = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD || generatePassword();
  const passwordHash = await bcrypt.hash(generatedPassword, 12);

  const superAdmin = await prisma.$transaction(async (tx) => {
    const simsId = await allocateSimsId(tx, 'super_admin');
    return tx.user.create({
      data: {
        name,
        sims_id: simsId,
        email,
        phone,
        role: 'super_admin',
        department,
        designation,
        status: 'active',
        telegram_id: telegramId,
        telegram_verified: true,
        password_hash: passwordHash,
        must_change_password: true,
        session_version: 1,
        approved_at: new Date(),
      },
    });
  });

  console.log(`Bootstrap super_admin created: SIMS ID ${superAdmin.sims_id} (${superAdmin.email})`);

  if (!process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD) {
    console.log('');
    console.log('================================================================');
    console.log('  GENERATED PASSWORD (shown once — not stored anywhere in plaintext)');
    console.log(`  ${generatedPassword}`);
    console.log('  Log in with this password immediately; the account is flagged');
    console.log('  must_change_password = true, so it will be forced to change.');
    console.log('================================================================');
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
