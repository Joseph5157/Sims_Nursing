const crypto = require('crypto');
const prisma = require('./prisma');
const logger = require('./logger');
const telegram = require('./telegram');
const { generateTempPassword, hashPassword } = require('./password');
const { logAction } = require('../services/audit.service');
const { respondToRequestCore } = require('../controllers/duty-reassignment-requests.controller');
const { MONTH_NAMES, formatFriendlyDateIST } = require('../controllers/calendar.controller');
const { nowInIST } = require('./time');
const { APP_SHORT_NAME } = require('./branding');

const APP_URL = process.env.APP_URL || 'https://sims-dms.railway.app';
const OPEN_APP_BUTTON = { reply_markup: { inline_keyboard: [[{ text: `Open in ${APP_SHORT_NAME}`, url: `${APP_URL}/faculty/slots` }]] } };

// Telegram magic-link login (022-telegram-magic-link-login).
const LOGIN_TOKEN_TTL_MS = 10 * 60 * 1000;
const LOGIN_TOKEN_RATE_LIMIT_MS = 30 * 1000;

/**
 * Handle Telegram webhook callback
 * Processes /start invite_TOKEN (new account activation)
 * and /start relink_TOKEN (existing user Telegram relink)
 */
async function handleWebhook(req, res) {
  try {
    const callbackQuery = req.body?.callback_query;
    if (callbackQuery) {
      await handleCallbackQuery(callbackQuery);
      return res.status(200).json({ ok: true });
    }

    const message = req.body?.message;

    if (!message) {
      return res.status(200).json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = message.text;

    // Check if message matches /start invite_TOKEN or /start relink_TOKEN patterns
    const inviteMatch = text?.match(/^\/start\s+invite_(.+)$/);
    const relinkMatch = text?.match(/^\/start\s+relink_(.+)$/);

    if (inviteMatch) {
      // New account activation from PendingInvite
      const token = inviteMatch[1];
      const result = await handleInviteActivation(chatId, token);
      let replyText;

      if (result.success) {
        const appUrl = process.env.APP_URL || 'https://sims-dms.railway.app';
        replyText = `✅ Your ${APP_SHORT_NAME} account is active!\n\nYour SIMS ID: <code>${result.user.sims_id}</code>\nLogin at: ${appUrl}/login\nTemporary password: <code>${result.tempPassword}</code>\n\nUse your SIMS ID and this temporary password. You'll be asked to set a new password on first login.`;
        logger.info(`[TELEGRAM] Account activated: ${result.user.id} (SIMS ID ${result.user.sims_id})`);

        // The invite token is already consumed at this point (PendingInvite deleted,
        // User row created) — if this notification never reaches the user, they have
        // no way to recover the temp password themselves. Retry before giving up, and
        // flag the account for Admin follow-up if all retries fail.
        notifyActivationSuccess(chatId, replyText, result.user).catch((err) => {
          logger.error(`[TELEGRAM] Failed to send message to ${chatId}:`, err);
        });

        return res.status(200).json({ ok: true });
      } else if (result.error === 'ALREADY_LINKED') {
        replyText = 'This Telegram account is already linked to a SIMS account. Contact your admin.';
        logger.warn(`[TELEGRAM] Duplicate Telegram ID attempted: ${chatId}`);
      } else if (result.error === 'EMAIL_CONFLICT') {
        replyText = 'An account with these details already exists. Contact your admin.';
        logger.warn(`[TELEGRAM] Email conflict for invite: ${result.invite?.email}`);
      } else {
        replyText = 'This invite link is invalid or has expired. Ask your admin to send a new one.';
        logger.warn(`[TELEGRAM] Invalid/expired invite token attempted: ${token}`);
      }

      // Send message via Telegram API (async, don't wait)
      sendTelegramMessage(chatId, replyText).catch((err) => {
        logger.error(`[TELEGRAM] Failed to send message to ${chatId}:`, err);
      });

      return res.status(200).json({ ok: true });
    } else if (relinkMatch) {
      // Existing user Telegram relink
      const token = relinkMatch[1];
      const result = await handleRelinkActivation(chatId, token);
      let replyText;

      if (result.success) {
        replyText = `Welcome back, ${result.user.name}! Your ${APP_SHORT_NAME} account has been relinked to this Telegram. You can now log in.`;
        logger.info(`[TELEGRAM] Account relinked: ${result.user.id}`);
      } else if (result.error === 'ALREADY_LINKED') {
        replyText = 'This Telegram account is already linked to a SIMS account. Contact your admin.';
        logger.warn(`[TELEGRAM] Duplicate Telegram ID in relink: ${chatId}`);
      } else {
        replyText = 'This relink link is invalid, has expired, or has already been used. Ask your admin to generate a new one.';
        logger.warn(`[TELEGRAM] Invalid/expired/used relink token attempted: ${token}`);
      }

      // Send message via Telegram API (async, don't wait)
      sendTelegramMessage(chatId, replyText).catch((err) => {
        logger.error(`[TELEGRAM] Failed to send message to ${chatId}:`, err);
      });

      return res.status(200).json({ ok: true });
    } else if (text === '/start') {
      // Handle bare /start (no payload) — provide helpful message to guide user
      const replyText = `Welcome to ${APP_SHORT_NAME}! 👋\n\nIf you received an activation link from your Admin, please send the full command they shared with you:\n\n<code>/start invite_xxxxx</code>\n\nIf you don't have an activation link, contact your administrator to send you an invite.`;
      sendTelegramMessage(chatId, replyText).catch((err) => {
        logger.error(`[TELEGRAM] Failed to send /start response to ${chatId}:`, err);
      });
      return res.status(200).json({ ok: true });
    } else if (text === '/menu') {
      // Handle /menu command — quick-status inline keyboard for linked faculty
      telegram.sendMessage(chatId, '📋 <b>Quick Menu</b>\n\nWhat would you like to check?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 My Duty Slots', callback_data: 'menu:my_slots' }],
            [{ text: '⏭️ Next Duty', callback_data: 'menu:next_duty' }],
            [{ text: '📅 Scheduling Window Status', callback_data: 'menu:window_status' }],
          ],
        },
      }).catch((err) => {
        logger.error(`[TELEGRAM] Failed to send /menu response to ${chatId}:`, err);
      });
      return res.status(200).json({ ok: true });
    } else if (text === '/myid') {
      // Give users a self-service way to recover the short ID without asking
      // an administrator or remembering an email address.
      const linkedUser = await prisma.user.findUnique({
        where: { telegram_id: chatId },
        select: { sims_id: true, status: true, deleted_at: true },
      });
      const replyText = linkedUser && !linkedUser.deleted_at && linkedUser.status === 'active'
        ? `Your ${APP_SHORT_NAME} SIMS ID is: <code>${linkedUser.sims_id}</code>`
        : `No active ${APP_SHORT_NAME} account is linked to this Telegram. Contact your admin.`;
      sendTelegramMessage(chatId, replyText).catch((err) => {
        logger.error(`[TELEGRAM] Failed to send /myid response to ${chatId}:`, err);
      });
      return res.status(200).json({ ok: true });
    } else if (text === '/login' || text === '/start login') {
      // Handle /login command (or the web login page's "Log in via Telegram"
      // deep link, which arrives as /start login) — issues a one-time magic
      // login link for a linked, active account.
      const result = await handleLoginRequest(chatId);

      let replyText;
      if (result.success) {
        return res.status(200).json({ ok: true }); // message already sent inside handleLoginRequest
      } else if (result.error === 'NOT_LINKED') {
        replyText = `No active ${APP_SHORT_NAME} account is linked to this Telegram. Use your SIMS ID and password, or contact your admin to link Telegram first.`;
      } else if (result.error === 'RATE_LIMITED') {
        replyText = `You already have a login link — check the message above. Try again in ${result.secondsWait}s if you need a new one.`;
      } else {
        replyText = 'An error occurred. Please try again or contact your admin.';
        logger.warn(`[TELEGRAM] Login-link error: ${result.error}`);
      }

      sendTelegramMessage(chatId, replyText).catch((err) => {
        logger.error(`[TELEGRAM] Failed to send /login response to ${chatId}:`, err);
      });
      return res.status(200).json({ ok: true });
    } else if (text === '/resetpassword') {
      // Handle /resetpassword command — reset password for linked user
      const result = await handlePasswordReset(chatId);

      if (result.success) {
        const replyText = `✅ Your password has been reset!\n\nLogin at: ${process.env.APP_URL || 'https://sims-dms.railway.app'}/login\nSIMS ID: <code>${result.simsId}</code>\nTemporary password: <code>${result.tempPassword}</code>\n\nYou'll be asked to set a new password on first login.`;
        logger.info(`[TELEGRAM] Password reset: ${result.userId}`);

        // The password is already changed at this point — if this notification
        // never reaches the user, they're locked out of their account with no
        // recovery path until the 1-hour rate limit clears. Retry before giving
        // up, and flag the account for Admin follow-up if all retries fail
        // (same recovery path as invite activation).
        notifyPasswordResetSuccess(chatId, replyText, { id: result.userId, email: result.email }).catch((err) => {
          logger.error(`[TELEGRAM] Failed to send message to ${chatId}:`, err);
        });

        return res.status(200).json({ ok: true });
      }

      let replyText;
      if (result.error === 'NOT_LINKED') {
        replyText = `No ${APP_SHORT_NAME} account linked to this Telegram account. Contact your Admin.`;
      } else if (result.error === 'RATE_LIMITED') {
        replyText = `Please wait before requesting another reset (max 1 per hour). Try again in ${result.minutesWait} minute(s).`;
      } else {
        replyText = 'An error occurred. Please try again or contact your admin.';
        logger.warn(`[TELEGRAM] Password reset error: ${result.error}`);
      }

      sendTelegramMessage(chatId, replyText).catch((err) => {
        logger.error(`[TELEGRAM] Failed to send /resetpassword response to ${chatId}:`, err);
      });
      return res.status(200).json({ ok: true });
    } else {
      // Not an invite, relink, /myid, /login, or /resetpassword command — ignore
      return res.status(200).json({ ok: true });
    }
  } catch (error) {
    logger.error('[TELEGRAM] Webhook error:', error);
    return res.status(200).json({ ok: true }); // Always return 200 to acknowledge receipt
  }
}

