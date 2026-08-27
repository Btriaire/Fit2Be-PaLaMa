import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Default injectRegister:'auto' only adds a bare
      // navigator.serviceWorker.register() call — it ignores registerType
      // entirely, so a new deploy never actually reaches an
      // already-installed PWA (no update check, no reload, ever). We
      // register manually in main.tsx via virtual:pwa-register instead,
      // which knows how to check for and apply updates.
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Fit2Be-PaLaMa — Gym, Sport & Longévité',
        short_name: 'Fit2Be-PaLaMa',
        description: 'Carnet de gym, activités quotidiennes, récupération et nutrition, 100% local.',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
})
