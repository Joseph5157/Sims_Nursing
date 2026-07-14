// In Tailwind v4, this file is intentionally minimal.
// All theme configuration lives in index.css via @theme.
// This file exists only to satisfy tooling that expects it.
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  safelist: [
    // Radix UI Dialog animations - ensure these are included in production
    'data-open:animate-in',
    'data-open:fade-in-0',
    'data-open:zoom-in-95',
    'data-closed:animate-out',
    'data-closed:fade-out-0',
    'data-closed:zoom-out-95',
  ],
}