/**
 * Handle a callback_query from the inline Accept/Reject buttons on a
 * duty-reassignment-request notification. Reuses respondToRequestCore —
 * the same function the PATCH /duty-reassignment-requests/:id endpoint
 * calls — so a button tap and the in-app buttons can never disagree on
 * eligibility, authorization, or what gets written to the DB.
 *
 * Every path answers the callback query (required, or the tapped button
 * spins forever) and, once the request is resolved either way, strips the
 * inline keyboard so it can't be tapped again.
 */
async function handleCallbackQuery(callbackQuery) {
  const data = callbackQuery.data || '';

  const menuMatch = data.match(/^menu:(my_slots|next_duty|window_status)$/);
  if (menuMatch) {
    await handleMenuCallback(callbackQuery, menuMatch[1]);
    return;
  }

  const match = data.match(/^rr:(approved|declined):([0-9a-fA-F-]{36})$/);

  if (!match) {
    // Not a reassignment-request or menu callback (or malformed) — nothing to
    // do, just stop the button's loading spinner.
    await telegram.answerCallbackQuery(callbackQuery.id).catch((err) => {
      logger.error('[TELEGRAM] answerCallbackQuery (unknown action) failed:', err);
    });
    return;
  }

  const [, status, requestId] = match;
  const telegramUserId = String(callbackQuery.from.id);
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;

  const clearKeyboard = () => {
    if (chatId == null || messageId == null) return Promise.resolve();
    return telegram.editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] }).catch((err) => {
      logger.warn(`[TELEGRAM] Failed to clear inline keyboard on message ${messageId}:`, err.message);
    });
  };

  try {
    const user = await prisma.user.findUnique({
      where: { telegram_id: telegramUserId },
      select: { id: true, status: true, deleted_at: true },
    });

    if (!user || user.deleted_at || user.status !== 'active') {
      await telegram.answerCallbackQuery(callbackQuery.id, {
        text: `No active ${APP_SHORT_NAME} account is linked to this Telegram. Contact your admin.`,
        show_alert: true,
      });
      return;
    }

    const result = await respondToRequestCore({ id: requestId, respondedById: user.id, status });

    if (!result.ok) {
      await telegram.answerCallbackQuery(callbackQuery.id, {
        text: result.message || 'Could not process this request.',
        show_alert: true,
      });
      // NOT_FOUND/CONFLICT mean the request is no longer actionable (already
      // responded elsewhere, or gone) — clear the stale buttons either way.
      // FORBIDDEN is left alone: it's not this tapper's request to resolve.
      if (result.code === 'NOT_FOUND' || result.code === 'CONFLICT') {
        await clearKeyboard();
      }
      return;
    }

    const toastText = status === 'approved' ? '✅ Accepted — the duty is now yours.' : '❌ Declined.';
    await telegram.answerCallbackQuery(callbackQuery.id, { text: toastText });
    await clearKeyboard();
  } catch (error) {
    logger.error('[TELEGRAM] Error in handleCallbackQuery:', error);
    await telegram.answerCallbackQuery(callbackQuery.id, {
      text: 'Something went wrong. Please respond in the app instead.',
      show_alert: true,
    }).catch((err) => {
      logger.error('[TELEGRAM] answerCallbackQuery (error path) failed:', err);
    });
  }
}

