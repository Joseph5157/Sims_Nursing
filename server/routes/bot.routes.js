const express = require('express');
const crypto = require('crypto');
const { handleWebhook } = require('../lib/bot');
const logger = require('../lib/logger');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

function secretsMatch(candidate, expected) {
  if (!candidate || !expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  // Length check must come first — timingSafeEqual throws on mismatched lengths
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * POST /bot/webhook/:secret
 * Accepts either the URL path secret or the official Telegram
 * X-Telegram-Bot-Api-Secret-Token header, both validated against
 * TELEGRAM_WEBHOOK_SECRET.
 */
router.post('/webhook/:secret', (req, res, next) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret) {
    logger.warn('[BOT] TELEGRAM_WEBHOOK_SECRET is not configured');
    return res.status(403).json({ error: 'Forbidden' });
  }

  const pathSecret = req.params.secret;
  const headerSecret = req.headers['x-telegram-bot-api-secret-token'];

  // Header is the primary mechanism (Telegram ≥6.9 sends X-Telegram-Bot-Api-Secret-Token).
  // Path secret is kept as a fallback only for the currently registered webhook URL.
  // TODO: re-register the webhook with secret_token and a static /bot/webhook path,
  // then remove the pathSecret fallback and the /:secret route parameter.
  const valid = secretsMatch(headerSecret, expectedSecret) || secretsMatch(pathSecret, expectedSecret);

  if (!valid) {
    logger.warn('[BOT] Invalid webhook secret');
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
});

router.post('/webhook/:secret', asyncHandler(handleWebhook));

module.exports = router;
