/**
 * Seed default violation types for SIMS College of Pharmacy.
 * Safe to run multiple times — uses upsert by name.
 *
 * Usage:
 *   node prisma/seed-violation-types.js
 */

require('dotenv').config();
const { PrismaClient } = require('../server/node_modules/@prisma/client');

const prisma = new PrismaClient();

const VIOLATION_TYPES = [
  { name: 'Mobile phone use during duty',    default_fine: 200,  is_system: false },
  { name: 'Improper uniform / not in lab coat', default_fine: 100, is_system: false },
  { name: 'Haircut / grooming violation',    default_fine: 50,   is_system: false },
  { name: 'Missing ID card',                 default_fine: 50,   is_system: false },
  { name: 'Late arrival to duty post',       default_fine: 100,  is_system: false },
  { name: 'Unauthorized absence from duty',  default_fine: 300,  is_system: false },
  { name: 'Early departure from duty',       default_fine: 100,  is_system: false },
  { name: 'Sleeping / negligence during duty', default_fine: 200, is_system: false },
  { name: 'Disruptive or rude behavior',     default_fine: 250,  is_system: false },
  { name: 'Insubordination',                 default_fine: 500,  is_system: false },
  { name: 'Unauthorized photography',        default_fine: 300,  is_system: false },
  { name: 'Others',                          default_fine: 0,    is_system: true  },
];

async function main() {
  // Find a super_admin to use as created_by
  const creator = await prisma.user.findFirst({
    where: { role: 'super_admin', deleted_at: null },
    select: { id: true, email: true },
  });

  if (!creator) {
    throw new Error('No super_admin found. Run the bootstrap seed first.');
  }

  console.log(`Seeding violation types as: ${creator.email}\n`);

  let created = 0;
  let skipped = 0;

  for (const vt of VIOLATION_TYPES) {
    const existing = await prisma.violationType.findFirst({
      where: { name: vt.name },
    });

    if (existing) {
      console.log(`  SKIP  ${vt.name}`);
      skipped++;
      continue;
    }

    await prisma.violationType.create({
      data: {
        name:         vt.name,
        default_fine: vt.default_fine,
        is_system:    vt.is_system,
        is_active:    true,
        created_by:   creator.id,
      },
    });

    console.log(`  CREATE  ${vt.name} (₹${vt.default_fine}${vt.is_system ? ' · system' : ''})`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} already existed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
