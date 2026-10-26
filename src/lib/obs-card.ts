/* lib/obs-card.ts — the photo-grid card used by the journal and home screen. */

import { category, categoryIcon } from '../data/categories';
import { escapeHtml } from './escape';
import { fmtShortDate } from './ui';
import type { Observation } from '../types';

export function displayName(o: Observation): string {
  return o.species.trim() || `${category(o.category).label} — לא מזוהה`;
}

export function obsCardHtml(o: Observation): string {
  const c = category(o.category);
  const cover = o.photoIds[0];
  const meta = [o.place, fmtShortDate(o.dateTime)].filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <button type="button" class="obs-card" data-id="${o.id}" style="--cat:${c.color};--cat-tint:${c.tint}">
      <span class="obs-photo">
        ${cover ? `<img alt="" data-thumb="${cover}" loading="lazy">` : `<span class="obs-placeholder">${categoryIcon(c.id, 40, 1.5)}</span>`}
        ${o.uncertain ? '<span class="obs-uncertain">לא בטוח בזיהוי</span>' : ''}
        ${o.quantity > 1 ? `<span class="obs-qty">×${o.quantity}</span>` : ''}
        ${o.photoIds.length > 1 ? `<span class="obs-count">${o.photoIds.length} תמונות</span>` : ''}
      </span>
      <span class="obs-body">
        <strong class="obs-name">${escapeHtml(displayName(o))}</strong>
        <span class="obs-meta">${meta || '&nbsp;'}</span>
        <span class="cat-tag">${c.label}</span>
      </span>
    </button>`;
}
