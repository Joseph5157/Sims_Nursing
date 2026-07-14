const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Generate a random 12-character alphanumeric password.
 * Excludes ambiguous characters: 0/O, 1/l/I
 * Uses: 2-9, a-z, A-Z (minus ambiguous ones)
 */
function generateTempPassword() {
  // Safe charset: 2-9, a-z (minus l), A-Z (minus I, O)
  const charset = '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const length = 12;
  const bytes = crypto.randomBytes(length);
  let password = '';

  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }

  return password;
}

/**
 * Hash a plaintext password using bcrypt with cost factor 12
 */
async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, 12);
}

module.exports = {
  generateTempPassword,
  hashPassword,
};
