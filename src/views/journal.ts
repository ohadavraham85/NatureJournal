/* views/journal.ts — all reports as a 2-column photo grid, with free-text
 * search and a category filter. */

import { CATEGORIES, category } from '../data/categories';
import { listObservations } from '../db/repository';
import { obsCardHtml, obsStripHtml } from '../lib/obs-card';
import { wireCombo, type ComboItem } from '../lib/combo';
import { bestScore } from '../lib/fuzzy';
import { hydrateThumbs } from '../lib/media-url';
import { icon } from '../lib/icons';
import { qs } from '../lib/dom';
import { navigate } from '../lib/nav';
import type { Observation } from '../types';
import type { ViewParams } from './view';
import { getMe, getMembers, isMe, onMembers, reporterName, type Me } from '../sync/state';
import { escapeHtml } from '../lib/escape';

let root: HTMLElement;
let filterCat = '';
/** '' = everyone; otherwise a reporter id. */
let filterReporter = '';
let meId = '';
let me: Me = { id: '', name: '' };
let search = '';
let all: Observation[] = [];
const LAYOUT_KEY = 'journalLayout';
let layout: 'strips' | 'grid' = readLayout();

function readLayout(): 'strips' | 'grid' {
  try { return localStorage.getItem(LAYOUT_KEY) === 'grid' ? 'grid' : 'strips'; } catch { return 'strips'; }
}

export function init(el: HTMLElement): void {
  root = el;
  root.innerHTML = `
    <div class="journal-head">
      <div class="title-row">
        <h2>היומן שלי</h2>
        <span class="muted" id="j-count"></span>
        <span class="layout-toggle" role="group" aria-label="תצוגה">
          <button type="button" data-layout="strips" aria-label="רצועות">${icon('list', 20)}</button>
          <button type="button" data-layout="grid" aria-label="רשת תמונות">${icon('grid', 20)}</button>
        </span>
      </div>
      <label class="search combo">
        ${icon('search', 18)}
        <input type="search" id="j-search" aria-label="חיפוש" placeholder="חיפוש (שם, מקום, הערות)...">
      </label>
      <div class="filter-chips" id="j-reporters" role="group" aria-label="סינון לפי מדווח" hidden></div>
      <div class="filter-chips" id="j-chips" role="group" aria-label="סינון לפי קטגוריה">
        <button type="button" class="filter-chip" data-cat="" aria-pressed="true">הכל</button>
        ${CATEGORIES.map((c) => `<button type="button" class="filter-chip" data-cat="${c.id}" aria-pressed="false" style="--cat:${c.color}">${c.label}</button>`).join('')}
      </div>
    </div>
    <div class="obs-grid" id="j-grid"></div>
    <div class="empty" id="j-empty" hidden></div>`;

  const input = qs<HTMLInputElement>(root, '#j-search');
  input.addEventListener('input', () => { search = input.value; render(); });
  wireCombo(input, {
    getGroups: suggestionGroups,
    onSelect: (item) => { search = item.value; render(); input.blur(); },
  });
  root.querySelector('.layout-toggle')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-layout]');
    if (!b) return;
    layout = b.dataset.layout as typeof layout;
    try { localStorage.setItem(LAYOUT_KEY, layout); } catch { /* storage blocked */ }
    render();
  });

  qs(root, '#j-chips').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.filter-chip');
    if (!chip) return;
    filterCat = chip.dataset.cat!;
    render();
  });

  qs(root, '#j-reporters').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-reporter]');
    if (!chip) return;
    filterReporter = chip.dataset.reporter!;
    render();
  });
  onMembers(() => { if (!root.hidden) render(); });

  qs(root, '#j-grid').addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.obs-card, .obs-strip');
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
  [all, me] = await Promise.all([listObservations(), getMe()]);
  meId = me.id;
  render();
}

/** Names and places from my reports, for the search pick-list. */
function suggestionGroups(): Array<{ title: string; items: ComboItem[]; limit: number }> {
  const count = (vals: string[]): ComboItem[] => {
    const m = new Map<string, number>();
    for (const v of vals) if (v.trim()) m.set(v.trim(), (m.get(v.trim()) ?? 0) + 1);
    return [...m.entries()].map(([v, n]) => ({ value: v, label: v, sub: `${n} דיווחים`, weight: n }));
  };
  return [
    { title: 'מינים', items: count(all.flatMap((o) => o.entries.map((e) => e.species))), limit: 6 },
    { title: 'מקומות', items: count(all.map((o) => o.place)), limit: 4 },
  ];
}

function matches(o: Observation, q: string): boolean {
  if (!q) return true;
  // Notes match as plain text; names and places also forgive typos.
  if (o.note.toLowerCase().includes(q.toLowerCase())) return true;
  const s = bestScore(q, [o.place, ...o.entries.flatMap((e) => [e.species, e.sci ?? '', category(e.category).label])]);
  return s !== null && s <= 5;
}

function render(): void {
  root.querySelectorAll<HTMLElement>('.filter-chip').forEach((c) => {
    c.setAttribute('aria-pressed', String(c.dataset.cat === filterCat));
  });
  root.querySelectorAll<HTMLElement>('[data-layout]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === layout)));
  const q = search.trim();
  // Reporter chips appear once more than one person reports into this journal.
  const reporters = new Map<string, string>();
  // Me under every id/name of mine counts once, as "אני".
  for (const m of getMembers()) if (!isMe(m.id, me)) reporters.set(m.id, m.name);
  for (const o of all) if (o.reporterId && !isMe(o.reporterId, me) && !reporters.has(o.reporterId)) reporters.set(o.reporterId, reporterName(o));
  reporters.set(meId, me.name);
  const multi = reporters.size > 1;
  const repBox = qs(root, '#j-reporters');
  repBox.hidden = !multi;
  if (multi) {
    repBox.innerHTML = [['', 'כל המדווחים'], [meId, 'אני'], ...[...reporters].filter(([id]) => id !== meId)]
      .map(([id, name]) => `<button type="button" class="filter-chip reporter-chip" data-reporter="${escapeHtml(id!)}" aria-pressed="${id === filterReporter}">${escapeHtml(name || 'ללא שם')}</button>`).join('');
  } else filterReporter = '';
  const byReporter = (o: Observation): boolean =>
    !filterReporter || (filterReporter === meId ? isMe(o.reporterId, me) : o.reporterId === filterReporter);
  const shown = all.filter((o) => byReporter(o) && (!filterCat || o.entries.some((e) => e.category === filterCat)) && matches(o, q));
  qs(root, '#j-count').textContent = shown.length === all.length
    ? `${all.length} דיווחים`
    : `${shown.length} מתוך ${all.length}`;

  const grid = qs(root, '#j-grid');
  grid.className = layout === 'grid' ? 'obs-grid' : 'obs-strips';
  grid.innerHTML = shown.map((o) => (layout === 'grid' ? obsCardHtml : obsStripHtml)(o, multi && !isMe(o.reporterId, me))).join('');
  hydrateThumbs(grid);

  const empty = qs(root, '#j-empty');
  empty.hidden = shown.length > 0;
  if (!all.length) {
    empty.innerHTML = `${icon('leaf', 48, 1.4)}<p>עוד אין דיווחים.</p><p class="muted">לוחצים על + כדי לדווח על התצפית הראשונה.</p>`;
  } else if (!shown.length) {
    empty.innerHTML = `${icon('search', 40, 1.4)}<p>לא נמצאו דיווחים מתאימים.</p>`;
  }
}
