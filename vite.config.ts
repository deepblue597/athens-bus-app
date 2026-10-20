import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// OASA doesn't send CORS headers on most endpoints, so /oasa/* is proxied to it
const oasaProxy = {
  '/oasa': {
    target: 'https://telematics.oasa.gr',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/oasa/, ''),
  },
}

const DAY_SECONDS = 24 * 60 * 60

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Installable app with an offline shell. The service worker doesn't touch /oasa: live data is
    // never cached, and timetables/routes are kept by TanStack Query's persister (app/queryClient.ts).
    VitePWA({
      // The Android app (vite build --mode android) has its files on the phone already
      disable: mode === 'android',
      registerType: 'autoUpdate',
      // globPatterns below already precaches every icon; listing them again would add duplicates
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'Athens Bus',
        short_name: 'Athens Bus',
        description: 'Nearby stops, live arrivals and timetables for Athens buses',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1565c0',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // .mjs is MapLibre's worker; the main bundle (mostly MapLibre) is ~1.6 MB
        globPatterns: ['**/*.{js,mjs,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/oasa\//, /^\/data\//],
        runtimeCaching: [
          {
            // Rebuilt nightly: show the saved copy at once and fetch the new one in the background
            urlPattern: ({ url }) => url.pathname === '/data/stops.json',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'stops-file', expiration: { maxEntries: 1 } },
          },
          {
            // Tile URLs include the map data version, so a cached tile never changes
            urlPattern: ({ url }) => url.origin === 'https://tiles.openfreemap.org' && /^\/planet\/[^/]+\/\d+\//.test(url.pathname),
            handler: 'CacheFirst',
            // A z14 tile in central Athens is ~0.4-0.8 MB once decompressed (which is how the cache
            // stores it), so 500 tiles can take a few hundred MB; the oldest go first
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 30 * DAY_SECONDS, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Style, fonts, icons and the tile index
            urlPattern: ({ url }) => url.origin === 'https://tiles.openfreemap.org',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'map-style',
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * DAY_SECONDS, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: { proxy: oasaProxy },
  preview: { proxy: oasaProxy },
}))
