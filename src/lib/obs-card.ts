/* lib/obs-card.ts — how an observation looks in lists: a photo-grid card
 * (journal grid) and a full-width strip (journal, home). An observation can
 * hold several species — the title lists them and each category gets a tag. */

import { category, categoryIcon } from '../data/categories';
import { escapeHtml } from './escape';
import { fmtShortDate } from './ui';
import { obsCategories, obsTitle, primaryCategory } from './observation';
import type { Observation } from '../types';
import { reporterName } from '../sync/state';

export function displayName(o: Observation): string {
  return obsTitle(o);
}

function catTags(o: Observation): string {
  return obsCategories(o).map((id) => {
    const c = category(id);
    return `<span class="cat-tag" style="--cat:${c.color}">${c.label}</span>`;
  }).join('');
}

/** "×3" for a single species seen several times; "3 מינים" for several species. */
function countBadge(o: Observation): string {
  if (o.entries.length > 1) return `${o.entries.length} מינים`;
  const q = o.entries[0]?.quantity ?? 1;
  return q > 1 ? `×${q}` : '';
}

function meta(o: Observation, showReporter: boolean): string {
  return [showReporter ? reporterName(o) : '', o.place, fmtShortDate(o.dateTime)].filter(Boolean).map(escapeHtml).join(' · ');
}

export function obsCardHtml(o: Observation, showReporter = false): string {
  const c = category(primaryCategory(o));
  const cover = o.photoIds[0];
  const badge = countBadge(o);
  return `
    <button type="button" class="obs-card" data-id="${o.id}" style="--cat:${c.color};--cat-tint:${c.tint}">
      <span class="obs-photo">
        ${cover ? `<img alt="" data-thumb="${cover}" loading="lazy">` : `<span class="obs-placeholder">${categoryIcon(c.id, 40, 1.5)}</span>`}
        ${o.entries.some((e) => e.uncertain) ? '<span class="obs-uncertain">לא בטוח בזיהוי</span>' : ''}
        ${badge ? `<span class="obs-qty">${badge}</span>` : ''}
        ${o.photoIds.length > 1 ? `<span class="obs-count">${o.photoIds.length} תמונות</span>` : ''}
      </span>
      <span class="obs-body">
        <strong class="obs-name">${escapeHtml(obsTitle(o))}</strong>
        <span class="obs-meta">${meta(o, showReporter) || '&nbsp;'}</span>
        <span class="strip-tags">${catTags(o)}</span>
      </span>
    </button>`;
}

/** A full-width horizontal row: photo on the side, species, place · date, categories. */
export function obsStripHtml(o: Observation, showReporter = false): string {
  const c = category(primaryCategory(o));
  const cover = o.photoIds[0];
  const badge = countBadge(o);
  return `
    <button type="button" class="obs-strip" data-id="${o.id}" style="--cat:${c.color};--cat-tint:${c.tint}">
      <span class="strip-photo">
        ${cover ? `<img alt="" data-thumb="${cover}" loading="lazy">` : categoryIcon(c.id, 28, 1.5)}
      </span>
      <span class="strip-body">
        <strong class="obs-name">${escapeHtml(obsTitle(o))}${badge ? ` <span class="strip-qty">${badge}</span>` : ''}</strong>
        <span class="obs-meta">${meta(o, showReporter) || '&nbsp;'}</span>
        <span class="strip-tags">${catTags(o)}${o.entries.some((e) => e.uncertain) ? '<span class="uncertain-tag">לא בטוח בזיהוי</span>' : ''}</span>
      </span>
    </button>`;
}
