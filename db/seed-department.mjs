#!/usr/bin/env node
/**
 * One-time setup script for cloning this app to a new department.
 * Creates the department's first Super Admin, seeds a generic default
 * violation-type list, and ensures a system_config row exists so Duty
 * Timing Settings has something to display on first load.
 *
 * Idempotent — safe to re-run. Existing rows are left alone (this never
 * overwrites data), so re-running after a partial failure just fills in
 * whatever is still missing.
 *
 * Usage:
 *   node db/seed-department.mjs \
 *     --institution "SIMS College of Engineering" \
 *     --admin-email admin@engineering.example.edu \
 *     --admin-name "Admin Name" \
 *     [--admin-telegram-id 123456789] \
 *     [--admin-phone 9990001111] \
 *     [--admin-password Some_Pinned_Password]
 *
 * Every flag can also come from the environment (useful in CI/deploy
 * scripts) — see the fallbacks below. --admin-telegram-id is optional:
 * per the Constitution, a user with no Telegram linked can still log in
 * with email + password, they just won't get Telegram notifications
 * until an admin links one later via the Users page.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pkg = require('../server/node_modules/@prisma/client/index.js');
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function generatePassword() {
  return crypto.randomBytes(12).toString('base64url');
}

// Generic, non-pharmacy-flavored defaults — every department deals with
// these regardless of subject. Admin can add/edit/deactivate types from
// the Violation Types page immediately after first login.
const DEFAULT_VIOLATION_TYPES = [
  { name: 'Mobile phone use during duty',    default_fine: 200, is_system: false },
  { name: 'Dress code violation',            default_fine: 100, is_system: false },
  { name: 'Missing ID card',                 default_fine: 50,  is_system: false },
  { name: 'Late arrival to duty post',       default_fine: 100, is_system: false },
  { name: 'Unauthorized absence from duty',  default_fine: 300, is_system: false },
  { name: 'Early departure from duty',       default_fine: 100, is_system: false },
  { name: 'Negligence during duty',          default_fine: 200, is_system: false },
  { name: 'Disruptive or rude behavior',     default_fine: 250, is_system: false },
  { name: 'Insubordination',                 default_fine: 500, is_system: false },
  { name: 'Unauthorized photography',        default_fine: 300, is_system: false },
  { name: 'Others',                          default_fine: 0,   is_system: true  },
];

async function seedSuperAdmin(args) {
  const email = args['admin-email'] || process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
  const name = args['admin-name'] || process.env.BOOTSTRAP_SUPER_ADMIN_NAME || 'Super Admin';
  const telegramId = args['admin-telegram-id'] || process.env.BOOTSTRAP_SUPER_ADMIN_TELEGRAM_ID || null;
  const phone = args['admin-phone'] || process.env.BOOTSTRAP_SUPER_ADMIN_PHONE || null;
  const department = args.institution || process.env.BOOTSTRAP_SUPER_ADMIN_DEPARTMENT || 'Administration';
  const designation = args['admin-designation'] || process.env.BOOTSTRAP_SUPER_ADMIN_DESIGNATION || 'Super Admin';

  if (!email) {
    throw new Error('--admin-email (or BOOTSTRAP_SUPER_ADMIN_EMAIL) is required');
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: 'super_admin', deleted_at: null },
  });
  if (existingSuperAdmin) {
    console.log(`[super-admin] SKIP — already exists (${existingSuperAdmin.email})`);
    return;
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new Error(`Cannot bootstrap: email already exists: ${email}`);
  }

  if (telegramId) {
    const existingTelegram = await prisma.user.findUnique({ where: { telegram_id: telegramId } });
    if (existingTelegram) {
      throw new Error(`Cannot bootstrap: Telegram ID already exists: ${telegramId}`);
    }
  }

  const generatedPassword = args['admin-password'] || process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD || generatePassword();
  const passwordHash = await bcrypt.hash(generatedPassword, 12);

  const superAdmin = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      role: 'super_admin',
      department,
      designation,
      status: 'active',
      telegram_id: telegramId,
      telegram_verified: Boolean(telegramId),
      password_hash: passwordHash,
      must_change_password: true,
      session_version: 1,
      approved_at: new Date(),
    },
  });

  console.log(`[super-admin] CREATE — ${superAdmin.email}`);
  if (!args['admin-password'] && !process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD) {
    console.log('');
    console.log('================================================================');
    console.log('  GENERATED PASSWORD (shown once — not stored anywhere in plaintext)');
    console.log(`  ${generatedPassword}`);
    console.log('  Log in with this password immediately; the account is flagged');
    console.log('  must_change_password = true, so it will be forced to change.');
    console.log('================================================================');
    console.log('');
  }
  if (!telegramId) {
    console.log('[super-admin] No Telegram ID given — account works via email+password.');
    console.log('               Link Telegram later from Profile to enable notifications.');
  }

  return superAdmin;
}

async function seedViolationTypes(creatorId) {
  let created = 0;
  let skipped = 0;

  for (const vt of DEFAULT_VIOLATION_TYPES) {
    const existing = await prisma.violationType.findFirst({ where: { name: vt.name } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.violationType.create({
      data: {
        name: vt.name,
        default_fine: vt.default_fine,
        is_system: vt.is_system,
        is_active: true,
        created_by: creatorId,
      },
    });
    created++;
  }

  console.log(`[violation-types] ${created} created, ${skipped} already existed.`);
}

async function seedSystemConfig() {
  const existing = await prisma.systemConfig.findFirst();
  if (existing) {
    console.log('[system-config] SKIP — row already exists.');
    return;
  }
  // No fields passed — every column has a schema @default (8:00 AM /
  // 1:00 PM session starts, 15-min late threshold, etc.). Admin adjusts
  // via Duty Timing Settings after login; nothing here is department-specific.
  await prisma.systemConfig.create({ data: {} });
  console.log('[system-config] CREATE — default timing thresholds applied.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
Usage: node db/seed-department.mjs --institution "..." --admin-email "..." --admin-name "..." [options]

Required:
  --institution        Institution/department name (also stored on the admin's user.department)
  --admin-email         First Super Admin's login email

Optional:
  --admin-name          Defaults to "Super Admin"
  --admin-telegram-id   Numeric Telegram chat ID (get via /myid on the bot). Omit if not linking yet.
  --admin-phone
  --admin-designation   Defaults to "Super Admin"
  --admin-password      Pins the initial password instead of generating a random one
`);
    process.exit(0);
  }

  console.log(`Seeding department: ${args.institution || '(institution name not given)'}\n`);

  const superAdmin = await seedSuperAdmin(args);

  // If a super_admin already existed (SKIP case), superAdmin is undefined —
  // fall back to whichever one is on the account so violation-type seeding
  // still has a valid created_by.
  const creator = superAdmin || (await prisma.user.findFirst({
    where: { role: 'super_admin', deleted_at: null },
    select: { id: true },
  }));

  if (!creator) {
    throw new Error('No super_admin available after seeding — cannot attribute violation types.');
  }

  await seedViolationTypes(creator.id);
  await seedSystemConfig();

  console.log('\nDone. Next: log in as the Super Admin, change the temporary password,');
  console.log('then review Violation Types and Duty Timing Settings for this department.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
