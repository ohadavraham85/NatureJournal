/* views/gallery.ts — every photo and video clip from all observations, as
 * a grid (newest first, filterable by category). Tapping one opens a
 * full-screen viewer: swipe or arrows between items, each with its
 * observation's details, and a slideshow mode that advances on its own. */

import { CATEGORIES } from '../data/categories';
import { listObservations } from '../db/repository';
import { hydrateThumbs } from '../lib/media-url';
import { obsTitle } from '../lib/observation';
import { openViewer, type ViewerItem as Item } from '../lib/viewer';
import { escapeHtml } from '../lib/escape';
import { icon } from '../lib/icons';


let root: HTMLElement;
let filterCat = '';
let items: Item[] = [];

export function init(el: HTMLElement): void {
  root = el;
  root.innerHTML = `
    <div class="journal-head">
      <div class="title-row">
        <h2>גלריה</h2>
        <span class="muted" id="g-count"></span>
        <button type="button" class="btn btn-sm btn-soft" id="g-slideshow">${icon('play', 16, 2)} מצגת</button>
      </div>
      <div class="filter-chips" id="g-chips" role="group" aria-label="סינון לפי קטגוריה">
        <button type="button" class="filter-chip" data-cat="" aria-pressed="true">הכל</button>
        ${CATEGORIES.map((c) => `<button type="button" class="filter-chip" data-cat="${c.id}" aria-pressed="false" style="--cat:${c.color}">${c.label}</button>`).join('')}
      </div>
    </div>
    <div class="gallery-grid" id="g-grid"></div>
    <div class="empty" id="g-empty" hidden>${icon('image', 48, 1.4)}<p>התמונות והסרטונים מהתצפיות שלך יופיעו כאן.</p></div>`;
  root.querySelector('#g-chips')!.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.filter-chip');
    if (!chip) return;
    filterCat = chip.dataset.cat!;
    render();
  });
  root.querySelector('#g-grid')!.addEventListener('click', (e) => {
    const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-index]');
    if (tile) openViewer(shown(), Number(tile.dataset.index), false);
  });
  root.querySelector('#g-slideshow')!.addEventListener('click', () => {
    const list = shown();
    if (list.length) openViewer(list, 0, true);
  });
}

export async function activate(): Promise<void> {
  const all = await listObservations(); // newest first
  items = all.flatMap((o) => o.photoIds.map((id) => ({ mediaId: id, video: !!o.videoIds?.includes(id), obs: o })));
  render();
}

function shown(): Item[] {
  return filterCat ? items.filter((it) => it.obs.entries.some((e) => e.category === filterCat)) : items;
}

function render(): void {
  root.querySelectorAll<HTMLElement>('#g-chips .filter-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === filterCat)));
  const list = shown();
  const videos = list.filter((it) => it.video).length;
  const photos = list.length - videos;
  root.querySelector('#g-count')!.textContent = [
    photos === 1 ? 'תמונה אחת' : photos ? `${photos} תמונות` : '',
    videos === 1 ? 'סרטון אחד' : videos ? `${videos} סרטונים` : '',
  ].filter(Boolean).join(' · ');
  const grid = root.querySelector<HTMLElement>('#g-grid')!;
  grid.innerHTML = list.map((it, i) => `
    <button type="button" class="gallery-tile" data-index="${i}" aria-label="${escapeHtml(obsTitle(it.obs))}">
      <img alt="" data-thumb="${it.mediaId}" loading="lazy">
      ${it.video ? `<span class="play-badge small">${icon('play', 16, 2)}</span>` : ''}
    </button>`).join('');
  hydrateThumbs(grid);
  (root.querySelector('#g-empty') as HTMLElement).hidden = list.length > 0;
  (root.querySelector('#g-slideshow') as HTMLElement).hidden = list.length === 0;
}

