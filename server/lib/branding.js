// Institution branding — set APP_SHORT_NAME in the environment when cloning
// this app for a new department. Read at process start (no rebuild needed,
// unlike the client's Vite-baked equivalent — see client/src/utils/branding.js).
const APP_SHORT_NAME = process.env.APP_SHORT_NAME || 'SIMS DMS';

module.exports = { APP_SHORT_NAME };
