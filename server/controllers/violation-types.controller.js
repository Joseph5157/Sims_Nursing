const prisma = require('../lib/prisma');

// ─── GET /violation-types ─────────────────────────────────────────────────────
// All Auth — returns active types by default.
// Admin/Super Admin can pass ?all=true to include inactive types.

async function listViolationTypes(req, res) {
  const showAll = req.query.all === 'true' && ['admin', 'super_admin'].includes(req.user.role);
  const where = showAll ? {} : { is_active: true };

  const types = await prisma.violationType.findMany({
    where,
    orderBy: [{ is_system: 'desc' }, { name: 'asc' }],
    select: {
      id:           true,
      name:         true,
      default_fine: true,
      is_active:    true,
      is_system:    true,
      created_at:   true,
    },
  });

  res.json({ data: types, total: types.length });
}

// ─── POST /violation-types ────────────────────────────────────────────────────

async function createViolationType(req, res) {
  const { name, default_fine } = req.body;

  const existing = await prisma.violationType.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) {
    return res.status(409).json({ error: true, code: 'CONFLICT', message: 'A student violation type with this name already exists.' });
  }

  const type = await prisma.violationType.create({
    data: { name, default_fine, created_by: req.user.id },
  });

  res.status(201).json(type);
}

// ─── PATCH /violation-types/:id ───────────────────────────────────────────────

async function updateViolationType(req, res) {
  const type = await prisma.violationType.findUnique({ where: { id: req.params.id } });
  if (!type) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student violation type not found.' });
  }

  const { name, default_fine } = req.body;

  // Check name uniqueness if changing name
  if (name && name.toLowerCase() !== type.name.toLowerCase()) {
    const conflict = await prisma.violationType.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, id: { not: type.id } },
    });
    if (conflict) {
      return res.status(409).json({ error: true, code: 'CONFLICT', message: 'A student violation type with this name already exists.' });
    }
  }

  const updated = await prisma.violationType.update({
    where: { id: req.params.id },
    data: {
      ...(name         !== undefined && { name }),
      ...(default_fine !== undefined && { default_fine }),
    },
  });

  res.json(updated);
}

// ─── PATCH /violation-types/:id/deactivate ───────────────────────────────────

async function deactivateViolationType(req, res) {
  const type = await prisma.violationType.findUnique({ where: { id: req.params.id } });
  if (!type) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student violation type not found.' });
  }
  if (!type.is_active) {
    return res.status(409).json({ error: true, code: 'CONFLICT', message: 'Student violation type is already inactive.' });
  }

  const updated = await prisma.violationType.update({
    where: { id: req.params.id },
    data:  { is_active: false },
  });

  res.json(updated);
}

// ─── PATCH /violation-types/:id/reactivate ──────────────────────────────────

async function reactivateViolationType(req, res) {
  const type = await prisma.violationType.findUnique({ where: { id: req.params.id } });
  if (!type) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student violation type not found.' });
  }
  if (type.is_active) {
    return res.status(409).json({ error: true, code: 'CONFLICT', message: 'Student violation type is already active.' });
  }

  const updated = await prisma.violationType.update({
    where: { id: req.params.id },
    data:  { is_active: true },
  });

  res.json(updated);
}

// ─── DELETE /violation-types/:id ─────────────────────────────────────────────

async function deleteViolationType(req, res) {
  const type = await prisma.violationType.findUnique({ where: { id: req.params.id } });
  if (!type) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Student violation type not found.' });
  }
  if (type.is_system) {
    return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'System student violation types cannot be deleted.' });
  }

  // Prevent delete if violations already reference this type
  const usageCount = await prisma.violation.count({ where: { violation_type_id: req.params.id, deleted_at: null } });
  if (usageCount > 0) {
    return res.status(409).json({
      error: true,
      code: 'TYPE_IN_USE',
      message: `Cannot delete — ${usageCount} student violation record(s) use this type. Deactivate it instead.`,
    });
  }

  await prisma.violationType.delete({ where: { id: req.params.id } });

  res.json({ message: 'Student violation type deleted.' });
}

module.exports = {
  listViolationTypes,
  createViolationType,
  updateViolationType,
  deactivateViolationType,
  reactivateViolationType,
  deleteViolationType,
};