/**
 * Handle a callback_query from the /menu quick-status inline keyboard
 * (My Duty Slots / Next Duty / Scheduling Window Status). Unlike Accept/Reject,
 * these are read-only — nothing is mutated, so there's no result to conflict
 * with an in-app action. The callback is answered immediately (dismissing the
 * button's spinner) and the actual answer is sent as a fresh chat message
 * ending in a button back to the app, per the user's requested shape.
 */
async function handleMenuCallback(callbackQuery, action) {
  const telegramUserId = String(callbackQuery.from.id);
  const chatId = callbackQuery.message?.chat?.id;

  const user = await prisma.user.findUnique({
    where: { telegram_id: telegramUserId },
    select: { id: true, status: true, deleted_at: true },
  }).catch((err) => {
    logger.error(`[TELEGRAM] Error looking up user for menu callback (${action}):`, err);
    return null;
  });

  if (!user || user.deleted_at || user.status !== 'active') {
    await telegram.answerCallbackQuery(callbackQuery.id, {
      text: `No active ${APP_SHORT_NAME} account is linked to this Telegram. Contact your admin.`,
      show_alert: true,
    }).catch((err) => logger.error('[TELEGRAM] answerCallbackQuery (menu unlinked) failed:', err));
    return;
  }

  await telegram.answerCallbackQuery(callbackQuery.id).catch((err) => {
    logger.error('[TELEGRAM] answerCallbackQuery (menu) failed:', err);
  });

  try {
    const text = action === 'my_slots' ? await buildMySlotsReply(user.id)
      : action === 'next_duty' ? await buildNextDutyReply(user.id)
      : await buildWindowStatusReply(user.id);

    await telegram.sendMessage(chatId, text, OPEN_APP_BUTTON);
  } catch (error) {
    logger.error(`[TELEGRAM] Error building/sending menu reply (${action}):`, error);
    await telegram.sendMessage(
      chatId,
      'Something went wrong fetching that. Please check the app instead.',
      OPEN_APP_BUTTON,
    ).catch((err) => logger.error('[TELEGRAM] Failed to send menu fallback message:', err));
  }
}

