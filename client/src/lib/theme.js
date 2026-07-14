// Theme management utility
const STORAGE_KEY = 'app-theme';
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

/**
 * Get the current theme setting from localStorage
 * @returns {string} 'light' or 'dark'
 */
export function getTheme() {
  if (typeof window === 'undefined') return THEMES.LIGHT;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
}

/**
 * Resolve effective theme
 * @returns {string} 'light' or 'dark'
 */
export function getEffectiveTheme() {
  return getTheme();
}

/**
 * Apply theme to document and save to localStorage
 * @param {string} theme - 'light' or 'dark'
 */
export function setTheme(theme) {
  if (!Object.values(THEMES).includes(theme)) {
    console.warn(`Invalid theme: ${theme}. Using 'light'.`);
    theme = THEMES.LIGHT;
  }

  // Save to localStorage
  localStorage.setItem(STORAGE_KEY, theme);

  // Apply to DOM
  applyTheme();

  // Dispatch custom event for other listeners
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

/**
 * Apply the effective theme to the HTML element
 */
function applyTheme() {
  const effectiveTheme = getEffectiveTheme();
  const html = document.documentElement;

  if (effectiveTheme === THEMES.DARK) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

/**
 * Initialize theme on app startup
 * Sets up a listener for storage changes (theme changed in another tab)
 */
export function initializeTheme() {
  if (typeof window === 'undefined') return;

  // Apply initial theme
  applyTheme();

  // Listen for storage changes (theme changed in another tab)
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      applyTheme();
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: getEffectiveTheme() } }));
    }
  });
}

/**
 * Cycle through themes: light → dark → light
 */
export function cycleTheme() {
  const current = getTheme();
  setTheme(current === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT);
}

/**
 * Get theme icon for display
 * @returns {string} emoji representing current theme
 */
export function getThemeIcon() {
  const theme = getTheme();
  return theme === THEMES.DARK ? '🌙' : '☀️';
}

/**
 * Get theme label for display
 * @returns {string} human-readable theme name
 */
export function getThemeLabel() {
  const theme = getTheme();
  return theme === THEMES.DARK ? 'Dark' : 'Light';
}
