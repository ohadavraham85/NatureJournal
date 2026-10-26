/* views/settings.ts — settings, split into sections: a list of strips on
 * the first screen, each opening its own page (עיצוב, ייצוא, גיבוי וסנכרון,
 * מאגר המינים, כללי). Each section is a separate history entry, so the back
 * button returns to the list. */

import { db } from '../db/database';
import { CATEGORIES } from '../data/categories';
import { notifyDataChanged } from '../db/repository';
import { catalogCounts, downloadCatalog, getCatalogMeta, isCatalogDownloading, type CatalogProgress } from '../lib/catalog';
import {
  buildBackup, buildCsv, canShareFile, downloadFile, lastBackupTime, readBackup, restoreBackup, shareFile,
} from '../lib/backup';
import {
  DEFAULT_APPEARANCE, FONTS, SCHEMES, SIZES, getAppearance, schemeOf, setAppearance, type Appearance,
} from '../lib/theme';
import { installApp, isStandalone } from '../lib/install';
import { openWhatsNew } from '../lib/whats-new';
import { icon, type IconName } from '../lib/icons';
import { escapeHtml } from '../lib/escape';
import { confirmDialog, showModal, toast } from '../lib/ui';
import { navigate } from '../lib/nav';
import type { ViewParams } from './view';

interface Section { id: string; title: string; desc: string; icon: IconName }

const SECTIONS: Section[] = [
  { id: 'design', title: 'עיצוב', desc: 'צבעים, גופן וגודל הטקסט', icon: 'palette' },
  { id: 'export', title: 'ייצוא', desc: 'טבלת הדיווחים לאקסל', icon: 'table' },
  { id: 'backup', title: 'גיבוי וסנכרון', desc: 'קובץ גיבוי, שחזור וסנכרון בין מכשירים', icon: 'cloud' },
  { id: 'catalog', title: 'מאגר המינים', desc: 'רשימת המינים של ישראל מ-iNaturalist', icon: 'database' },
  { id: 'misc', title: 'כללי', desc: 'התקנה, אחסון במכשיר, מה חדש וגרסה', icon: 'sliders' },
];

let root: HTMLElement;
let section = '';

export function init(el: HTMLElement): void {
  root = el;
  root.addEventListener('click', (e) => void onClick(e));
  root.addEventListener('input', onInput);
  root.addEventListener('change', (e) => void onChange(e));
}

export function setParams(params: ViewParams): void {
  section = params.section ?? '';
}

export async function activate(): Promise<void> {
  const s = SECTIONS.find((x) => x.id === section);
  document.getElementById('topbar-title')!.textContent = s ? s.title : 'הגדרות';
  if (!s) renderMenu();
  else if (s.id === 'design') renderDesign();
  else if (s.id === 'export') renderExport();
  else if (s.id === 'backup') renderBackup();
  else if (s.id === 'catalog') await renderCatalog();
  else await renderMisc();
}

/* ---------- section list ---------- */

function renderMenu(): void {
  root.innerHTML = `
    <h2>הגדרות</h2>
    <div class="settings-menu">
      ${SECTIONS.map((s) => `
        <button type="button" class="settings-strip" data-section="${s.id}">
          <span class="settings-strip-icon">${icon(s.icon, 24)}</span>
          <span class="settings-strip-text"><strong>${s.title}</strong><small>${s.desc}</small></span>
          <span class="settings-strip-arrow">${icon('chevron', 20, 2)}</span>
        </button>`).join('')}
    </div>`;
}

/* ---------- עיצוב ---------- */

