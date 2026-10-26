/* views/species.ts — every species reported so far, with how many reports
 * and when it was last seen. Tapping one opens the journal filtered to it. */

import { category, categoryIcon } from '../data/categories';
import { listObservations } from '../db/repository';
import { escapeHtml } from '../lib/escape';
import { icon } from '../lib/icons';
import { fmtShortDate } from '../lib/ui';
import { navigate } from '../lib/nav';

let root: HTMLElement;

export function init(el: HTMLElement): void {
  root = el;
  root.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-species]');
    if (row) navigate('journal', { category: row.dataset.cat!, search: row.dataset.species! });
  });
}

interface SpeciesStat { name: string; cat: string; count: number; last: string }

export async function activate(): Promise<void> {
  const stats = new Map<string, SpeciesStat>();
  for (const o of await listObservations()) {
    const name = o.species.trim();
    if (!name) continue;
    const key = `${o.category}|${name}`;
    const s = stats.get(key);
    if (s) { s.count++; if (o.dateTime > s.last) s.last = o.dateTime; }
    else stats.set(key, { name, cat: o.category, count: 1, last: o.dateTime });
  }
  const rows = [...stats.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  root.innerHTML = `
    <div class="title-row"><h2>המינים שלי</h2><span class="muted">${rows.length} מינים</span></div>
    ${rows.length ? `<ul class="species-list">${rows.map((s) => {
      const c = category(s.cat);
      return `
        <li><button type="button" class="species-row" data-species="${escapeHtml(s.name)}" data-cat="${c.id}" style="--cat:${c.color};--cat-tint:${c.tint}">
          <span class="cat-circle small">${categoryIcon(c.id, 18)}</span>
          <span class="species-name">${escapeHtml(s.name)}<small>${c.label} · נראה לאחרונה ${fmtShortDate(s.last)}</small></span>
          <span class="species-count">${s.count}</span>
        </button></li>`;
    }).join('')}</ul>` : `<div class="empty">${icon('leaf', 48, 1.4)}<p>המינים שתדווח עליהם יופיעו כאן.</p></div>`}`;
}
