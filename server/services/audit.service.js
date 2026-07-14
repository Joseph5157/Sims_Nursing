const prisma = require('../lib/prisma');

/**
 * Log a system-level admin action to admin_audit_log.
 *
 * @param {object} params
 * @param {string} params.actorId   - User ID of who performed the action
 * @param {string} params.action    - Short action verb (e.g. 'CREATE_USER', 'DEACTIVATE_USER')
 * @param {string} [params.targetId]   - ID of the affected resource
 * @param {string} [params.targetType] - Resource type label (e.g. 'user', 'violation')
 * @param {object} [params.metadata]   - Arbitrary context data
 */
async function logAction({ actorId, action, targetId, targetType, metadata }) {
  await prisma.adminAuditLog.create({
    data: {
      actor_id: actorId,
      action,
      target_id: targetId ?? null,
      target_type: targetType ?? null,
      metadata: metadata ?? null,
    },
  });
}

module.exports = { logAction };