function renderDesign(): void {
  const a = getAppearance();
  const s = schemeOf(a);
  const colorRow = (key: keyof Appearance, label: string, value: string): string => `
    <label class="color-row">
      <span>${label}</span>
      <span class="color-pick">
        <input type="color" data-color="${key}" value="${value}" aria-label="${label}">
        ${a[key] ? `<button type="button" class="link-btn" data-reset-color="${key}">ברירת מחדל</button>` : ''}
      </span>
    </label>`;
  root.innerHTML = `
    <section class="card-section">
      <h3>ערכת צבעים</h3>
      <div class="scheme-list">
        ${SCHEMES.map((x) => `
          <button type="button" class="scheme-strip" data-scheme="${x.id}" aria-pressed="${x.id === a.scheme}" style="--s-primary:${x.primary};--s-accent:${x.accent};--s-bg:${x.bg};--s-card:${x.card};--s-ink:${x.ink}">
            <span class="scheme-swatch"><i></i><i></i><i></i></span>
            <span class="scheme-label">${x.label}</span>
            ${x.id === a.scheme ? icon('check', 20, 2.4) : ''}
          </button>`).join('')}
      </div>
    </section>

    <section class="card-section">
      <h3>צבעים לבחירה</h3>
      <p class="hint">משנים צבע מסוים מתוך הערכה שנבחרה.</p>
      ${colorRow('primary', 'צבע ראשי (פס עליון וכפתורים)', a.primary || s.primary)}
      ${colorRow('accent', 'כפתור + ', a.accent || s.accent)}
      ${colorRow('bg', 'רקע', a.bg || s.bg)}
      ${colorRow('ink', 'צבע הטקסט', a.ink || s.ink)}
    </section>

    <section class="card-section">
      <h3>גודל הטקסט</h3>
      <div class="option-strips" role="radiogroup" aria-label="גודל הטקסט">
        ${SIZES.map((z) => `
          <button type="button" role="radio" class="option-strip" data-size="${z.pct}" aria-checked="${z.pct === a.size}">
            <span style="font-size:${z.pct / 112.5}rem">${z.label}</span>
          </button>`).join('')}
      </div>
      <label class="check"><input type="checkbox" id="d-bold"${a.bold ? ' checked' : ''}> טקסט מודגש יותר</label>
    </section>

    <section class="card-section">
      <h3>גופן</h3>
      <div class="option-strips" role="radiogroup" aria-label="גופן">
        ${FONTS.map((f) => `
          <button type="button" role="radio" class="option-strip" data-font="${escapeHtml(f.id)}" aria-checked="${f.id === a.font}">
            <span style="font-family:${f.id === 'system' ? 'system-ui' : `'${f.id}'`}, system-ui">${f.label} — יומן טבע</span>
          </button>`).join('')}
      </div>
      <p class="hint">גופן חדש נטען מהרשת בפעם הראשונה, ואחר כך עובד גם בלי קליטה.</p>
    </section>

    <button type="button" class="btn btn-block btn-ghost-dark" id="d-reset">${icon('refresh', 18)} חזרה לעיצוב המקורי</button>`;
  // Load every font once so the options preview in their own typeface.
  const families = FONTS.filter((f) => f.css).map((f) => `family=${f.css}`).join('&');
  if (navigator.onLine && !document.getElementById('font-previews')) {
    const link = document.createElement('link');
    link.id = 'font-previews';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap&text=${encodeURIComponent('יומן טבע—רוביקהיואסטנולמגףאלמכשיר()')}`;
    document.head.appendChild(link);
  }
}

function updateAppearance(patch: Partial<Appearance>, rerender = true): void {
  setAppearance({ ...getAppearance(), ...patch });
  if (rerender) renderDesign();
}

/* ---------- ייצוא ---------- */

function renderExport(): void {
  root.innerHTML = `
    <section class="card-section">
      <h3>טבלת הדיווחים (CSV)</h3>
      <p class="hint">כל הדיווחים בטבלה אחת שנפתחת באקסל או ב-Google Sheets: תאריך, קטגוריה, מין, שם מדעי, כמות, מקום, קואורדינטות והערה. התמונות לא נכללות — הן נשמרות בקובץ הגיבוי.</p>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="x-csv-save">${icon('download', 18)} שמירה במכשיר</button>
        <button type="button" class="btn btn-soft" id="x-csv-share">${icon('share', 18)} שיתוף</button>
      </div>
    </section>`;
}

/* ---------- גיבוי וסנכרון ---------- */

function renderBackup(): void {
  const last = lastBackupTime();
  root.innerHTML = `
    <section class="card-section">
      <h3>גיבוי לקובץ</h3>
      <p class="hint">קובץ אחד עם כל הדיווחים והתמונות. שומרים אותו במכשיר או שולחים ל-Drive, למייל או לוואטסאפ, ואפשר לשחזר ממנו בכל מכשיר.</p>
      <p class="hint">גיבוי אחרון: ${last ? new Date(last).toLocaleDateString('he-IL') : 'עוד לא גובה'}</p>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="b-save">${icon('download', 18)} שמירת גיבוי במכשיר</button>
        <button type="button" class="btn btn-soft" id="b-share">${icon('share', 18)} שליחה (Drive, מייל...)</button>
      </div>
    </section>
    <section class="card-section">
      <h3>שחזור מגיבוי</h3>
      <p class="hint">בוחרים קובץ גיבוי של יומן טבע. דיווחים שחסרים כאן יתווספו, ודיווח שקיים בשני המקומות יישאר בגרסה שנערכה אחרונה. שום דבר במכשיר לא נמחק.</p>
      <button type="button" class="btn btn-soft" id="b-restore">${icon('upload', 18)} בחירת קובץ גיבוי</button>
      <input type="file" id="b-file" accept=".json,application/json" hidden>
    </section>
    <section class="card-section">
      <h3>סנכרון בין המכשירים</h3>
      <p class="hint">סנכרון אוטומטי בין הטלפון למכשירים האחרים שלך (כמו ביומן הצפרות) יגיע בשלב הבא. עד אז אפשר להעביר דיווחים עם קובץ גיבוי ושחזור.</p>
    </section>`;
}

async function withBusy(btn: HTMLButtonElement, label: string, fn: () => Promise<void>): Promise<void> {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${icon('refresh', 18)} ${label}`;
  try { await fn(); } catch (err) { toast((err as Error).message, true, 5000); } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

async function restoreFrom(file: File): Promise<void> {
  const parsed = await readBackup(file);
  const when = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString('he-IL') : '';
  const box = document.createElement('div');
  box.innerHTML = `
    <h3>${icon('upload')} שחזור מגיבוי</h3>
    <p>בקובץ${when ? ` מ-${when}` : ''}: ${parsed.observations} דיווחים ו-${parsed.photos} תמונות.</p>
    <p class="hint">דיווחים קיימים במכשיר לא יימחקו.</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-primary" data-ok>שחזור</button>
      <button type="button" class="btn" data-cancel>ביטול</button>
    </div>`;
  const close = showModal(box);
  box.querySelector('[data-cancel]')!.addEventListener('click', close);
  box.querySelector('[data-ok]')!.addEventListener('click', () => {
    const btn = box.querySelector<HTMLButtonElement>('[data-ok]')!;
    void withBusy(btn, 'משחזר...', async () => {
      const n = await restoreBackup(parsed);
      close();
      notifyDataChanged();
      toast(n ? `שוחזרו ${n} דיווחים` : 'כל הדיווחים שבקובץ כבר נמצאים במכשיר');
    });
  });
}

/* ---------- מאגר המינים ---------- */

function fmtDay(iso: string | undefined): string {
  if (!iso) return 'לא הורד';
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

async function renderCatalog(): Promise<void> {
  const [counts, meta] = await Promise.all([catalogCounts(), getCatalogMeta()]);
  const updatedTimes = Object.values(meta.updated).filter(Boolean).sort() as string[];
  root.innerHTML = `
    <section class="card-section">
      <h3>מאגר המינים</h3>
      <p class="hint">רשימת המינים שנצפו בישראל, עם שמות בעברית, מ-iNaturalist. משמשת לרשימת הבחירה בדיווח ולטאב "מינים", ועובדת גם בלי קליטה. מתעדכנת לבד כל חודשיים.</p>
      <dl class="kv">
        ${CATEGORIES.map((c) => `<div><dt>${c.label}</dt><dd data-cat-count="${c.id}">${counts.get(c.id) ? `${counts.get(c.id)} מינים` : 'לא הורד'}</dd></div>`).join('')}
        <div><dt>עדכון אחרון</dt><dd>${fmtDay(updatedTimes[0])}</dd></div>
      </dl>
      <button type="button" class="btn btn-soft" id="s-catalog"${isCatalogDownloading() ? ' disabled' : ''}>${icon('refresh', 18)} ${isCatalogDownloading() ? 'מוריד...' : 'עדכון המאגר עכשיו'}</button>
    </section>`;
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
  if (section === 'catalog') await renderCatalog();
}

/* ---------- כללי ---------- */

function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function renderMisc(): Promise<void> {
  const [obsCount, photoCount] = await Promise.all([db.observations.count(), db.media.count()]);
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  root.innerHTML = `
    ${isStandalone() ? '' : `
    <section class="card-section">
      <h3>התקנה בטלפון</h3>
      <p class="hint">פותחים את יומן טבע ישר מהמסך הראשי, גם בלי קליטה.</p>
      <button type="button" class="btn btn-primary" id="s-install">${icon('leaf', 18)} התקנה בטלפון</button>
    </section>`}
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
    </section>
    <section class="card-section">
      <h3>אודות</h3>
      <dl class="kv"><div><dt>גרסה</dt><dd dir="ltr">${__APP_VERSION__ || 'פיתוח'}</dd></div></dl>
      <button type="button" class="btn btn-soft" id="s-whats-new">${icon('info', 18)} מה חדש</button>
    </section>`;
}

async function requestPersist(): Promise<void> {
  const ok = await navigator.storage?.persist?.();
  toast(ok ? 'הנתונים יישמרו לצמיתות במכשיר' : 'הדפדפן לא אישר שמירה קבועה — כדאי להתקין את האפליקציה למסך הבית', !ok, 4500);
  await renderMisc();
}

/* ---------- events ---------- */

async function onClick(e: Event): Promise<void> {
  const t = e.target as HTMLElement;
  const btn = t.closest<HTMLButtonElement>('button');
  if (!btn) return;
  if (btn.dataset.section) { navigate('settings', { section: btn.dataset.section }); return; }
  if (btn.dataset.scheme) { updateAppearance({ scheme: btn.dataset.scheme, primary: '', accent: '', bg: '', ink: '' }); return; }
  if (btn.dataset.resetColor) { updateAppearance({ [btn.dataset.resetColor]: '' }); return; }
  if (btn.dataset.size) { updateAppearance({ size: Number(btn.dataset.size) }); return; }
  if (btn.dataset.font) { updateAppearance({ font: btn.dataset.font }); return; }
  switch (btn.id) {
    case 'd-reset':
      if (await confirmDialog('לחזור לצבעים, לגופן ולגודל המקוריים?', 'חזרה למקור')) updateAppearance({ ...DEFAULT_APPEARANCE });
      break;
    case 'x-csv-save':
      downloadFile(await buildCsv());
      break;
    case 'x-csv-share': {
      const file = await buildCsv();
      if (canShareFile(file)) await shareFile(file, 'יומן טבע — טבלת דיווחים');
      else { downloadFile(file); toast('השיתוף לא נתמך כאן — הקובץ נשמר במכשיר'); }
      break;
    }
    case 'b-save':
      await withBusy(btn, 'מכין גיבוי...', async () => {
        const b = await buildBackup();
        downloadFile(b.file);
        toast(`נשמר גיבוי: ${b.observations} דיווחים, ${b.photos} תמונות`);
      });
      renderBackup();
      break;
    case 'b-share':
      await withBusy(btn, 'מכין גיבוי...', async () => {
        const b = await buildBackup();
        if (canShareFile(b.file)) await shareFile(b.file, 'גיבוי יומן טבע');
        else { downloadFile(b.file); toast('השיתוף לא נתמך כאן — הגיבוי נשמר במכשיר'); }
      });
      renderBackup();
      break;
    case 'b-restore':
      root.querySelector<HTMLInputElement>('#b-file')!.click();
      break;
    case 's-catalog': await updateCatalog(); break;
    case 's-install': await installApp(); break;
    case 's-persist': await requestPersist(); break;
    case 's-whats-new': openWhatsNew(); break;
  }
}

/** Color pickers apply live while dragging, without re-rendering the page. */
function onInput(e: Event): void {
  const inp = e.target as HTMLInputElement;
  if (inp.dataset.color) updateAppearance({ [inp.dataset.color]: inp.value }, false);
}

async function onChange(e: Event): Promise<void> {
  const inp = e.target as HTMLInputElement;
  if (inp.dataset.color) renderDesign();
  else if (inp.id === 'd-bold') updateAppearance({ bold: inp.checked });
  else if (inp.id === 'b-file' && inp.files?.[0]) {
    const file = inp.files[0];
    inp.value = '';
    try { await restoreFrom(file); } catch (err) { toast((err as Error).message, true, 5000); }
  }
}