// Current IST calendar month as a UTC date range — duty_date is a @db.Date
// column, returned by Prisma as UTC midnight (see lib/time.js), so range
// boundaries must be built with Date.UTC to match.
function currentMonthRangeUTC(ist) {
  return {
    gte: new Date(Date.UTC(ist.year, ist.month - 1, 1)),
    lte: new Date(Date.UTC(ist.year, ist.month, 0, 23, 59, 59, 999)),
  };
}

/**
 * "My Duty Slots" — this faculty's slots for the current IST month.
 */
async function buildMySlotsReply(facultyId) {
  const ist = nowInIST();
  const monthLabel = `${MONTH_NAMES[ist.month - 1]} ${ist.year}`;

  const slots = await prisma.dutySlot.findMany({
    where: { faculty_id: facultyId, duty_date: currentMonthRangeUTC(ist) },
    select: { duty_date: true, session_type: true },
    orderBy: [{ duty_date: 'asc' }, { session_type: 'asc' }],
  });

  if (slots.length === 0) {
    return `📋 <b>My Duty Slots — ${monthLabel}</b>\n\nNo duty slots picked yet this month.`;
  }

  const lines = slots.map((s) => {
    const dateLabel = new Date(s.duty_date).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    });
    const sessionLabel = s.session_type === 'morning' ? 'Morning' : 'Afternoon';
    return `• ${dateLabel} (${sessionLabel})`;
  });

  return `📋 <b>My Duty Slots — ${monthLabel}</b>\n\n${lines.join('\n')}`;
}

