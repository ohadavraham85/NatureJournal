/* views/journal.ts — all reports as a 2-column photo grid, with free-text
 * search and a category filter. */

import { CATEGORIES, category } from '../data/categories';
import { listObservations } from '../db/repository';
import { obsCardHtml } from '../lib/obs-card';
import { hydrateThumbs } from '../lib/media-url';
import { icon } from '../lib/icons';
import { qs } from '../lib/dom';
import { navigate } from '../lib/nav';
import type { Observation } from '../types';
import type { ViewParams } from './view';

let root: HTMLElement;
let filterCat = '';
let search = '';
let all: Observation[] = [];

export function init(el: HTMLElement): void {
  root = el;
  root.innerHTML = `
    <div class="journal-head">
      <div class="title-row">
        <h2>היומן שלי</h2>
        <span class="muted" id="j-count"></span>
      </div>
      <label class="search">
        ${icon('search', 18)}
        <input type="search" id="j-search" aria-label="חיפוש" placeholder="חיפוש (שם, מקום, הערות)...">
      </label>
      <div class="filter-chips" id="j-chips" role="group" aria-label="סינון לפי קטגוריה">
        <button type="button" class="filter-chip" data-cat="" aria-pressed="true">הכל</button>
        ${CATEGORIES.map((c) => `<button type="button" class="filter-chip" data-cat="${c.id}" aria-pressed="false" style="--cat:${c.color}">${c.label}</button>`).join('')}
      </div>
    </div>
    <div class="obs-grid" id="j-grid"></div>
    <div class="empty" id="j-empty" hidden></div>`;

  const input = qs<HTMLInputElement>(root, '#j-search');
  input.addEventListener('input', () => { search = input.value; render(); });

  qs(root, '#j-chips').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.filter-chip');
    if (!chip) return;
    filterCat = chip.dataset.cat!;
    render();
  });

  qs(root, '#j-grid').addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.obs-card');
    if (card) navigate('detail', { viewId: card.dataset.id! });
  });
}

export function setParams(params: ViewParams): void {
  // Drill-downs (home tiles, species list) set a filter; a bare visit keeps the last one.
  if (params.category !== undefined || params.search !== undefined) {
    filterCat = params.category ?? '';
    search = params.search ?? '';
  }
}

export async function activate(): Promise<void> {
  qs<HTMLInputElement>(root, '#j-search').value = search;
  all = await listObservations();
  render();
}

function matches(o: Observation, q: string): boolean {
  if (!q) return true;
  return [o.species, o.sci ?? '', o.place, o.note, category(o.category).label].some((f) => f.toLowerCase().includes(q));
}

function render(): void {
  root.querySelectorAll<HTMLElement>('.filter-chip').forEach((c) => {
    c.setAttribute('aria-pressed', String(c.dataset.cat === filterCat));
  });
  const q = search.trim().toLowerCase();
  const shown = all.filter((o) => (!filterCat || o.category === filterCat) && matches(o, q));
  qs(root, '#j-count').textContent = shown.length === all.length
    ? `${all.length} דיווחים`
    : `${shown.length} מתוך ${all.length}`;

  const grid = qs(root, '#j-grid');
  grid.innerHTML = shown.map(obsCardHtml).join('');
  hydrateThumbs(grid);

  const empty = qs(root, '#j-empty');
  empty.hidden = shown.length > 0;
  if (!all.length) {
    empty.innerHTML = `${icon('leaf', 48, 1.4)}<p>עוד אין דיווחים.</p><p class="muted">לוחצים על + כדי לדווח על התצפית הראשונה.</p>`;
  } else if (!shown.length) {
    empty.innerHTML = `${icon('search', 40, 1.4)}<p>לא נמצאו דיווחים מתאימים.</p>`;
  }
}
