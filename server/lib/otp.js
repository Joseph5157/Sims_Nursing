const crypto = require('crypto');

// Policy constants for Telegram OTP login (024-telegram-otp-login)
// These are security-critical and must not be hardcoded elsewhere.
// See specs/024-telegram-otp-login/research.md for rationale.

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_LOCKOUT_THRESHOLD = 5; // Max failed attempts before lockout
const OTP_COOLOFF_MS = 15 * 60 * 1000; // 15 minutes lockout cool-off
const OTP_REQUEST_THROTTLE_MS = 60 * 1000; // 60 seconds per-user throttle

/**
 * Generate a 6-digit OTP code as a string, preserving leading zeros.
 * Returns a string like "048291" or "000001", never a number.
 * Leading zeros are critical: Number("048291") = 48291, silently losing the prefix.
 *
 * @returns {string} A 6-digit numeric string (e.g., "048291")
 */
function generateOtpCode() {
  const randomNum = crypto.randomInt(0, 1000000);
  return String(randomNum).padStart(6, '0');
}

module.exports = {
  generateOtpCode,
  OTP_TTL_MS,
  OTP_LOCKOUT_THRESHOLD,
  OTP_COOLOFF_MS,
  OTP_REQUEST_THROTTLE_MS,
};