/**
 * "Next Duty" — the earliest upcoming scheduled slot for this faculty.
 */
async function buildNextDutyReply(facultyId) {
  const ist = nowInIST();
  const todayUTC = new Date(Date.UTC(ist.year, ist.month - 1, ist.day));

  const slot = await prisma.dutySlot.findFirst({
    where: { faculty_id: facultyId, duty_date: { gte: todayUTC }, status: 'scheduled' },
    select: { duty_date: true, session_type: true },
    orderBy: [{ duty_date: 'asc' }, { session_type: 'asc' }],
  });

  if (!slot) {
    return '⏭️ <b>Next Duty</b>\n\nYou have no upcoming duty scheduled.';
  }

  const sessionLabel = slot.session_type === 'morning' ? 'Morning' : 'Afternoon';
  return `⏭️ <b>Next Duty</b>\n\n${formatFriendlyDateIST(slot.duty_date)} (${sessionLabel})`;
}

/**
 * "Scheduling Window Status" — the current IST month's CalendarConfig plus
 * how many slots this faculty has already picked against their quota.
 */
async function buildWindowStatusReply(facultyId) {
  const ist = nowInIST();
  const monthLabel = `${MONTH_NAMES[ist.month - 1]} ${ist.year}`;

  const config = await prisma.calendarConfig.findUnique({
    where: { config_month_config_year: { config_month: ist.month, config_year: ist.year } },
  });

  if (!config) {
    return `📅 <b>Scheduling Window — ${monthLabel}</b>\n\nThe window hasn't been configured for this month yet.`;
  }

  const pickedCount = await prisma.dutySlot.count({
    where: { faculty_id: facultyId, duty_date: currentMonthRangeUTC(ist) },
  });

  const statusLabel = config.is_window_open ? 'Open' : 'Closed';
  const closesLine = config.is_window_open && config.closes_at
    ? `\n⏰ Closes: <b>${formatFriendlyDateIST(config.closes_at)}</b>`
    : '';

  return (
    `📅 <b>Scheduling Window — ${monthLabel}</b>\n\n` +
    `Status: <b>${statusLabel}</b>\n` +
    `You've picked <b>${pickedCount} of ${config.sessions_per_faculty}</b> slots.` +
    closesLine
  );
}

/**
 * Handle /start invite_TOKEN activation from PendingInvite
 * Creates a new real User and deletes the PendingInvite
 */
async function handleInviteActivation(chatId, token) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Find and lock the PendingInvite row
      // Raw SQL used here because Prisma does not support FOR UPDATE natively — this is
      // the sole constitution exception for non-report raw SQL in this file.
      const invites = await tx.$queryRaw`
        SELECT id, name, sims_id, email, phone, role, department, designation, title, invited_by
        FROM pending_invites
        WHERE invite_token = ${token}
        AND invite_expires_at > NOW()
        FOR UPDATE
      `;

      if (!invites || invites.length === 0) {
        return { success: false, error: 'INVALID_TOKEN' };
      }

      const invite = invites[0];

      // Step 2: Check if this Telegram ID is already linked to another user
      const existingUser = await tx.user.findFirst({
        where: { telegram_id: chatId },
        select: { id: true },
      });

      if (existingUser) {
        return { success: false, error: 'ALREADY_LINKED', invite };
      }

      // Step 3: Check if an active user with this email already exists (edge case)
      if (invite.email) {
        const emailConflict = await tx.user.findFirst({
          where: { email: invite.email, deleted_at: null },
          select: { id: true },
        });

        if (emailConflict) {
          return { success: false, error: 'EMAIL_CONFLICT', invite };
        }
      }

      // Step 4: Generate temporary password for the new user
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      // Step 5: Create the real User from the PendingInvite
      const newUser = await tx.user.create({
        data: {
          name: invite.name,
          sims_id: Number(invite.sims_id),
          email: invite.email || null,
          phone: invite.phone || null,
          role: invite.role,
          department: invite.department || null,
          designation: invite.designation || null,
          title: invite.title || null,
          telegram_id: chatId,
          telegram_verified: true,
          status: 'active',
          password_hash: passwordHash,
          must_change_password: true,
          approved_at: new Date(),
          approved_by: invite.invited_by,
        },
      });

      // Step 6: Delete the PendingInvite (it's been consumed)
      await tx.pendingInvite.delete({ where: { id: invite.id } });

      return {
        success: true,
        user: { id: newUser.id, name: newUser.name, sims_id: newUser.sims_id, email: newUser.email },
        tempPassword,
      };
    });

    return result;
  } catch (error) {
    logger.error('[TELEGRAM] Error in handleInviteActivation:', error);
    return { success: false, error: 'SYSTEM_ERROR' };
  }
}

