// Auth state persistence layer
// Prevents white screen flash on page refresh by caching user data

export function saveUserToStorage(user) {
  if (user) {
    sessionStorage.setItem('sims_user_cached', JSON.stringify(user));
  }
}

export function loadUserFromStorage() {
  const cached = sessionStorage.getItem('sims_user_cached');
  return cached ? JSON.parse(cached) : null;
}

export function clearUserStorage() {
  sessionStorage.removeItem('sims_user_cached');
}
