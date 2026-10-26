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

// Species photos from the iNaturalist catalog — shown in the species tab.
registerRoute(
  ({ url }) => url.hostname === 'inaturalist-open-data.s3.amazonaws.com' || url.hostname === 'static.inaturalist.org',
  new CacheFirst({
    cacheName: 'species-photos',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 1500, maxAgeSeconds: 180 * 24 * 60 * 60 }),
    ],
  }),
);

// Photos synced from other reporters' devices (Firebase Storage) — kept for offline viewing.
registerRoute(
  // Only the image bytes (?alt=media) — not the SDK's metadata/upload calls.
  // Images only — video clips stream with range requests and aren't cached here.
  ({ url }) => url.hostname === 'firebasestorage.googleapis.com' && url.pathname.includes('nature-media') && url.pathname.endsWith('.jpg') && url.searchParams.get('alt') === 'media',
  new CacheFirst({
    cacheName: 'synced-photos',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 3000, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
);

// Map tiles (OpenStreetMap + Esri satellite) — cache-first, bounded and expiring,
// so places already viewed still show with no reception.
registerRoute(
  ({ url }) => url.hostname.endsWith('tile.openstreetmap.org') || (url.hostname === 'server.arcgisonline.com' && url.pathname.includes('/tile/')),
  new CacheFirst({
    cacheName: 'osm-tiles',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 2000, maxAgeSeconds: 60 * 24 * 60 * 60 }),
    ],
  }),
);