/**
 * Handle /start relink_TOKEN for existing users
 * Updates user's telegram_id and marks the relink token as used
 */
async function handleRelinkActivation(chatId, token) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Find and lock the TelegramRelinkToken row
      const tokens = await tx.$queryRaw`
        SELECT id, user_id, used_at
        FROM telegram_relink_tokens
        WHERE token = ${token}
        AND expires_at > NOW()
        AND used_at IS NULL
        FOR UPDATE
      `;

      if (!tokens || tokens.length === 0) {
        return { success: false, error: 'INVALID_TOKEN' };
      }

      const relinkToken = tokens[0];

      // Step 2: Check if chatId is not already linked to a different user
      const conflict = await tx.user.findFirst({
        where: { telegram_id: chatId, id: { not: relinkToken.user_id } },
        select: { id: true },
      });

      if (conflict) {
        return { success: false, error: 'ALREADY_LINKED' };
      }

      // Step 3: Mark token as used
      await tx.telegramRelinkToken.update({
        where: { id: relinkToken.id },
        data: { used_at: new Date() },
      });

      // Step 4: Update user with new telegram_id and set status to active
      const updated = await tx.user.update({
        where: { id: relinkToken.user_id },
        data: {
          telegram_id: chatId,
          telegram_verified: true,
          status: 'active',
        },
        select: { id: true, name: true, sims_id: true, email: true },
      });

      return { success: true, user: updated };
    });

    return result;
  } catch (error) {
    logger.error('[TELEGRAM] Error in handleRelinkActivation:', error);
    return { success: false, error: 'SYSTEM_ERROR' };
  }
}

/**
 * Handle /resetpassword command — reset password for a user
 * Rate-limited to 1 reset per hour
 */
async function handlePasswordReset(chatId) {
  try {
    const telegramId = String(chatId);

    // Step 1: Find user by telegram_id
    const user = await prisma.user.findUnique({
      where: { telegram_id: telegramId },
      select: { id: true, sims_id: true, email: true, status: true, deleted_at: true, last_password_reset_at: true },
    });

    if (!user || user.deleted_at || user.status !== 'active') {
      return { success: false, error: 'NOT_LINKED' };
    }

    // Step 2: Rate limit check — max 1 reset per hour
    const now = new Date();
    if (user.last_password_reset_at) {
      const lastResetTime = new Date(user.last_password_reset_at);
      const minutesSince = Math.floor((now - lastResetTime) / (1000 * 60));
      if (minutesSince < 60) {
        const minutesWait = 60 - minutesSince;
        return { success: false, error: 'RATE_LIMITED', minutesWait };
      }
    }

    // Step 3: Generate temporary password and hash it
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    // Step 4: Update user with new password and timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: passwordHash,
        must_change_password: true,
        last_password_reset_at: now,
        session_version: { increment: 1 },
      },
    });

    // Step 5: Log the password reset action
    await logAction({
      actorId: user.id,
      action: 'PASSWORD_RESET_VIA_BOT',
      targetId: user.id,
      targetType: 'user',
      metadata: { reset_method: 'telegram_bot' },
    });

    return { success: true, userId: user.id, simsId: user.sims_id, email: user.email, tempPassword };
  } catch (error) {
    logger.error('[TELEGRAM] Error in handlePasswordReset:', error);
    return { success: false, error: 'SYSTEM_ERROR' };
  }
}

/**
 * Handle /login (or /start login) — issue a one-time Telegram magic-link
 * login token for a linked, active account. Rate-limited to 1 request per
 * 30 seconds per user; requesting a new link invalidates any previous
 * still-unused one (022-telegram-magic-link-login).
 */
