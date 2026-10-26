/// <reference lib="webworker" />
/* sw.ts — Workbox service worker (injectManifest). Precaches the app shell
 * so the app opens with no reception, and caches map tiles for later. */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

// A new SW waits until the user taps "עדכון" in the update banner;
// vite-plugin-pwa's updateSW(true) sends this message.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Google Fonts (Rubik) — cache-first so the font works offline after the first visit.
registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
);

// OpenStreetMap tiles — cache-first with a bounded, expiring cache.
registerRoute(
  ({ url }) => url.hostname.endsWith('tile.openstreetmap.org'),
  new CacheFirst({
    cacheName: 'osm-tiles',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);
