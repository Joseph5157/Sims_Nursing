const SERIES = Object.freeze({
  admin: { start: 1000, max: 1099 },
  faculty: { start: 1100, max: 9999 },
});

function seriesForRole(role) {
  return role === 'faculty' ? 'faculty' : 'admin';
}

/**
 * Allocate the next permanent short SIMS ID inside an existing Prisma
 * transaction. The counter update is atomic, so concurrent invites cannot
 * receive the same number. IDs are never decremented or reused.
 */
async function allocateSimsId(tx, role) {
  const series = seriesForRole(role);
  const config = SERIES[series];

  const counter = await tx.simsIdCounter.upsert({
    where: { series },
    create: { series, last_value: config.start },
    update: { last_value: { increment: 1 } },
  });

  if (counter.last_value > config.max) {
    const err = new Error(`${series} SIMS ID range is exhausted.`);
    err.code = 'SIMS_ID_RANGE_EXHAUSTED';
    throw err;
  }

  return counter.last_value;
}

module.exports = { SERIES, seriesForRole, allocateSimsId };
