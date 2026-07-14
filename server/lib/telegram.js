const axios = require('axios');

function getToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  return token;
}

// options may include reply_markup (e.g. { inline_keyboard: [[...]] }) for
// messages that need action buttons. Existing callers that omit it are unaffected.
async function sendMessage(chatId, text, options = {}) {
  const token = getToken();

  await axios.post(
    `https://api.telegram.org/bot${token}/sendMessage`,
    { chat_id: chatId, text, parse_mode: 'HTML', ...options },
    { timeout: 8000 },
  );
}

// Must be called for every callback_query received, even on error paths —
// otherwise the tapped button shows a spinner until Telegram's own timeout.
async function answerCallbackQuery(callbackQueryId, options = {}) {
  const token = getToken();

  await axios.post(
    `https://api.telegram.org/bot${token}/answerCallbackQuery`,
    { callback_query_id: callbackQueryId, ...options },
    { timeout: 8000 },
  );
}

// Strips (or replaces) the inline keyboard on a message already sent, so a
// resolved request's Accept/Reject buttons can't be tapped again.
async function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
  const token = getToken();

  await axios.post(
    `https://api.telegram.org/bot${token}/editMessageReplyMarkup`,
    { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup },
    { timeout: 8000 },
  );
}

module.exports = { sendMessage, answerCallbackQuery, editMessageReplyMarkup };
