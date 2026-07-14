import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',  // show update prompt; never auto-reload (faculty may be mid check-in)
      manifest: false,         // we manage our own public/manifest.json
      includeAssets: ['favicon.svg', 'icons/*.png'],
      devOptions: {
        enabled: true,   // activate SW in dev so the install prompt works during local testing
        type: 'module',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          // API routes — network-first so data stays fresh; fall back to cache on failure.
          // /auth/* and /users/me are deliberately excluded: serving a cached
          // /users/me (possibly from a previous user's session) on a slow network
          // breaks login/identity — those must always hit the network.
          {
            urlPattern: ({ url }) => {
              if (url.pathname.startsWith('/auth') || url.pathname === '/users/me') return false;
              const api = ['/users', '/admin', '/students', '/calendar',
                           '/duty-slots', '/attendance', '/violations', '/violation-types',
                           '/messages', '/reports', '/health', '/invites'];
              return api.some(p => url.pathname.startsWith(p));
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sims-api',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 64, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts stylesheet
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-sheet',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts binaries (woff2)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/auth':            { target: 'http://localhost:3000', changeOrigin: true },
      '/users':           { target: 'http://localhost:3000', changeOrigin: true },
      '/admin':           { target: 'http://localhost:3000', changeOrigin: true, bypass: (req) => { if (req.headers.accept?.includes('text/html')) return '/index.html'; } },
      '/students':        { target: 'http://localhost:3000', changeOrigin: true },
      '/calendar':        { target: 'http://localhost:3000', changeOrigin: true },
      '/duty-slots':      { target: 'http://localhost:3000', changeOrigin: true },
      '/attendance':      { target: 'http://localhost:3000', changeOrigin: true },
      '/violations':      { target: 'http://localhost:3000', changeOrigin: true },
      '/violation-types': { target: 'http://localhost:3000', changeOrigin: true },
      '/messages':        { target: 'http://localhost:3000', changeOrigin: true },
      '/reports':         { target: 'http://localhost:3000', changeOrigin: true },
      '/health':          { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
