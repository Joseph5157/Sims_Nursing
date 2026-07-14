import axios from 'axios';

const UNSAFE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)sims_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000',
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
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
