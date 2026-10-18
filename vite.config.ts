/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the app works under any GitHub Pages sub-path.
  base: './',
  plugins: [
    react(),
    {
      // Dev server only: allow Vite's HMR socket. The build keeps connect-src 'none'.
      name: 'aya-dev-csp',
      apply: 'serve',
      transformIndexHtml: (html) => html.replace("connect-src 'none'", "connect-src 'self' ws://localhost:*"),
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'aya',
        short_name: 'aya',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        description: 'Private Zyklus-App. Alles bleibt verschlüsselt auf deinem Gerät.',
        background_color: '#283c8c',
        theme_color: '#283c8c',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. No runtime caching: the app never talks to the network.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [],
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
