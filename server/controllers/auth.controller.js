const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { authCookieOptions, csrfCookieOptions, clearAuthOptions, clearCsrfOptions } = require('../lib/cookieOptions');
const { safeUser } = require('../lib/safeUser');

// ─── POST /auth/login ─────────────────────────────────────────────────────────

async function login(req, res) {
  try {
    const { password } = req.body;
    const identifier = String(req.body.identifier || req.body.email || '').trim();
    const isSimsId = /^\d{4}$/.test(identifier);

    const user = await prisma.user.findUnique({
      where: isSimsId
        ? { sims_id: Number(identifier) }
        : { email: identifier.toLowerCase() },
    });

    // Generic response — never reveal whether user exists or has no password
    if (!user || user.deleted_at || user.status !== 'active' || !user.password_hash) {
      return res.status(401).json({
        error: true,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid SIMS ID/email or password.',
      });
    }

    // Safety check: ensure role exists
    if (!user.role) {
      logger.error(`[AUTH] User ${user.id} has no role assigned`);
      return res.status(500).json({
        error: true,
        code: 'INVALID_USER_STATE',
        message: 'User account configuration error. Please contact administrator.',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: true,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid SIMS ID/email or password.',
      });
    }

    // Issue JWT and CSRF tokens
    const token = jwt.sign(
      { sub: user.id, role: user.role, session_version: user.session_version },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

    const csrfToken = crypto.randomBytes(32).toString('hex');

    res.cookie('sims_token', token, authCookieOptions());
    res.cookie('sims_csrf', csrfToken, csrfCookieOptions());

    // Log successful login — non-fatal: cookies are already set above, so an
    // audit-insert hiccup must not turn a successful login into a 503 (the user
    // would see an error while actually being logged in).
    const { logAction } = require('../services/audit.service');
    try {
      await logAction({
        actorId: user.id,
        action: 'PASSWORD_LOGIN',
        targetId: user.id,
        targetType: 'user',
        metadata: { identifier_type: isSimsId ? 'sims_id' : 'email' },
      });
    } catch (auditErr) {
      logger.warn(`[AUTH] login audit log failed (login still succeeded): ${auditErr.message}`);
    }

    const response = {
      ...safeUser(user),
      must_change_password: user.must_change_password,
    };

    logger.info(`[AUTH] Login successful: user=${user.id}, sims_id=${user.sims_id}, role=${user.role}`);

    res.json(response);
  } catch (err) {
    logger.error(`login error: ${err.message}`);
    res.status(503).json({ error: true, code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable. Please try again.' });
  }
}

// ─── GET /auth/telegram/:token ─────────────────────────────────────────────────
// Telegram magic-link login (022-telegram-magic-link-login). Reached only via a
// real browser navigation (a tapped Telegram link), never a fetch/XHR — so the
// response is always a redirect, never JSON. See
// specs/022-telegram-magic-link-login/contracts/telegram-login-endpoint.md.

async function telegramLogin(req, res) {
  const { token } = req.params;

  try {
    // Atomic claim first — this is the sole authorization decision (research.md
    // §1). The diagnostic lookup below only ever runs *after* a failed claim, so
    // it reflects post-claim-attempt state (e.g. a token another concurrent
    // request just won) rather than a stale pre-claim snapshot.
    const claim = await prisma.telegramLoginToken.updateMany({
      where: {
        token,
        used_at: null,
        expires_at: { gt: new Date() },
        user: { status: 'active', deleted_at: null },
      },
      data: { used_at: new Date() },
    });

    if (claim.count !== 1) {
      const existing = await prisma.telegramLoginToken.findUnique({
        where: { token },
        select: { expires_at: true, used_at: true, user: { select: { status: true, deleted_at: true } } },
      });

      let code = 'not_found';
      if (existing) {
        if (existing.used_at) code = 'used';
        else if (new Date(existing.expires_at) <= new Date()) code = 'expired';
        else if (!existing.user || existing.user.status !== 'active' || existing.user.deleted_at) code = 'inactive_account';
      }
      return res.redirect(`/login?telegram_error=${code}`);
    }

    const claimed = await prisma.telegramLoginToken.findUnique({ where: { token }, include: { user: true } });
    const user = claimed.user;

    const jwtToken = jwt.sign(
      { sub: user.id, role: user.role, session_version: user.session_version },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );
    const csrfToken = crypto.randomBytes(32).toString('hex');

    res.cookie('sims_token', jwtToken, authCookieOptions());
    res.cookie('sims_csrf', csrfToken, csrfCookieOptions());

    const { logAction } = require('../services/audit.service');
    try {
      await logAction({
        actorId: user.id,
        action: 'TELEGRAM_LOGIN',
        targetId: user.id,
        targetType: 'user',
      });
    } catch (auditErr) {
      logger.warn(`[AUTH] telegram-login audit log failed (login still succeeded): ${auditErr.message}`);
    }

    logger.info(`[AUTH] Telegram-link login successful: user=${user.id}, role=${user.role}`);

    return res.redirect('/');
  } catch (err) {
    logger.error(`telegramLogin error: ${err.message}`);
    return res.redirect('/login?telegram_error=not_found');
  }
}

// ─── POST /auth/change-password ────────────────────────────────────────────────

async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id; // From authenticate middleware

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.deleted_at) {
      return res.status(401).json({
        error: true,
        code: 'INVALID_USER',
        message: 'User not found.',
      });
    }

    // If password_hash exists, verify current password
    if (user.password_hash) {
      const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          error: true,
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password is incorrect.',
        });
      }
    }
    // If password_hash is null (first-time set), skip current_password check

    // Hash new password and update
    const newPasswordHash = await bcrypt.hash(new_password, 12);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: newPasswordHash,
        must_change_password: false,
        session_version: { increment: 1 },
      },
    });

    // Log password change — non-fatal: the password is already updated, so an
    // audit-insert hiccup must not report failure for a change that succeeded.
    const { logAction } = require('../services/audit.service');
    try {
      await logAction({
        actorId: userId,
        action: 'PASSWORD_CHANGED',
        targetId: userId,
        targetType: 'user',
        metadata: { changed_by: 'self' },
      });
    } catch (auditErr) {
      logger.warn(`[AUTH] password-change audit log failed (change still succeeded): ${auditErr.message}`);
    }

    // Reissue JWT with new session_version so the current session stays valid
    const newToken = jwt.sign(
      { sub: updated.id, role: updated.role, session_version: updated.session_version },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );
    res.cookie('sims_token', newToken, authCookieOptions());

    res.json({ ...safeUser(updated), must_change_password: updated.must_change_password });
  } catch (err) {
    logger.error(`changePassword error: ${err.message}`);
    res.status(503).json({ error: true, code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable. Please try again.' });
  }
}

// ─── POST /auth/logout ────────────────────────────────────────────────────────

async function logout(req, res) {
  // ISSUE-11: clear both cookies using the same options used to set them
  res.clearCookie('sims_token', clearAuthOptions());
  res.clearCookie('sims_csrf', clearCsrfOptions());
  res.json({ message: 'Logged out successfully.' });
}

module.exports = { login, changePassword, logout, telegramLogin };
