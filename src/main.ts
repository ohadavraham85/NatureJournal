/* main.ts — entry point: routing between the views, PWA registration and
 * update banner, and the top bar. */

import './styles/app.css';
import { registerSW } from 'virtual:pwa-register';

import { onDataChanged, purgeOrphanMedia } from './db/repository';
import { toast, showModal } from './lib/ui';
import { qs } from './lib/dom';
import { hydrateIcons, icon } from './lib/icons';
import { registerNav } from './lib/nav';
import { refreshCatalogIfNeeded } from './lib/catalog';
import { setupInstallPrompt } from './lib/install';

setupInstallPrompt();
import { setupWhatsNewButton, unseenChangelog, changelogEntriesHtml, markChangelogSeen, openWhatsNew } from './lib/whats-new';
import type { View, ViewParams } from './views/view';

import * as homeView from './views/home';
import * as formView from './views/form';
import * as journalView from './views/journal';
import * as detailView from './views/detail';
import * as speciesView from './views/species';
import * as settingsView from './views/settings';
import { soonView } from './views/soon';

const VIEWS: Record<string, View> = {
  home: homeView,
  form: formView,
  journal: journalView,
  detail: detailView,
  species: speciesView,
  settings: settingsView,
  gallery: soonView('grid', 'גלריה', 'כל התמונות שצילמת במקום אחד — מגיע בשלב הבא.'),
  map: soonView('map', 'מפה', 'כל הדיווחים על מפה — מגיע בשלב הבא.'),
};

/** Views reachable from the bottom tab bar. */
const TAB_VIEWS = ['journal', 'gallery', 'home', 'map', 'species'];
const HOME_VIEW = 'home';

const TITLES: Record<string, string> = {
  form: 'דיווח חדש',
  detail: 'דיווח',
  settings: 'הגדרות',
};

let currentView: string | null = null;
/** How many in-app history entries we've pushed beyond the first screen —
 * lets goBack() fall back to home instead of leaving the app. */
let navDepth = 0;

interface NavState { view: string; scrollTop: number }

function mainScrollTop(): number {
  return document.getElementById('main')?.scrollTop ?? 0;
}

/** All navigation goes through here (same scheme as the Birds journal):
 * 'push' records a new history entry, 'replace' swaps the current one, and
 * 'pop' renders what the browser's back/forward already moved to. */
