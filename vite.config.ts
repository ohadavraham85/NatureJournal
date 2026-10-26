import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app under /NatureJournal/. Local dev/preview use '/'.
const base = process.env.GITHUB_PAGES ? '/NatureJournal/' : '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || ''),
  },
  build: {
    target: 'es2021',
    sourcemap: true,
  },
  server: { port: 8787 },
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // 'prompt' wires up registerSW()'s onNeedRefresh, so a new deploy shows
      // the update banner instead of reloading the page on its own.
      registerType: 'prompt',
      injectRegister: null, // registered manually in main.ts
      manifest: {
        name: 'יומן טבע',
        short_name: 'יומן טבע',
        description: 'דיווח תצפיות טבע — יונקים, פרפרים, פרחים, זוחלים, חרקים ופטריות. עובד גם בלי קליטה.',
        lang: 'he',
        dir: 'rtl',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#F4F1E8',
        theme_color: '#4E5D2A',
        categories: ['lifestyle', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
});
