/* views/settings.ts — app info: version, local storage use, and asking the
 * browser to keep the data persistent. */

import { db } from '../db/database';
import { openWhatsNew } from '../lib/whats-new';
import { icon } from '../lib/icons';
import { toast } from '../lib/ui';

let root: HTMLElement;

export function init(el: HTMLElement): void {
  root = el;
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('#s-whats-new')) openWhatsNew();
    else if (t.closest('#s-persist')) void requestPersist();
  });
}

function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
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
      <h3>אודות</h3>
      <dl class="kv">
        <div><dt>גרסה</dt><dd dir="ltr">${__APP_VERSION__ || 'פיתוח'}</dd></div>
      </dl>
      <button type="button" class="btn btn-soft" id="s-whats-new">${icon('info', 18)} מה חדש</button>
    </section>`;
}
