import axios from 'axios';

const UNSAFE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

// Public, unauthenticated pages — a 401 here (e.g. the unconditional
// GET /users/me every page fires via useCurrentUser) must never bounce the
// user off the page they're already on. Missing /login/password here was
// the exact bug: visiting it 401's, and since pathname !== '/login' the old
// check treated it as "not public" and hard-redirected back to /login.
const PUBLIC_PATHS = new Set(['/login', '/login/password']);

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)sims_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const api = axios.create({
  // Same-origin in production; explicit localhost API in dev. `import.meta.env`
  // is Vite's idiomatic build-time env (no Node `process` in the browser).
  baseURL: import.meta.env.PROD ? undefined : 'http://localhost:3000',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (UNSAFE_METHODS.has(config.method?.toLowerCase())) {
    const token = getCsrfToken();
    if (token) {
      config.headers['X-CSRF-Token'] = token;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !PUBLIC_PATHS.has(window.location.pathname)) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
