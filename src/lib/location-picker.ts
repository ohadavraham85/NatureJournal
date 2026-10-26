/* lib/location-picker.ts — pick a report's location on a map: drag the pin
 * or tap the map, switch between satellite and street view, jump to my
 * position, or search a place by name (online). Ported from the Birds
 * journal's picker. Loaded on demand (it pulls in Leaflet), see form.ts. */

import { L, wireLayerToggle } from './map-tiles';
import { icon } from './icons';
import { escapeHtml } from './escape';

export interface LatLng { lat: number; lng: number }

const ISRAEL_CENTER: [number, number] = [31.5, 35.0];

const pinIcon = L.divIcon({
  className: 'map-pin',
  html: `<svg width="36" height="46" viewBox="0 0 36 46" aria-hidden="true"><path d="M18 45s15-15.6 15-27A15 15 0 0 0 3 18c0 11.4 15 27 15 27Z" fill="var(--earth)" stroke="#fff" stroke-width="2.5"/><circle cx="18" cy="18" r="5.5" fill="#fff"/></svg>`,
  iconSize: [36, 46],
  iconAnchor: [18, 45],
});

interface SearchHit { display_name: string; lat: string; lon: string }

async function searchPlace(q: string): Promise<SearchHit[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=he&countrycodes=il&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  return res.ok ? (await res.json()) as SearchHit[] : [];
}

export function pickLocation(initial: LatLng | null, fallbackCenter: LatLng | null = null): Promise<LatLng | null> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal map-picker" role="dialog" aria-modal="true">
        <h3>${icon('map')} בחירת מיקום במפה</h3>
        <form class="map-search" autocomplete="off">
          <input type="search" placeholder="חיפוש מקום (למשל: נחל עמוד)" aria-label="חיפוש מקום">
          <button type="submit" class="btn btn-soft btn-sm">${icon('search', 16)} חיפוש</button>
        </form>
        <div class="map-search-results" hidden></div>
        <div class="picker-map-wrap">
          <div class="picker-map"></div>
          <button type="button" class="map-toggle" data-layer aria-label="החלפת תצוגת מפה"></button>
        </div>
        <p class="hint">גוררים את הסיכה או נוגעים במפה במקום התצפית.</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" data-ok>${icon('check', 18)} בחירת המיקום</button>
          <button type="button" class="btn" data-locate>${icon('crosshair', 18)} המיקום שלי</button>
          <button type="button" class="btn btn-ghost-dark" data-cancel>ביטול</button>
        </div>
      </div>`;
    document.getElementById('modal-root')!.appendChild(backdrop);

    const startLL = initial ?? fallbackCenter;
    const start: [number, number] = startLL ? [startLL.lat, startLL.lng] : ISRAEL_CENTER;
    const map = L.map(backdrop.querySelector<HTMLElement>('.picker-map')!, { zoomControl: true, attributionControl: true })
      .setView(start, startLL ? 15 : 8);
    const marker = L.marker(start, { draggable: true, icon: pinIcon, autoPan: true }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => marker.setLatLng(e.latlng));
    setTimeout(() => map.invalidateSize(), 80);

    // Satellite by default (easier to recognise a wadi or a field); remembered per device.
    wireLayerToggle(map, backdrop.querySelector<HTMLButtonElement>('[data-layer]')!);

    const close = (result: LatLng | null): void => {
      map.remove();
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);

    backdrop.querySelector('[data-ok]')!.addEventListener('click', () => {
      const ll = marker.getLatLng();
      close({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) });
    });
    backdrop.querySelector('[data-cancel]')!.addEventListener('click', () => close(null));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });
    backdrop.querySelector('[data-locate]')!.addEventListener('click', () => {
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
          map.setView(ll, 16);
          marker.setLatLng(ll);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 12000 },
      );
    });

    const results = backdrop.querySelector<HTMLElement>('.map-search-results')!;
    backdrop.querySelector('.map-search')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = backdrop.querySelector<HTMLInputElement>('.map-search input')!.value.trim();
      if (!q) return;
      if (!navigator.onLine) { results.hidden = false; results.innerHTML = '<p class="hint">חיפוש מקום זמין רק כשיש קליטה.</p>'; return; }
      results.hidden = false;
      results.innerHTML = '<p class="hint">מחפש...</p>';
      void searchPlace(q).then((hits) => {
        results.innerHTML = hits.length
          ? hits.map((h, i) => `<button type="button" class="combo-row" data-hit="${i}"><span class="combo-label">${escapeHtml(h.display_name)}</span></button>`).join('')
          : '<p class="hint">לא נמצא מקום בשם הזה.</p>';
        results.querySelectorAll<HTMLElement>('[data-hit]').forEach((b) => b.addEventListener('click', () => {
          const h = hits[Number(b.dataset.hit)]!;
          const ll = L.latLng(Number(h.lat), Number(h.lon));
          map.setView(ll, 15);
          marker.setLatLng(ll);
          results.hidden = true;
        }));
      }).catch(() => { results.innerHTML = '<p class="hint">החיפוש נכשל — אפשר לנסות שוב.</p>'; });
    });
  });
}
