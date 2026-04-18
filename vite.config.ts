import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\.mjs$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-worker',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      manifest: {
        name: 'ShoppingMap',
        short_name: 'ShoppingMap',
        description: 'PDFマップ＋買い物リスト',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
})
