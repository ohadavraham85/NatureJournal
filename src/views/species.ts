/* views/species.ts — two lists: the species I've reported (with counts and
 * when last seen), and the full species catalog of Israel downloaded from
 * iNaturalist, marking the ones I've already seen. Tapping a species opens
 * its card (photo, Wikipedia description, "report this species"). */

import { CATEGORIES, category, categoryIcon, type CategoryId } from '../data/categories';
import { listObservations } from '../db/repository';
import {
  allTaxa, downloadCatalog, getTaxon, isCatalogDownloading, onCatalogUpdated, searchTaxa, taxonName,
} from '../lib/catalog';
import { openSpeciesCard } from '../lib/species-info';
import { escapeHtml } from '../lib/escape';
import { icon } from '../lib/icons';
import { qs } from '../lib/dom';
import { fmtShortDate, toast } from '../lib/ui';
import { matchScore } from '../lib/fuzzy';
import type { Observation, Taxon } from '../types';

/** The catalog list renders at most this many rows; search narrows it down. */
const MAX_ROWS = 150;

let root: HTMLElement;
let mode: 'mine' | 'catalog' = 'mine';
let filterCat = '';
let search = '';
let observations: Observation[] = [];
let taxa: Taxon[] = [];

interface SpeciesStat { name: string; cat: string; count: number; last: string; taxonId?: number }

export function init(el: HTMLElement): void {
  root = el;
  root.innerHTML = `
    <div class="journal-head">
      <div class="segmented" role="tablist">
        <button type="button" role="tab" data-mode="mine">המינים שלי</button>
        <button type="button" role="tab" data-mode="catalog">מאגר המינים בישראל</button>
      </div>
      <label class="search">
        ${icon('search', 18)}
        <input type="search" id="sp-search" aria-label="חיפוש מין" placeholder="חיפוש בעברית, באנגלית או בשם מדעי...">
      </label>
      <div class="filter-chips" id="sp-chips" role="group" aria-label="סינון לפי קטגוריה">
        <button type="button" class="filter-chip" data-cat="" aria-pressed="true">הכל</button>
        ${CATEGORIES.map((c) => `<button type="button" class="filter-chip" data-cat="${c.id}" aria-pressed="false" style="--cat:${c.color}">${c.label}</button>`).join('')}
      </div>
      <div class="title-row"><span class="muted" id="sp-count"></span></div>
    </div>
    <div id="sp-list"></div>`;

  root.querySelector('.segmented')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]');
    if (!b) return;
    mode = b.dataset.mode as typeof mode;
    render();
  });
  const input = qs<HTMLInputElement>(root, '#sp-search');
  input.addEventListener('input', () => { search = input.value; render(); });
  qs(root, '#sp-chips').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.filter-chip');
    if (!chip) return;
    filterCat = chip.dataset.cat!;
    render();
  });
  qs(root, '#sp-list').addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-download]')) { void download(); return; }
    const row = t.closest<HTMLElement>('[data-species]');
    if (row) void openCard(row);
  });
  onCatalogUpdated(() => { if (!root.hidden) void activate(); });
}

export async function activate(): Promise<void> {
  [observations, taxa] = await Promise.all([listObservations(), allTaxa()]);
  render();
}

