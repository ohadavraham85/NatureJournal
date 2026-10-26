/* lib/species-info.ts — species card: photo, names, a short description from
 * Wikipedia (Hebrew first, then English by scientific name), how many times
 * I reported it, and a "report this species" shortcut. Ported and extended
 * from the Birds journal. */

import { category, categoryIcon } from '../data/categories';
import { showModal } from './ui';
import { icon } from './icons';
import { escapeHtml } from './escape';
import { navigate } from './nav';
import type { Taxon } from '../types';

interface Summary { extract: string; thumbnailUrl: string | null; pageUrl: string | null }

async function fetchSummary(lang: 'he' | 'en', title: string): Promise<Summary | null> {
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === 'disambiguation' || !data.extract) return null;
    return {
      extract: data.extract,
      thumbnailUrl: data.thumbnail?.source || null,
      pageUrl: data.content_urls?.mobile?.page || data.content_urls?.desktop?.page || null,
    };
  } catch {
    return null;
  }
}

async function fetchSpeciesSummary(he: string, sci: string): Promise<Summary | null> {
  if (!navigator.onLine) return null;
  return (he && await fetchSummary('he', he)) || (sci && await fetchSummary('en', sci)) || null;
}

export interface SpeciesCardInput {
  name: string;
  categoryId: string;
  taxon?: Taxon;
  /** How many of my reports are of this species. */
  myCount: number;
}

export function openSpeciesCard({ name, categoryId, taxon, myCount }: SpeciesCardInput): void {
  const c = category(categoryId);
  const sci = taxon?.sci ?? '';
  const wrap = document.createElement('div');
  wrap.className = 'species-card';
  wrap.style.setProperty('--cat', c.color);
  wrap.style.setProperty('--cat-tint', c.tint);
  wrap.innerHTML = `
    <div class="species-card-photo">
      ${taxon?.photoMedium ? `<img src="${escapeHtml(taxon.photoMedium)}" alt="${escapeHtml(name)}">` : `<span class="obs-placeholder">${categoryIcon(c.id, 56, 1.3)}</span>`}
    </div>
    <h3>${escapeHtml(name)}</h3>
    ${sci ? `<p class="species-card-sci" dir="ltr">${escapeHtml(sci)}</p>` : ''}
    <p class="species-card-tags">
      <span class="cat-tag">${categoryIcon(c.id, 14, 2)} ${c.label}</span>
      <span class="seen-tag${myCount ? ' seen' : ''}">${myCount ? `דיווחת ${myCount === 1 ? 'פעם אחת' : `${myCount} פעמים`}` : 'עוד לא דיווחת'}</span>
    </p>
    <div class="species-card-body" data-body><p class="hint">${navigator.onLine ? 'טוען מידע...' : 'מידע מוויקיפדיה זמין כשיש קליטה.'}</p></div>
    <div class="species-card-links">
      ${taxon ? `<a href="https://www.inaturalist.org/taxa/${taxon.id}" target="_blank" rel="noopener">iNaturalist</a>` : ''}
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-primary" data-report>${icon('camera', 18)} דיווח על המין</button>
      ${myCount ? `<button type="button" class="btn" data-journal>${icon('journal', 18)} הדיווחים שלי</button>` : ''}
      <button type="button" class="btn btn-ghost-dark" data-close>סגירה</button>
    </div>`;
  const close = showModal(wrap);
  wrap.querySelector('[data-close]')!.addEventListener('click', close);
  wrap.querySelector('[data-report]')!.addEventListener('click', () => {
    close();
    navigate('form', { prefillCategory: c.id, prefillSpecies: name, prefillTaxonId: taxon?.id });
  });
  wrap.querySelector('[data-journal]')?.addEventListener('click', () => {
    close();
    navigate('journal', { category: c.id, search: name });
  });

  const body = wrap.querySelector<HTMLElement>('[data-body]')!;
  if (!navigator.onLine) return;
  void fetchSpeciesSummary(taxon?.he || name, sci).then((info) => {
    if (!info) { body.innerHTML = '<p class="hint">לא נמצא תיאור בוויקיפדיה.</p>'; return; }
    if (!taxon?.photoMedium && info.thumbnailUrl) {
      wrap.querySelector('.species-card-photo')!.innerHTML = `<img src="${escapeHtml(info.thumbnailUrl)}" alt="${escapeHtml(name)}">`;
    }
    body.innerHTML = `<p>${escapeHtml(info.extract)}</p>`;
    if (info.pageUrl) {
      wrap.querySelector('.species-card-links')!.insertAdjacentHTML('afterbegin', `<a href="${escapeHtml(info.pageUrl)}" target="_blank" rel="noopener">ויקיפדיה</a>`);
    }
  });
}
