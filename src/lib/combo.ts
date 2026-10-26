/* lib/combo.ts — a text field with a searchable pick-list under it: as you
 * type it suggests the closest names (forgiving spelling, see fuzzy.ts), in
 * groups such as "from my reports" / "from the catalog". Tap a row to pick
 * it, or keep typing freely. Grew out of the Birds journal's combobox. */

import { bestScore } from './fuzzy';
import { escapeHtml } from './escape';
import { icon } from './icons';

export interface ComboItem {
  /** Text put into the field when picked. */
  value: string;
  label: string;
  /** Second line (e.g. scientific name). */
  sub?: string;
  /** Small image (e.g. species photo). */
  img?: string;
  /** Extra names to search by (English, scientific...). */
  keys?: string[];
  /** Anything the caller needs back on select. */
  data?: string;
  /** Tie-breaker within equal match quality — higher first. */
  weight?: number;
}

export interface ComboGroup {
  title: string;
  items: ComboItem[];
  /** Max rows from this group (default 30). */
  limit?: number;
  /** Rows shown when the field is empty (default: none from this group). */
  emptyLimit?: number;
}

export interface ComboOptions {
  getGroups: () => ComboGroup[];
  onSelect?: (item: ComboItem) => void;
  /** Shown when typing matches nothing. */
  emptyText?: string;
  /** Scroll the field up near the top on focus, so the list has room under it (phones). */
  scrollOnFocus?: boolean;
}

function rank(items: ComboItem[], q: string, limit: number): ComboItem[] {
  if (!q.trim()) return items.slice(0, limit);
  const scored: Array<[number, ComboItem]> = [];
  for (const it of items) {
    const s = bestScore(q, [it.label, it.value, it.sub ?? '', ...(it.keys ?? [])]);
    if (s !== null) scored.push([s, it]);
  }
  scored.sort((a, b) => a[0] - b[0] || (b[1].weight ?? 0) - (a[1].weight ?? 0) || a[1].label.localeCompare(b[1].label, 'he'));
  return scored.slice(0, limit).map(([, it]) => it);
}

/** Wraps `input` (which must sit inside a `.combo` element) with the pick-list. */
export function wireCombo(input: HTMLInputElement, opts: ComboOptions): { close: () => void; refresh: () => void } {
  const wrap = input.closest<HTMLElement>('.combo')!;
  const list = document.createElement('div');
  list.className = 'combo-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  wrap.appendChild(list);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'combo-toggle';
  toggle.setAttribute('aria-label', 'פתיחת רשימת הבחירה');
  toggle.tabIndex = -1;
  toggle.innerHTML = icon('chevron', 18, 2);
  wrap.appendChild(toggle);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('autocomplete', 'off');

  let shown: ComboItem[] = [];
  let hl = -1;
  let blurTimer: ReturnType<typeof setTimeout> | null = null;

  const close = (): void => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); };

  const render = (showAll = false): void => {
    const q = showAll ? '' : input.value;
    const blocks: string[] = [];
    shown = [];
    for (const g of opts.getGroups()) {
      const limit = q.trim() ? g.limit ?? 30 : showAll ? g.limit ?? 30 : g.emptyLimit ?? 0;
      const rows = limit ? rank(g.items, q, limit) : [];
      if (!rows.length) continue;
      blocks.push(`<div class="combo-group">${escapeHtml(g.title)}</div>` + rows.map((it) => {
        const i = shown.push(it) - 1;
        return `<button type="button" role="option" class="combo-row" data-i="${i}">
          ${it.img !== undefined ? `<span class="combo-img">${it.img ? `<img src="${escapeHtml(it.img)}" alt="" loading="lazy">` : ''}</span>` : ''}
          <span class="combo-text"><span class="combo-label">${escapeHtml(it.label)}</span>${it.sub ? `<small dir="auto">${escapeHtml(it.sub)}</small>` : ''}</span>
        </button>`;
      }).join(''));
    }
    hl = -1;
    if (!blocks.length) {
      if (q.trim() && opts.emptyText) {
        list.innerHTML = `<div class="combo-empty">${escapeHtml(opts.emptyText)}</div>`;
        list.hidden = false;
      } else close();
      return;
    }
    list.innerHTML = blocks.join('');
    list.scrollTop = 0;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const pick = (i: number): void => {
    const it = shown[i];
    if (!it) return;
    input.value = it.value;
    close();
    opts.onSelect?.(it);
  };

  input.addEventListener('focus', () => {
    render();
    if (opts.scrollOnFocus) {
      // After the on-screen keyboard has opened.
      setTimeout(() => wrap.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300);
    }
  });
  input.addEventListener('input', () => render());
  input.addEventListener('keydown', (e) => {
    const rows = Array.from(list.querySelectorAll<HTMLElement>('.combo-row'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (list.hidden) render(true);
      e.preventDefault();
      hl = e.key === 'ArrowDown' ? Math.min(hl + 1, rows.length - 1) : Math.max(hl - 1, 0);
      rows.forEach((r, i) => r.classList.toggle('hl', i === hl));
      rows[hl]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && !list.hidden && hl >= 0) {
      e.preventDefault();
      pick(Number(rows[hl]!.dataset.i));
    } else if (e.key === 'Escape') close();
  });
  // pointerdown + preventDefault keeps focus in the field (no keyboard flicker on phones).
  list.addEventListener('pointerdown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.combo-row');
    if (row) pick(Number(row.dataset.i));
  });
  toggle.addEventListener('pointerdown', (e) => e.preventDefault());
  toggle.addEventListener('click', () => {
    if (list.hidden) { input.focus(); render(true); } else close();
  });
  input.addEventListener('blur', () => {
    if (blurTimer) clearTimeout(blurTimer);
    blurTimer = setTimeout(close, 150);
  });
  return { close, refresh: () => { if (!list.hidden) render(); } };
}