async function showView(name: string, params?: ViewParams, mode: 'push' | 'replace' | 'pop' = 'push'): Promise<void> {
  if (!VIEWS[name]) name = HOME_VIEW;

  if (mode === 'push' && currentView) {
    const leavingState: NavState = { view: currentView, scrollTop: mainScrollTop() };
    history.replaceState(leavingState, '', location.hash || `#${currentView}`);
  }

  if (currentView) VIEWS[currentView]!.deactivate?.();

  currentView = name;
  for (const key of Object.keys(VIEWS)) {
    document.getElementById(`view-${key}`)!.hidden = key !== name;
  }
  document.querySelectorAll<HTMLElement>('.tab').forEach((tab) => {
    const active = tab.dataset.view === name;
    tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  updateChrome(name);

  if (mode === 'push') {
    history.pushState({ view: name, scrollTop: 0 } satisfies NavState, '', `#${name}`);
    navDepth++;
  } else if (mode === 'replace') {
    history.replaceState({ view: name, scrollTop: 0 } satisfies NavState, '', `#${name}`);
  }

  if (mode !== 'pop') VIEWS[name]!.setParams?.(params ?? {});
  await VIEWS[name]!.activate();

  const main = document.getElementById('main')!;
  const savedTop = mode === 'pop' ? (history.state as NavState | null)?.scrollTop ?? 0 : 0;
  requestAnimationFrame(() => { main.scrollTop = savedTop; });
}

/** Top-bar title and action button (gear on tabs, back elsewhere), FAB visibility. */
function updateChrome(name: string): void {
  const isTab = TAB_VIEWS.includes(name);
  const action = document.getElementById('nav-action')!;
  action.innerHTML = isTab ? icon('gear', 20) : icon('back', 22, 2);
  action.title = isTab ? 'הגדרות' : 'חזרה';
  action.setAttribute('aria-label', action.title);
  document.getElementById('topbar-title')!.textContent = TITLES[name] ?? 'יומן טבע';
  (document.getElementById('fab') as HTMLElement).hidden = !isTab;
  document.body.dataset.view = name;
}

function navigate(name: string, params?: ViewParams, replace = false): void {
  void showView(name, params, replace ? 'replace' : 'push');
}

function goBack(): void {
  if (navDepth > 0) { navDepth--; history.back(); }
  else navigate(HOME_VIEW);
}

function setupNav(): void {
  document.querySelectorAll<HTMLElement>('.tab').forEach((tab) => {
    tab.addEventListener('click', () => navigate(tab.dataset.view!));
  });
  document.getElementById('nav-action')!.addEventListener('click', () => {
    if (TAB_VIEWS.includes(currentView || '')) navigate('settings');
    else goBack();
  });
  document.getElementById('fab')!.addEventListener('click', () => navigate('form'));
  window.addEventListener('popstate', (e: PopStateEvent) => {
    const state = e.state as NavState | null;
    if (navDepth > 0) navDepth--;
    void showView(state?.view || HOME_VIEW, undefined, 'pop');
  });
}

/* ---------- top bar ---------- */

function formatClock(d: Date): string {
  const weekday = d.toLocaleDateString('he-IL', { weekday: 'short' });
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${weekday} ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} | ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function setupClock(): void {
  const el = document.getElementById('topbar-datetime')!;
  const tick = (): void => { el.textContent = formatClock(new Date()); };
  tick();
  setInterval(tick, 15000);
}

function setupNetStatus(): void {
  const pill = document.getElementById('offline-pill')!;
  const paint = (): void => { pill.hidden = navigator.onLine; };
  window.addEventListener('online', paint);
  window.addEventListener('offline', paint);
  paint();
}

/* ---------- updates (ported from the Birds journal) ---------- */

async function fetchDeployedVersion(): Promise<string> {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    return String((await res.json()).version || '');
  } catch {
    return '';
  }
}

const LAST_SEEN_VERSION_KEY = 'lastSeenAppVersion';
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** "עדכון זמין: מגרסה X לגרסה Y" in the bottom banner. */
async function showUpdateAvailable(knownNext?: string): Promise<void> {
  const next = knownNext ?? await fetchDeployedVersion();
  const current = __APP_VERSION__;
  const text = current && next && current !== next
    ? `עדכון זמין: מגרסה ${current} לגרסה ${next}`
    : next ? `עדכון זמין לגרסה ${next}` : 'גרסה חדשה זמינה';
  document.getElementById('update-banner-text')!.textContent = text;
  document.getElementById('update-banner')!.hidden = false;
}

/** After an update lands: "האפליקציה עודכנה מגרסה X לגרסה Y" + what's new, once. */
function showUpdatedNotice(): void {
  const current = __APP_VERSION__;
  if (!current) return; // dev build — no version
  let previous: string | null = null;
  try {
    previous = localStorage.getItem(LAST_SEEN_VERSION_KEY);
    localStorage.setItem(LAST_SEEN_VERSION_KEY, current);
  } catch { return; }
  if (previous === current) return;
  const news = unseenChangelog();
  if (!previous && !news.length) return;
  const box = document.createElement('div');
  box.className = 'version-dialog';
  box.innerHTML = `
    <h3>${icon('check')} ${previous ? 'האפליקציה עודכנה' : 'ברוכים הבאים ליומן טבע'}</h3>
    <div class="version-dialog-versions">
      ${previous ? `<span><small>מגרסה</small><strong dir="ltr">${previous}</strong></span><span class="version-dialog-arrow">←</span>` : ''}
      <span><small>${previous ? 'לגרסה' : 'גרסה נוכחית'}</small><strong dir="ltr">${current}</strong></span>
    </div>
    ${news.length ? `<div class="whats-new-list whats-new-inline"><h4>מה חדש</h4>${changelogEntriesHtml(news)}</div>` : ''}
    <div class="modal-actions">
      <button type="button" class="btn btn-primary" id="vd-ok">אישור</button>
      <button type="button" class="btn" id="vd-all">כל העדכונים</button>
    </div>`;
  const close = showModal(box);
  markChangelogSeen();
  qs<HTMLButtonElement>(box, '#vd-ok').addEventListener('click', close);
  qs<HTMLButtonElement>(box, '#vd-all').addEventListener('click', () => { close(); openWhatsNew(); });
}

function setupUpdates(): void {
  let swRegistration: ServiceWorkerRegistration | undefined;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() { void showUpdateAvailable(); },
    onRegisteredSW(_url, reg) { swRegistration = reg; },
  });
  const updateBtn = document.getElementById('update-banner-btn') as HTMLButtonElement;
  updateBtn.addEventListener('click', () => {
    updateBtn.disabled = true;
    updateBtn.textContent = 'מעדכן...';
    try { localStorage.setItem(LAST_SEEN_VERSION_KEY, __APP_VERSION__); } catch { /* storage blocked */ }
    void updateSW(true);
    // If the new SW's "controlling" event never arrives, reload anyway.
    setTimeout(() => window.location.reload(), 4000);
  });

  // An installed PWA left open can go days without re-checking for a new
  // service worker — check on every return to the app and every few minutes,
  // plus compare version.json directly as a fallback.
  const checkForUpdate = (): void => {
    void swRegistration?.update().catch(() => { /* offline */ });
    void (async () => {
      const next = await fetchDeployedVersion();
      if (__APP_VERSION__ && next && next !== __APP_VERSION__) void showUpdateAvailable(next);
    })();
  };
  setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
  setTimeout(checkForUpdate, 5000);
  showUpdatedNotice();
}

async function init(): Promise<void> {
  hydrateIcons(document.body);
  await purgeOrphanMedia();
  // Ask once to keep the local database safe from storage eviction —
  // installed PWAs usually get this granted silently.
  void navigator.storage?.persist?.().catch(() => false);

  for (const [name, view] of Object.entries(VIEWS)) {
    view.init(document.getElementById(`view-${name}`) as HTMLElement);
  }
  registerNav(navigate, goBack);
  setupNav();
  setupClock();
  setupNetStatus();
  setupWhatsNewButton();
  setupUpdates();

  // Refresh whatever screen is open when data changes — except the form,
  // whose activate() would discard what's being composed.
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  onDataChanged(() => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { if (currentView && currentView !== 'form') void VIEWS[currentView]!.activate(); }, 150);
  });

  // A reload always lands on Home: per-view params live only in memory.
  await showView(HOME_VIEW, undefined, 'replace');

  // Species catalog: downloaded on first run, refreshed when stale.
  void refreshCatalogIfNeeded();
  window.addEventListener('online', () => void refreshCatalogIfNeeded());
}

void init().catch((err: unknown) => {
  console.error(err);
  toast('שגיאה בטעינת האפליקציה: ' + (err as Error).message, true, 6000);
});