async function handleLoginRequest(chatId) {
  try {
    const telegramId = String(chatId);

    const user = await prisma.user.findUnique({
      where: { telegram_id: telegramId },
      select: { id: true, status: true, deleted_at: true, telegram_verified: true },
    });

    if (!user || user.deleted_at || user.status !== 'active' || !user.telegram_verified) {
      return { success: false, error: 'NOT_LINKED' };
    }

    // Rate limit: refuse a new link within 30s of the last one requested,
    // regardless of whether that one was used — reuses the token table's own
    // created_at instead of a dedicated column (research.md §3).
    const mostRecent = await prisma.telegramLoginToken.findFirst({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });

    if (mostRecent) {
      const msSince = Date.now() - new Date(mostRecent.created_at).getTime();
      if (msSince < LOGIN_TOKEN_RATE_LIMIT_MS) {
        const secondsWait = Math.ceil((LOGIN_TOKEN_RATE_LIMIT_MS - msSince) / 1000);
        return { success: false, error: 'RATE_LIMITED', secondsWait };
      }
    }

    // Superseding: any still-unused token for this user is no longer valid
    // once a new one is requested (research.md §2).
    await prisma.telegramLoginToken.deleteMany({ where: { user_id: user.id, used_at: null } });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.telegramLoginToken.create({
      data: {
        user_id: user.id,
        token,
        expires_at: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
      },
    });

    const loginUrl = `${APP_URL}/auth/telegram/${token}`;
    await telegram.sendMessage(
      chatId,
      `🔐 Log in to ${APP_SHORT_NAME}\n\nTap the button below to log in — this link works once and expires in 10 minutes.`,
      { reply_markup: { inline_keyboard: [[{ text: 'Log in', url: loginUrl }]] } },
    );

    return { success: true };
  } catch (error) {
    logger.error('[TELEGRAM] Error in handleLoginRequest:', error);
    return { success: false, error: 'SYSTEM_ERROR' };
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send a Telegram notification that follows an already-committed, unrecoverable
 * account change (new temp password, etc.) — retrying on failure since there's
 * no way for the user to request it again through the same channel. If every
 * attempt fails, flag the account (activation_notification_failed) so it
 * surfaces on the Admin Users page, and write an audit log entry with the
 * given action name for context on which flow failed.
 */
async function sendWithRetryOrFlag(chatId, text, user, auditAction) {
  const RETRY_DELAYS_MS = [1000, 3000];

  for (let attempt = 0; ; attempt += 1) {
    try {
      await sendTelegramMessage(chatId, text);
      return;
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) {
        logger.error(
          `[TELEGRAM] Notification permanently failed for user ${user.id} (${user.email}) after ${attempt + 1} attempts:`,
          err
        );

        await prisma.user.update({
          where: { id: user.id },
          data: { activation_notification_failed: true },
        }).catch((updateErr) => {
          logger.error(`[TELEGRAM] Failed to flag user ${user.id} after notification failure:`, updateErr);
        });

        await logAction({
          actorId: user.id,
          action: auditAction,
          targetId: user.id,
          targetType: 'user',
          metadata: { chatId, error: err.message },
        }).catch((auditErr) => {
          logger.error(`[TELEGRAM] Failed to write audit log for notification failure on user ${user.id}:`, auditErr);
        });

        return;
      }

      logger.warn(`[TELEGRAM] Notification attempt ${attempt + 1} failed for user ${user.id}, retrying:`, err.message);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

/**
 * Invite-activation success message — the PendingInvite is already deleted and
 * the User row already created by this point.
 */
async function notifyActivationSuccess(chatId, text, user) {
  return sendWithRetryOrFlag(chatId, text, user, 'ACTIVATION_NOTIFICATION_FAILED');
}

/**
 * /resetpassword success message — the new password is already committed by
 * this point, so a failed send here actively locks the user out (no recovery
 * until the 1-hour rate limit on /resetpassword clears).
 */
async function notifyPasswordResetSuccess(chatId, text, user) {
  return sendWithRetryOrFlag(chatId, text, user, 'PASSWORD_RESET_NOTIFICATION_FAILED');
}

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN not set');
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

module.exports = {
  handleWebhook,
  handleInviteActivation,
  handleRelinkActivation,
  handlePasswordReset,
  handleLoginRequest,
  sendTelegramMessage,
  buildMySlotsReply,
  buildNextDutyReply,
  buildWindowStatusReply,
};
