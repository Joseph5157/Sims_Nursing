import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `dist` (prod build) and `dev-dist` (vite-plugin-pwa dev service worker) are
  // generated, gitignored artifacts — never lint them.
  globalIgnores(['dist', 'dev-dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Fast Refresh (dev HMR) hint only — NOT a correctness or hook rule. Our
      // context providers (Toast, imported in 25 files) and co-located drawer
      // style helpers deliberately export a hook/constants alongside the
      // component; relocating them industry-wide would be churn with no runtime
      // benefit. Keep it visible as a warning rather than a build-breaking error.
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Build/config files run in Node, not the browser (need __dirname, process…).
    files: ['vite.config.js', 'eslint.config.js', '*.config.{js,mjs}', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
