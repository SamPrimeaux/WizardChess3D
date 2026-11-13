import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'icon.svg',
        'cover-1280x720.png',
      ],
      manifest: {
        id: '/',
        name: 'Wizard Chess 3D',
        short_name: 'WizardChess',
        description:
          'Interactive 3D Gothic Cathedral Wizard Chess with sculpted pieces, melee captures, chess clocks, offline AI, and local 2-player play.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#080a0f',
        background_color: '#080a0f',
        categories: ['games', 'entertainment', 'strategy'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: '/cover-1280x720.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Wizard Chess 3D — Gothic Cathedral Sanctum',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,woff,woff2,b64,json}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve('./src'),
    },
  },
});
