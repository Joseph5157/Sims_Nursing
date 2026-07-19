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

// ─── POST /auth/otp/request ───────────────────────────────────────────────────
// Request a new 6-digit OTP code for Telegram delivery (024-telegram-otp-login).
// Always returns generic 200 — never reveals whether account exists or is deliverable.
// If any condition fails (user missing, inactive, no Telegram, throttled, locked),
// the bcrypt overhead is still incurred so timing is uniform across branches.
// See specs/024-telegram-otp-login/research.md §4 (timing-safe non-enumeration).

async function requestOtp(req, res) {
  const { sims_id } = req.body;
  const { OTP_TTL_MS, OTP_REQUEST_THROTTLE_MS, generateOtpCode } = require('../lib/otp');
  const { sendMessage } = require('../lib/telegram');

  try {
    // Always run bcrypt regardless of outcome so timing is uniform across success/failure
    const { generateOtpCode: genCode } = require('../lib/otp');
    const plainCode = genCode();
    const bcryptStart = Date.now();
    const codeHash = await bcrypt.hash(plainCode, 12);
    logger.debug(`[OTP] bcrypt hash took ${Date.now() - bcryptStart}ms`);

    // Look up user by SIMS ID
    const user = await prisma.user.findUnique({
      where: { sims_id: parseInt(sims_id, 10) },
      select: {
        id: true,
        sims_id: true,
        telegram_id: true,
        telegram_verified: true,
        status: true,
        deleted_at: true,
        otp_locked_until: true,
        otpLoginCodes: {
          where: { used_at: null },
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { created_at: true },
        },
      },
    });

    // Determine if request should be fulfilled (generic logic, same timing cost applies)
    // ─── T028: Suppress during cool-off (don't generate or send code if locked) ───
    const now = new Date();
    let shouldIssueCode = false;
    if (user &&
        !user.deleted_at &&
        user.status === 'active' &&
        user.telegram_id &&
        user.telegram_verified &&
        (!user.otp_locked_until || user.otp_locked_until <= now)) { // Not locked (or lock lapsed)
      // Check per-account throttle: 60s between requests
      const lastCodeTime = user.otpLoginCodes?.[0]?.created_at;
      const timeSinceLastCode = lastCodeTime ? Date.now() - new Date(lastCodeTime).getTime() : Infinity;
      if (timeSinceLastCode >= OTP_REQUEST_THROTTLE_MS) {
        shouldIssueCode = true;
      }
    }

    // Issue code (or suppress during cool-off per research.md §6)
    if (shouldIssueCode) {
      // Atomic: delete unused codes for this user, then create new one
      await prisma.otpLoginCode.deleteMany({
        where: {
          user_id: user.id,
          used_at: null,
        },
      });

      await prisma.otpLoginCode.create({
        data: {
          user_id: user.id,
          code_hash: codeHash,
          expires_at: new Date(Date.now() + OTP_TTL_MS),
        },
      });

      // Send code to Telegram — fire without awaiting (research.md §4)
      // Never await delivery; log errors but don't fail the request
      sendMessage(user.telegram_id, `Your SIMS login code is: ${plainCode}\n\nValid for 5 minutes.`).catch((err) => {
        logger.error(`[OTP] Failed to send code to user ${user.id}: ${err.message}`);
      });
    }

    // Always return generic 200 (never reveals whether user exists, is active, etc.)
    res.json({ message: 'If an account with that SIMS ID exists, a code has been sent.' });
  } catch (err) {
    logger.error(`requestOtp error: ${err.message}`);
    res.status(503).json({ error: true, code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable. Please try again.' });
  }
}

// ─── POST /auth/otp/verify ────────────────────────────────────────────────────
// Verify a 6-digit OTP code and issue a session (024-telegram-otp-login).
// Enforces lockout after 5 failed attempts with 15-minute cool-off (US3).
// Ordering: lock-check → lapse-clear → code-verify → attempt-count (024 data-model.md).

async function verifyOtp(req, res) {
  const { sims_id, code } = req.body;
  const { OTP_LOCKOUT_THRESHOLD, OTP_COOLOFF_MS } = require('../lib/otp');

  try {
    // Look up user by SIMS ID
    const user = await prisma.user.findUnique({
      where: { sims_id: parseInt(sims_id, 10) },
      select: {
        id: true,
        sims_id: true,
        role: true,
        status: true,
        deleted_at: true,
        must_change_password: true,
        session_version: true,
        otp_locked_until: true,
        otp_failed_attempts: true,
      },
    });

    if (!user || user.deleted_at || user.status !== 'active') {
      // Generic rejection — never reveal account state
      return res.status(401).json({
        error: true,
        code: 'INVALID_OTP',
        message: 'Invalid code or SIMS ID.',
      });
    }

    // ─── T025: Lock check (FIRST, before code lookup) ───
    // If account is currently locked, reject immediately without attempting code verification.
    // Do NOT increment counter; doing so would let continued guessing hold the lock open indefinitely.
    const now = new Date();
    if (user.otp_locked_until && user.otp_locked_until > now) {
      return res.status(401).json({
        error: true,
        code: 'OTP_LOCKED',
        message: 'Account locked due to too many failed attempts. Try again later.',
      });
    }

    // ─── T026: Lapse check (SECOND, after lock check) ───
    // If lock exists but has passed, clear BOTH otp_locked_until AND otp_failed_attempts
    // before proceeding. Clearing only the timestamp would leave the counter at 5, causing
    // the next single failure to re-lock (reset-on-lapse trap, data-model.md).
    if (user.otp_locked_until && user.otp_locked_until <= now) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          otp_locked_until: null,
          otp_failed_attempts: 0,
        },
      });
      // Reload user state after clear
      user.otp_locked_until = null;
      user.otp_failed_attempts = 0;
    }

    // Find live code for this user
    const codeRow = await prisma.otpLoginCode.findFirst({
      where: {
        user_id: user.id,
        used_at: null,
        expires_at: { gt: now },
      },
      select: { id: true, code_hash: true },
    });

    if (!codeRow) {
      return res.status(401).json({
        error: true,
        code: 'INVALID_OTP',
        message: 'Invalid code or SIMS ID.',
      });
    }

    // Verify code against bcrypt hash
    const isCodeValid = await bcrypt.compare(code, codeRow.code_hash);
    if (!isCodeValid) {
      // ─── T027: Failure counting and lockout trigger ───
      const newFailureCount = user.otp_failed_attempts + 1;
      const shouldLock = newFailureCount >= OTP_LOCKOUT_THRESHOLD;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          otp_failed_attempts: newFailureCount,
          ...(shouldLock && { otp_locked_until: new Date(Date.now() + OTP_COOLOFF_MS) }),
        },
      });

      return res.status(401).json({
        error: true,
        code: 'INVALID_OTP',
        message: 'Invalid code or SIMS ID.',
      });
    }

    // Atomic claim: mark code as used (single-update, single-winner guarantee)
    const claim = await prisma.otpLoginCode.updateMany({
      where: {
        id: codeRow.id,
        used_at: null, // Recheck at commit time — prevents TOCTOU
      },
      data: {
        used_at: new Date(),
      },
    });

    if (claim.count !== 1) {
      // Someone else claimed it (concurrent request) or it was invalidated between our checks
      return res.status(401).json({
        error: true,
        code: 'INVALID_OTP',
        message: 'Invalid code or SIMS ID.',
      });
    }

    // Re-check user is still active (state can change between issue and redemption)
    const userRecheck = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        deleted_at: true,
        status: true,
        must_change_password: true,
        role: true,
        session_version: true,
      },
    });

    if (!userRecheck || userRecheck.deleted_at || userRecheck.status !== 'active') {
      return res.status(401).json({
        error: true,
        code: 'ACCOUNT_INACTIVE',
        message: 'Account is no longer active.',
      });
    }

    // Successful code verification: clear both lockout fields
    await prisma.user.update({
      where: { id: userRecheck.id },
      data: {
        otp_failed_attempts: 0,
        otp_locked_until: null,
      },
    });

    // Issue JWT and CSRF tokens
    const token = jwt.sign(
      { sub: userRecheck.id, role: userRecheck.role, session_version: userRecheck.session_version },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );
    const csrfToken = crypto.randomBytes(32).toString('hex');

    res.cookie('sims_token', token, authCookieOptions());
    res.cookie('sims_csrf', csrfToken, csrfCookieOptions());

    // Audit log — non-fatal (cookies already set)
    const { logAction } = require('../services/audit.service');
    try {
      await logAction({
        actorId: userRecheck.id,
        action: 'OTP_LOGIN',
        targetId: userRecheck.id,
        targetType: 'user',
      });
    } catch (auditErr) {
      logger.warn(`[AUTH] otp-verify audit log failed (login still succeeded): ${auditErr.message}`);
    }

    logger.info(`[AUTH] OTP login successful: user=${userRecheck.id}, sims_id=${sims_id}, role=${userRecheck.role}`);

    // Fetch full safeUser for response
    const fullUser = await prisma.user.findUnique({ where: { id: userRecheck.id } });
    res.json({
      ...safeUser(fullUser),
      must_change_password: userRecheck.must_change_password,
    });
  } catch (err) {
    logger.error(`verifyOtp error: ${err.message}`);
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

module.exports = { login, changePassword, logout, requestOtp, verifyOtp };
