const prisma = require('../lib/prisma');

const MESSAGE_INCLUDE = {
  sender:   { select: { id: true, name: true, email: true, role: true } },
  receiver: { select: { id: true, name: true, email: true, role: true } },
};

// ─── POST /messages — All Auth ────────────────────────────────────────────────

async function sendMessage(req, res) {
  const { to_user_id, subject, body } = req.body;

  if (to_user_id === req.user.id) {
    return res.status(400).json({ error: true, code: 'BAD_REQUEST', message: 'You cannot send a message to yourself.' });
  }

  const recipient = await prisma.user.findUnique({ where: { id: to_user_id } });
  if (!recipient || recipient.deleted_at || recipient.status !== 'active') {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Recipient not found or inactive.' });
  }

  // Messaging is restricted to admin↔faculty communication — faculty may not
  // message other faculty. Admin/super_admin can message anyone.
  if (req.user.role === 'faculty' && recipient.role === 'faculty') {
    return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'Faculty can only message admins.' });
  }

  const message = await prisma.message.create({
    data: { from_user_id: req.user.id, to_user_id, subject, body },
    include: MESSAGE_INCLUDE,
  });

  res.status(201).json(message);
}

// ─── GET /messages/inbox — All Auth ───────────────────────────────────────────

async function getInbox(req, res) {
  const { page = '1', limit = '20' } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const where = { to_user_id: req.user.id, deleted_by_receiver: false };

  const [total, messages] = await Promise.all([
    prisma.message.count({ where }),
    prisma.message.findMany({
      where,
      include: MESSAGE_INCLUDE,
      orderBy: [{ is_read: 'asc' }, { created_at: 'desc' }],
      skip:    (pageNum - 1) * pageSize,
      take:    pageSize,
    }),
  ]);

  res.json({ data: messages, meta: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) } });
}

// ─── GET /messages/sent — All Auth ────────────────────────────────────────────

async function getSent(req, res) {
  const { page = '1', limit = '20' } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const where = { from_user_id: req.user.id, deleted_by_sender: false };

  const [total, messages] = await Promise.all([
    prisma.message.count({ where }),
    prisma.message.findMany({
      where,
      include: MESSAGE_INCLUDE,
      orderBy: { created_at: 'desc' },
      skip:    (pageNum - 1) * pageSize,
      take:    pageSize,
    }),
  ]);

  res.json({ data: messages, meta: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) } });
}

// ─── GET /messages/:id — All Auth ─────────────────────────────────────────────

async function getMessage(req, res) {
  const message = await prisma.message.findUnique({
    where:   { id: req.params.id },
    include: MESSAGE_INCLUDE,
  });

  if (!message) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Message not found.' });
  }

  const isSender   = message.from_user_id === req.user.id;
  const isReceiver = message.to_user_id   === req.user.id;

  if (!isSender && !isReceiver) {
    return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'Access denied.' });
  }

  // Check the caller hasn't soft-deleted this message from their view
  if (isSender   && message.deleted_by_sender)   {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Message not found.' });
  }
  if (isReceiver && message.deleted_by_receiver) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Message not found.' });
  }

  // Mark as read when the receiver views it
  if (isReceiver && !message.is_read) {
    await prisma.message.update({
      where: { id: message.id },
      data:  { is_read: true, read_at: new Date() },
    });
    message.is_read = true;
    message.read_at = new Date();
  }

  res.json(message);
}

// ─── PATCH /messages/:id/read — Receiver only ────────────────────────────────

async function markAsRead(req, res) {
  const message = await prisma.message.findUnique({ where: { id: req.params.id } });
  if (!message || message.to_user_id !== req.user.id) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Message not found.' });
  }
  if (message.is_read) return res.json(message);
  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { is_read: true, read_at: new Date() },
  });
  res.json(updated);
}

// ─── DELETE /messages/:id — All Auth ─────────────────────────────────────────

async function deleteMessage(req, res) {
  const message = await prisma.message.findUnique({ where: { id: req.params.id } });

  if (!message) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Message not found.' });
  }

  const isSender   = message.from_user_id === req.user.id;
  const isReceiver = message.to_user_id   === req.user.id;

  if (!isSender && !isReceiver) {
    return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'Access denied.' });
  }

  const data = {};
  if (isSender)   data.deleted_by_sender   = true;
  if (isReceiver) data.deleted_by_receiver = true;

  const updated = await prisma.message.update({ where: { id: message.id }, data });

  // Hard delete only when both sides have removed it
  if (updated.deleted_by_sender && updated.deleted_by_receiver) {
    await prisma.message.delete({ where: { id: message.id } });
  }

  res.json({ message: 'Message removed from your view.' });
}

module.exports = { sendMessage, getInbox, getSent, getMessage, markAsRead, deleteMessage };
