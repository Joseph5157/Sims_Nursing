// Cache TTLs (Time To Live) in milliseconds
export const CACHE_TTL = {
  USER: 5 * 60 * 1000,         // 5 minutes
  STUDENTS: 10 * 60 * 1000,    // 10 minutes
  USERS: 10 * 60 * 1000,       // 10 minutes
  DUTY_SLOTS: 15 * 60 * 1000,  // 15 minutes
  VIOLATIONS: 10 * 60 * 1000,  // 10 minutes
  MESSAGES: 5 * 60 * 1000,     // 5 minutes
  ATTENDANCE: 15 * 60 * 1000,  // 15 minutes
};

/**
 * Get cached data if still valid
 * @param {string} key - Cache key (e.g., 'STUDENTS', 'USERS')
 * @returns {any|null} Cached data or null if expired/not found
 */
export function getCacheKey(key) {
  try {
    const cached = localStorage.getItem(`cache_${key}`);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const ttl = CACHE_TTL[key] || 10 * 60 * 1000; // Default 10 min

    if (Date.now() - timestamp > ttl) {
      localStorage.removeItem(`cache_${key}`);
      return null;
    }

    return data;
  } catch (err) {
    console.error(`Cache read error for ${key}:`, err);
    return null;
  }
}

/**
 * Store data in cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
export function setCacheKey(key, data) {
  try {
    localStorage.setItem(
      `cache_${key}`,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch (err) {
    console.error(`Cache write error for ${key}:`, err);
  }
}

/**
 * Clear specific cache entry
 * @param {string} key - Cache key to clear
 */
export function clearCacheKey(key) {
  try {
    localStorage.removeItem(`cache_${key}`);
  } catch (err) {
    console.error(`Cache clear error for ${key}:`, err);
  }
}

/**
 * Clear all cache entries
 */
export function clearAllCache() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith('cache_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.error('Cache clear all error:', err);
  }
}
