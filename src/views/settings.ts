/* views/settings.ts — app info: version, local storage use, and asking the
 * browser to keep the data persistent. */

import { db } from '../db/database';
import { CATEGORIES } from '../data/categories';
import { catalogCounts, downloadCatalog, getCatalogMeta, isCatalogDownloading, type CatalogProgress } from '../lib/catalog';
import { openWhatsNew } from '../lib/whats-new';
import { icon } from '../lib/icons';
import { toast } from '../lib/ui';
import { installApp, isStandalone } from '../lib/install';

let root: HTMLElement;

export function init(el: HTMLElement): void {
  root = el;
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('#s-whats-new')) openWhatsNew();
    else if (t.closest('#s-persist')) void requestPersist();
    else if (t.closest('#s-catalog')) void updateCatalog();
    else if (t.closest('#s-install')) void installApp();
  });
}

function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function updateCatalog(): Promise<void> {
  if (!navigator.onLine) { toast('צריך קליטה כדי לעדכן את המאגר', true); return; }
  const btn = root.querySelector<HTMLButtonElement>('#s-catalog');
  if (btn) { btn.disabled = true; btn.textContent = 'מעדכן...'; }
  let failed = 0;
  const progress: CatalogProgress = (cat, state, count) => {
    const cell = root.querySelector<HTMLElement>(`[data-cat-count="${cat}"]`);
    if (state === 'error') failed++;
    if (cell) cell.textContent = state === 'error' ? 'נכשל' : state === 'loading' ? `מוריד... ${count || ''}` : `${count} מינים`;
  };
  await downloadCatalog(undefined, progress);
  toast(failed ? `העדכון נכשל ב-${failed} קטגוריות — אפשר לנסות שוב` : 'מאגר המינים עודכן', failed > 0);
  await activate();
}

function fmtDay(iso: string | undefined): string {
  if (!iso) return 'לא הורד';
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

async function requestPersist(): Promise<void> {
  const ok = await navigator.storage?.persist?.();
  toast(ok ? 'הנתונים יישמרו לצמיתות במכשיר' : 'הדפדפן לא אישר שמירה קבועה — כדאי להתקין את האפליקציה למסך הבית', !ok, 4500);
  await activate();
}

export async function activate(): Promise<void> {
  const [obsCount, photoCount] = await Promise.all([db.observations.count(), db.media.count()]);
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const [counts, meta] = await Promise.all([catalogCounts(), getCatalogMeta()]);
  const updatedTimes = Object.values(meta.updated).filter(Boolean).sort() as string[];
  root.innerHTML = `
    <h2>הגדרות</h2>
    <section class="card-section">
      <h3>נתונים במכשיר</h3>
      <dl class="kv">
        <div><dt>דיווחים</dt><dd>${obsCount}</dd></div>
        <div><dt>תמונות</dt><dd>${photoCount}</dd></div>
        ${est?.usage != null ? `<div><dt>נפח בשימוש</dt><dd dir="ltr">${fmtBytes(est.usage)}</dd></div>` : ''}
        <div><dt>שמירה קבועה</dt><dd>${persisted ? 'פעילה' : 'לא פעילה'}</dd></div>
      </dl>
      ${persisted ? '' : `<p class="hint">בלי שמירה קבועה הדפדפן עלול למחוק נתונים כשהמכשיר מתמלא.</p>
        <button type="button" class="btn btn-soft" id="s-persist">${icon('check', 18)} הפעלת שמירה קבועה</button>`}
      <p class="hint">כל הדיווחים נשמרים רק במכשיר הזה. גיבוי וסנכרון בין מכשירים יגיעו בהמשך.</p>
    </section>
    <section class="card-section">
      <h3>מאגר המינים</h3>
      <p class="hint">רשימת המינים שנצפו בישראל, עם שמות בעברית, מ-iNaturalist. משמשת להשלמת שמות בדיווח ולטאב "מינים", ועובדת גם בלי קליטה. מתעדכנת לבד כל חודשיים.</p>
      <dl class="kv">
        ${CATEGORIES.map((c) => `<div><dt>${c.label}</dt><dd data-cat-count="${c.id}">${counts.get(c.id) ? `${counts.get(c.id)} מינים` : 'לא הורד'}</dd></div>`).join('')}
        <div><dt>עדכון אחרון</dt><dd>${fmtDay(updatedTimes[0])}</dd></div>
      </dl>
      <button type="button" class="btn btn-soft" id="s-catalog"${isCatalogDownloading() ? ' disabled' : ''}>${icon('refresh', 18)} ${isCatalogDownloading() ? 'מוריד...' : 'עדכון המאגר עכשיו'}</button>
    </section>
    <section class="card-section">
      <h3>אודות</h3>
      <dl class="kv">
        <div><dt>גרסה</dt><dd dir="ltr">${__APP_VERSION__ || 'פיתוח'}</dd></div>
      </dl>
      ${isStandalone() ? '' : `<button type="button" class="btn btn-soft" id="s-install">${icon('leaf', 18)} התקנה בטלפון</button>`}
      <button type="button" class="btn btn-soft" id="s-whats-new">${icon('info', 18)} מה חדש</button>
    </section>`;
}
