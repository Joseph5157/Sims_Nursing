const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { logAction } = require('../services/audit.service');

/**
 * Helper: Return safe invite object without sensitive fields
 */
const safeInvite = (invite) => ({
  id: invite.id,
  name: invite.name,
  email: invite.email,
  phone: invite.phone,
  role: invite.role,
  department: invite.department,
  designation: invite.designation,
  title: invite.title,
  invite_expires_at: invite.invite_expires_at,
  invited_by: invite.invited_by,
  created_at: invite.created_at,
});

/**
 * POST /invites
 * Create a new pending invite for a user
 */
async function createInvite(req, res) {
  const { name, email, phone, role, department, designation, title } = req.body;

  // Role-scope guard: admin can only invite faculty
  if (req.user.role === 'admin' && role !== 'faculty') {
    return res.status(403).json({
      error: true,
      code: 'FORBIDDEN',
      message: 'Admin users can only invite faculty.',
    });
  }

  // Check for duplicate: either active user or pending invite with this email
  const [existingUser, existingInvite] = await Promise.all([
    prisma.user.findFirst({
      where: { email, deleted_at: null },
      select: { id: true },
    }),
    prisma.pendingInvite.findUnique({
      where: { email },
      select: { id: true },
    }),
  ]);

  if (existingUser || existingInvite) {
    return res.status(409).json({
      error: true,
      code: 'EMAIL_TAKEN',
      message: 'An account or pending invite already exists for this email.',
    });
  }

  // Generate token
  const token = crypto.randomBytes(32).toString('hex');
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return res.status(500).json({
      error: true,
      code: 'BOT_NOT_CONFIGURED',
      message: 'Telegram bot not configured.',
    });
  }
  const invite_link = `https://t.me/${botUsername}?start=invite_${token}`;

  // Create pending invite
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const invite = await prisma.pendingInvite.create({
    data: {
      name,
      email,
      phone: phone || null,
      role,
      department: department || null,
      designation: designation || null,
      title: title || null,
      invite_token: token,
      invite_expires_at: expiresAt,
      invited_by: req.user.id,
    },
  });

  // Fire-and-forget audit log
  logAction({
    actorId: req.user.id,
    action: 'CREATE_INVITE',
    targetId: invite.id,
    targetType: 'pending_invite',
    metadata: { email, role },
  }).catch((err) => {
    // Log error but don't fail the request
    console.error('Audit log error in createInvite:', err);
  });

  res.status(201).json({
    invite: safeInvite(invite),
    invite_link,
  });
}

/**
 * GET /invites
 * List all pending invites
 */
async function listInvites(req, res) {
  const invites = await prisma.pendingInvite.findMany({
    orderBy: { created_at: 'desc' },
    include: {
      inviter: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  // Map through safeInvite to never expose invite_token
  const safeInvites = invites.map((inv) => ({
    ...safeInvite(inv),
    inviter: inv.inviter,
  }));

  res.json({ data: safeInvites });
}

/**
 * POST /invites/:id/regenerate
 * Generate a new invite link for an existing pending invite
 */
async function regenerateInvite(req, res) {
  const { id } = req.params;

  const invite = await prisma.pendingInvite.findUnique({ where: { id } });
  if (!invite) {
    return res.status(404).json({
      error: true,
      code: 'NOT_FOUND',
      message: 'Pending invite not found.',
    });
  }

  // Role-scope guard: admin can only regenerate faculty invites
  if (req.user.role === 'admin' && invite.role !== 'faculty') {
    return res.status(403).json({
      error: true,
      code: 'FORBIDDEN',
      message: 'Admin users can only manage faculty invites.',
    });
  }

  // Generate new token
  const newToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return res.status(500).json({
      error: true,
      code: 'BOT_NOT_CONFIGURED',
      message: 'Telegram bot not configured.',
    });
  }
  const invite_link = `https://t.me/${botUsername}?start=invite_${newToken}`;

  // Update invite
  await prisma.pendingInvite.update({
    where: { id },
    data: {
      invite_token: newToken,
      invite_expires_at: expiresAt,
    },
  });

  // Audit log
  await logAction({
    actorId: req.user.id,
    action: 'REGENERATE_INVITE',
    targetId: id,
    targetType: 'pending_invite',
  });

  res.json({ invite_link });
}

/**
 * DELETE /invites/:id
 * Cancel a pending invite
 */
async function cancelInvite(req, res) {
  const { id } = req.params;

  const invite = await prisma.pendingInvite.findUnique({ where: { id } });
  if (!invite) {
    return res.status(404).json({
      error: true,
      code: 'NOT_FOUND',
      message: 'Pending invite not found.',
    });
  }

  // Role-scope guard: admin can only cancel faculty invites
  if (req.user.role === 'admin' && invite.role !== 'faculty') {
    return res.status(403).json({
      error: true,
      code: 'FORBIDDEN',
      message: 'Admin users can only manage faculty invites.',
    });
  }

  // Delete invite
  await prisma.pendingInvite.delete({ where: { id } });

  // Audit log
  await logAction({
    actorId: req.user.id,
    action: 'CANCEL_INVITE',
    targetId: id,
    targetType: 'pending_invite',
  });

  res.json({ success: true });
}

module.exports = {
  createInvite,
  listInvites,
  regenerateInvite,
  cancelInvite,
};