function myStats(): SpeciesStat[] {
  const stats = new Map<string, SpeciesStat>();
  for (const o of observations) {
    const name = o.species.trim();
    if (!name) continue;
    const key = `${o.category}|${name}`;
    const s = stats.get(key);
    if (s) {
      s.count++;
      if (o.dateTime > s.last) s.last = o.dateTime;
      s.taxonId ??= o.taxonId;
    } else stats.set(key, { name, cat: o.category, count: 1, last: o.dateTime, taxonId: o.taxonId });
  }
  return [...stats.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

/** How many of my reports match a catalog species (by taxon id or name). */
function seenCounts(): Map<number, number> {
  const byName = new Map<string, number>();
  for (const t of taxa) for (const n of [t.he, t.sci]) if (n) byName.set(`${t.category}|${n}`, t.id);
  const counts = new Map<number, number>();
  for (const o of observations) {
    const id = o.taxonId ?? byName.get(`${o.category}|${o.species.trim()}`);
    if (id != null) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function render(): void {
  root.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  root.querySelectorAll<HTMLElement>('#sp-chips .filter-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === filterCat)));
  qs<HTMLInputElement>(root, '#sp-search').value = search;
  if (mode === 'mine') renderMine();
  else renderCatalog();
}

function renderMine(): void {
  const q = search.trim();
  const all = myStats();
  const rows = all.filter((s) => (!filterCat || s.cat === filterCat) && (!q || (matchScore(q, s.name) ?? 99) <= 5));
  qs(root, '#sp-count').textContent = rows.length === all.length ? `${all.length} מינים` : `${rows.length} מתוך ${all.length} מינים`;
  qs(root, '#sp-list').innerHTML = rows.length ? `<ul class="species-list">${rows.map((s) => {
    const c = category(s.cat);
    return `
      <li><button type="button" class="species-row" data-species="${escapeHtml(s.name)}" data-cat="${c.id}"${s.taxonId ? ` data-taxon="${s.taxonId}"` : ''} data-count="${s.count}" style="--cat:${c.color};--cat-tint:${c.tint}">
        <span class="cat-icon">${categoryIcon(c.id, 20)}</span>
        <span class="species-name">${escapeHtml(s.name)}<small>${c.label} · נראה לאחרונה ${fmtShortDate(s.last)}</small></span>
        <span class="species-count">${s.count}</span>
      </button></li>`;
  }).join('')}</ul>` : `<div class="empty">${icon('leaf', 48, 1.4)}<p>${all.length ? 'לא נמצאו מינים מתאימים.' : 'המינים שתדווח עליהם יופיעו כאן.'}</p></div>`;
}

function renderCatalog(): void {
  const list = qs(root, '#sp-list');
  if (!taxa.length) {
    qs(root, '#sp-count').textContent = '';
    list.innerHTML = `<div class="empty">${icon('leaf', 48, 1.4)}
      <p>${isCatalogDownloading() ? 'מוריד את מאגר המינים...' : 'מאגר המינים עוד לא הורד למכשיר.'}</p>
      <p class="muted">רשימת המינים שנצפו בישראל, עם שמות בעברית, מ-iNaturalist. אחרי ההורדה היא עובדת גם בלי קליטה.</p>
      ${isCatalogDownloading() ? '' : `<button type="button" class="btn btn-primary" data-download>${icon('refresh', 18)} הורדת המאגר</button>`}</div>`;
    return;
  }
  const seen = seenCounts();
  const inCat = filterCat ? taxa.filter((t) => t.category === filterCat) : taxa;
  const matches = searchTaxa(inCat, search, Number.MAX_SAFE_INTEGER);
  const seenInCat = inCat.filter((t) => seen.has(t.id)).length;
  qs(root, '#sp-count').textContent = `${matches.length} מינים${search.trim() ? '' : ` · ראית ${seenInCat}`}`;
  const shown = matches.slice(0, MAX_ROWS);
  list.innerHTML = `<ul class="species-list">${shown.map((t) => {
    const c = category(t.category);
    const mine = seen.get(t.id) ?? 0;
    const name = taxonName(t);
    return `
      <li><button type="button" class="species-row" data-species="${escapeHtml(name)}" data-cat="${c.id}" data-taxon="${t.id}" data-count="${mine}" style="--cat:${c.color};--cat-tint:${c.tint}">
        <span class="taxon-photo">${t.photo ? `<img src="${escapeHtml(t.photo)}" alt="" loading="lazy">` : categoryIcon(c.id, 18)}</span>
        <span class="species-name">${escapeHtml(name)}<small dir="ltr">${escapeHtml(t.sci)}</small></span>
        ${mine ? `<span class="seen-mark" title="ראית">${icon('check', 16, 2.4)}</span>` : ''}
      </button></li>`;
  }).join('')}</ul>
  ${matches.length > MAX_ROWS ? `<p class="hint center">מוצגים ${MAX_ROWS} הנפוצים מתוך ${matches.length}. אפשר לחפש כדי למצוא מין מסוים.</p>` : ''}
  ${matches.length ? '' : `<div class="empty"><p>לא נמצאו מינים מתאימים.</p></div>`}
  <p class="hint center">מקור: iNaturalist — תצפיות מאומתות בישראל</p>`;
}

async function openCard(row: HTMLElement): Promise<void> {
  const taxon = row.dataset.taxon ? await getTaxon(Number(row.dataset.taxon)) : undefined;
  openSpeciesCard({
    name: row.dataset.species!,
    categoryId: row.dataset.cat as CategoryId,
    taxon,
    myCount: Number(row.dataset.count) || 0,
  });
}

async function download(): Promise<void> {
  if (!navigator.onLine) { toast('צריך קליטה כדי להוריד את המאגר', true); return; }
  const done = downloadCatalog();
  render();
  await done;
  await activate();
  toast(taxa.length ? 'מאגר המינים הורד' : 'ההורדה נכשלה — אפשר לנסות שוב', !taxa.length);
}
