function parseExpiryMs(expiresIn) {
  const match = String(expiresIn || '7d').match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  return n * { d: 86400000, h: 3600000, m: 60000, s: 1000 }[match[2]];
}

// sameSite: 'lax' works for same-origin SPAs and top-level navigations.
// Switch to 'none' only if the client is ever served from a different origin than the API.
const base = () => ({
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
});

const authCookieOptions = () => ({
  ...base(),
  httpOnly: true,
  maxAge: parseExpiryMs(process.env.JWT_EXPIRES_IN),
});

// httpOnly: false so client JS can read the token and send it as X-CSRF-Token
const csrfCookieOptions = () => ({
  ...base(),
  httpOnly: false,
  maxAge: parseExpiryMs(process.env.JWT_EXPIRES_IN),
});

// clearCookie must not include maxAge — browser uses expires=past to delete
const clearAuthOptions = () => ({ ...base(), httpOnly: true });
const clearCsrfOptions = () => ({ ...base(), httpOnly: false });

module.exports = { authCookieOptions, csrfCookieOptions, clearAuthOptions, clearCsrfOptions };
