/* views/home.ts — landing screen: a quick "new report" button, totals,
 * per-category counts and the latest reports. */

import { CATEGORIES, categoryIcon } from '../data/categories';
import { listObservations } from '../db/repository';
import { obsStripHtml } from '../lib/obs-card';
import { hydrateThumbs } from '../lib/media-url';
import { icon } from '../lib/icons';
import { navigate } from '../lib/nav';
import { installApp, isStandalone, onInstallStateChanged } from '../lib/install';

let root: HTMLElement;

export function init(el: HTMLElement): void {
  root = el;
  onInstallStateChanged(() => { if (!root.hidden) void activate(); });
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const card = t.closest<HTMLElement>('.obs-strip');
    if (card) { navigate('detail', { viewId: card.dataset.id! }); return; }
    const tile = t.closest<HTMLElement>('[data-cat-tile]');
    if (tile) { navigate('journal', { category: tile.dataset.catTile!, search: '' }); return; }
    if (t.closest('#h-install')) void installApp();
    else if (t.closest('#h-new')) navigate('form');
    else if (t.closest('#h-all, [data-all]')) navigate('journal', { category: '', search: '' });
    else if (t.closest('#h-species')) navigate('species');
  });
}

export async function activate(): Promise<void> {
  const all = await listObservations();
  const species = new Set(all.map((o) => o.species.trim()).filter(Boolean));
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = all.filter((o) => new Date(o.dateTime) >= monthStart).length;
  const counts = new Map<string, number>();
  for (const o of all) counts.set(o.category, (counts.get(o.category) ?? 0) + 1);

  root.innerHTML = `
    <button type="button" class="new-report" id="h-new">
      <span class="new-report-icon">${icon('camera', 30, 1.7)}</span>
      <span><strong>דיווח חדש</strong><small>מצלמים, בוחרים קטגוריה ושומרים</small></span>
    </button>

    ${isStandalone() ? '' : `
    <button type="button" class="install-card" id="h-install">
      <span class="install-icon">${icon('leaf', 26, 1.8)}</span>
      <span><strong>התקנת יומן טבע בטלפון</strong><small>פותחים ישר מהמסך הראשי, גם בלי קליטה</small></span>
    </button>`}

    <div class="stats">
      <button type="button" class="stat" id="h-all"><strong>${all.length}</strong><span>דיווחים</span></button>
      <button type="button" class="stat" id="h-species"><strong>${species.size}</strong><span>מינים</span></button>
      <div class="stat"><strong>${thisMonth}</strong><span>החודש</span></div>
    </div>

    <section class="card-section">
      <h3>לפי קטגוריה</h3>
      <div class="cat-tiles">
        ${CATEGORIES.map((c) => `
          <button type="button" class="cat-tile" data-cat-tile="${c.id}" style="--cat:${c.color};--cat-tint:${c.tint}">
            <span class="cat-icon">${categoryIcon(c.id, 22)}</span>
            <span class="cat-tile-label">${c.label}</span>
            <strong>${counts.get(c.id) ?? 0}</strong>
          </button>`).join('')}
      </div>
    </section>

    <section>
      <div class="title-row"><h3>דיווחים אחרונים</h3>${all.length > 5 ? '<button type="button" class="link-btn" data-all>לכל היומן</button>' : ''}</div>
      ${all.length
        ? `<div class="obs-strips">${all.slice(0, 5).map(obsStripHtml).join('')}</div>`
        : `<div class="empty">${icon('leaf', 48, 1.4)}<p>עוד אין דיווחים — זה הזמן לצאת לטבע.</p></div>`}
    </section>`;
  hydrateThumbs(root);
}
