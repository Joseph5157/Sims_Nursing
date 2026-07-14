// Institution branding — set VITE_INSTITUTION_NAME / VITE_APP_SHORT_NAME in
// client/.env when cloning this app for a new department. Baked in at build
// time (Vite), so a rebuild + redeploy is required after changing these.
export const INSTITUTION_NAME = import.meta.env.VITE_INSTITUTION_NAME || 'SIMS College of Pharmacy';
export const APP_SHORT_NAME = import.meta.env.VITE_APP_SHORT_NAME || 'SIMS DMS';
