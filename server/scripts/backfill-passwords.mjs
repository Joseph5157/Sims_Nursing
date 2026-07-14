#!/usr/bin/env node
/**
 * One-time backfill script for existing active users without passwords
 * Generates temporary passwords for users and sends them via Telegram
 *
 * Usage: node server/scripts/backfill-passwords.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { generateTempPassword, hashPassword } = require('../lib/password');
const { sendTelegramMessage } = require('../lib/bot');
const { APP_SHORT_NAME } = require('../lib/branding');

async function backfillPasswords() {
  try {
    // Step 1: Find all users needing password backfill
    const usersToBackfill = await prisma.user.findMany({
      where: {
        password_hash: null,
        status: 'active',
        telegram_verified: true,
        deleted_at: null,
      },
      select: { id: true, name: true, email: true, telegram_id: true },
    });

    if (usersToBackfill.length === 0) {
      logger.info('[BACKFILL] No users require password backfill.');
      process.exit(0);
    }

    logger.info(`[BACKFILL] Found ${usersToBackfill.length} user(s) requiring password backfill.`);

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Step 2: Process each user
    for (const user of usersToBackfill) {
      try {
        const tempPassword = generateTempPassword();
        const passwordHash = await hashPassword(tempPassword);
        const now = new Date();

        // Update user with temp password
        await prisma.user.update({
          where: { id: user.id },
          data: {
            password_hash: passwordHash,
            must_change_password: true,
            last_password_reset_at: now,
          },
        });

        // Send temp password via Telegram
        const appUrl = process.env.APP_URL || 'https://sims-dms.railway.app';
        const message = `✅ Your ${APP_SHORT_NAME} account is active!\n\nLogin at: ${appUrl}/login\nEmail: ${user.email}\nTemporary password: <code>${tempPassword}</code>\n\nYou'll be asked to set a new password on first login.`;

        await sendTelegramMessage(user.telegram_id, message);

        results.push({ email: user.email, status: 'success' });
        successCount++;
        logger.info(`[BACKFILL] ✓ Backfilled: ${user.email}`);
      } catch (error) {
        results.push({ email: user.email, status: 'error', error: error.message });
        failureCount++;
        logger.error(`[BACKFILL] ✗ Failed to backfill ${user.email}:`, error);
      }
    }

    // Step 3: Summary
    logger.info(`[BACKFILL] Complete. Success: ${successCount}, Failures: ${failureCount}`);
    if (results.length > 0) {
      console.log('\nBackfill Results:');
      console.table(results);
    }

    process.exit(failureCount > 0 ? 1 : 0);
  } catch (error) {
    logger.error('[BACKFILL] Fatal error:', error);
    process.exit(1);
  }
}

backfillPasswords();
