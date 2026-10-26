/* views/map.ts — every observation on a map. Each pin shows the icon and
 * color of its category (the first species' category when there are
 * several); tap a pin for a summary and a link to the full report.
 * Leaflet is loaded on first visit only. */

import { CATEGORIES, category, categoryIcon } from '../data/categories';
import { listObservations } from '../db/repository';
import { obsTitle, primaryCategory } from '../lib/observation';
import { escapeHtml } from '../lib/escape';
import { fmtShortDate } from '../lib/ui';
import { icon } from '../lib/icons';
import { navigate } from '../lib/nav';
import type { Observation } from '../types';

type MapTiles = typeof import('../lib/map-tiles');

const ISRAEL_CENTER: [number, number] = [31.4, 35.0];

let root: HTMLElement;
let tiles: MapTiles | null = null;
let map: import('leaflet').Map | null = null;
let markers: import('leaflet').LayerGroup | null = null;
let filterCat = '';
let fitted = false;
let all: Observation[] = [];

export function init(el: HTMLElement): void {
  root = el;
  root.innerHTML = `
    <div class="map-view">
      <div class="map-canvas" id="mv-map"></div>
      <div class="map-overlay-top">
        <div class="filter-chips" id="mv-chips" role="group" aria-label="סינון לפי קטגוריה">
          <button type="button" class="filter-chip" data-cat="" aria-pressed="true">הכל</button>
          ${CATEGORIES.map((c) => `<button type="button" class="filter-chip" data-cat="${c.id}" aria-pressed="false" style="--cat:${c.color}">${c.label}</button>`).join('')}
        </div>
      </div>
      <div class="map-side-btns">
        <button type="button" class="map-toggle" id="mv-layer" aria-label="החלפת תצוגת מפה"></button>
        <button type="button" class="map-round-btn" id="mv-locate" aria-label="המיקום שלי">${icon('crosshair', 22)}</button>
        <button type="button" class="map-round-btn" id="mv-fit" aria-label="כל התצפיות">${icon('map', 22)}</button>
      </div>
      <p class="map-empty" id="mv-empty" hidden></p>
    </div>`;
  root.querySelector('#mv-chips')!.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.filter-chip');
    if (!chip) return;
    filterCat = chip.dataset.cat!;
    fitted = false;
    render();
  });
  // Popup "open" buttons live inside Leaflet's popup pane.
  root.addEventListener('click', (e) => {
    const open = (e.target as HTMLElement).closest<HTMLElement>('[data-open]');
    if (open) navigate('detail', { viewId: open.dataset.open! });
  });
}

export async function activate(): Promise<void> {
  if (!tiles) {
    tiles = await import('../lib/map-tiles');
    const L = tiles.L;
    map = L.map(root.querySelector<HTMLElement>('#mv-map')!, { zoomControl: false }).setView(ISRAEL_CENTER, 8);
    L.control.zoom({ position: 'bottomleft' }).addTo(map); // top is taken by the category filter, right by the + button
    tiles.wireLayerToggle(map, root.querySelector<HTMLButtonElement>('#mv-layer')!);
    markers = L.layerGroup().addTo(map);
    root.querySelector('#mv-fit')!.addEventListener('click', () => { fitted = false; fit(); });
    root.querySelector('#mv-locate')!.addEventListener('click', () => {
      navigator.geolocation?.getCurrentPosition(
        (p) => map!.setView([p.coords.latitude, p.coords.longitude], 14),
        () => {},
        { enableHighAccuracy: true, timeout: 12000 },
      );
    });
  }
  all = await listObservations();
  render();
  // The view was hidden while Leaflet measured it.
  setTimeout(() => { map?.invalidateSize(); fit(); }, 60);
}

function pinIcon(o: Observation): import('leaflet').DivIcon {
  const c = category(primaryCategory(o));
  const many = o.entries.length > 1 ? `<span class="pin-count">${o.entries.length}</span>` : '';
  return tiles!.L.divIcon({
    className: 'obs-pin',
    html: `<span class="obs-pin-body" style="--cat:${c.color}">${categoryIcon(c.id, 20, 2)}</span>${many}`,
    iconSize: [38, 46],
    iconAnchor: [19, 44],
    popupAnchor: [0, -40],
  });
}

function shown(): Observation[] {
  return all.filter((o) => o.lat != null && o.lng != null && (!filterCat || o.entries.some((e) => e.category === filterCat)));
}

function render(): void {
  root.querySelectorAll<HTMLElement>('#mv-chips .filter-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === filterCat)));
  if (!tiles || !markers) return;
  markers.clearLayers();
  const list = shown();
  for (const o of list) {
    const tags = [...new Set(o.entries.map((e) => e.category))].map((id) => {
      const c = category(id);
      return `<span class="cat-tag" style="--cat:${c.color};background:${c.color}">${c.label}</span>`;
    }).join('');
    tiles.L.marker([o.lat!, o.lng!], { icon: pinIcon(o) })
      .bindPopup(`
        <div class="map-popup">
          <strong>${escapeHtml(obsTitle(o))}</strong>
          <span class="obs-meta">${[o.place, fmtShortDate(o.dateTime)].filter(Boolean).map(escapeHtml).join(' · ')}</span>
          <span class="strip-tags">${tags}</span>
          <button type="button" class="btn btn-sm btn-primary" data-open="${o.id}">פתיחת התצפית</button>
        </div>`)
      .addTo(markers);
  }
  const empty = root.querySelector<HTMLElement>('#mv-empty')!;
  empty.hidden = list.length > 0;
  empty.textContent = all.length ? 'אין תצפיות עם מיקום בקטגוריה הזו.' : 'התצפיות שתדווח יופיעו כאן על המפה.';
  fit();
}

function fit(): void {
  if (!map || fitted) return;
  const pts = shown().map((o) => [o.lat!, o.lng!] as [number, number]);
  if (!pts.length) return;
  fitted = true;
  if (pts.length === 1) map.setView(pts[0]!, 14);
  else map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
}
