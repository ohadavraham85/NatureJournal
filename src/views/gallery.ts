/* views/gallery.ts — every photo and video clip from all observations, as
 * a grid (newest first, filterable by category). Tapping one opens a
 * full-screen viewer: swipe or arrows between items, each with its
 * observation's details, and a slideshow mode that advances on its own. */

import { CATEGORIES, category } from '../data/categories';
import { listObservations } from '../db/repository';
import { hydrateThumbs, photoUrl, thumbUrl } from '../lib/media-url';
import { obsTitle } from '../lib/observation';
import { escapeHtml } from '../lib/escape';
import { icon } from '../lib/icons';
import { fmtDateTime } from '../lib/ui';
import { navigate } from '../lib/nav';
import { reporterName } from '../sync/state';
import type { Observation } from '../types';

interface Item { mediaId: string; video: boolean; obs: Observation }

const SLIDE_MS = 4000;

let root: HTMLElement;
let filterCat = '';
let items: Item[] = [];

export function init(el: HTMLElement): void {
  root = el;
  root.innerHTML = `
    <div class="journal-head">
      <div class="title-row">
        <h2>גלריה</h2>
        <span class="muted" id="g-count"></span>
        <button type="button" class="btn btn-sm btn-soft" id="g-slideshow">${icon('play', 16, 2)} מצגת</button>
      </div>
      <div class="filter-chips" id="g-chips" role="group" aria-label="סינון לפי קטגוריה">
        <button type="button" class="filter-chip" data-cat="" aria-pressed="true">הכל</button>
        ${CATEGORIES.map((c) => `<button type="button" class="filter-chip" data-cat="${c.id}" aria-pressed="false" style="--cat:${c.color}">${c.label}</button>`).join('')}
      </div>
    </div>
    <div class="gallery-grid" id="g-grid"></div>
    <div class="empty" id="g-empty" hidden>${icon('image', 48, 1.4)}<p>התמונות והסרטונים מהתצפיות שלך יופיעו כאן.</p></div>`;
  root.querySelector('#g-chips')!.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.filter-chip');
    if (!chip) return;
    filterCat = chip.dataset.cat!;
    render();
  });
  root.querySelector('#g-grid')!.addEventListener('click', (e) => {
    const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-index]');
    if (tile) openViewer(shown(), Number(tile.dataset.index), false);
  });
  root.querySelector('#g-slideshow')!.addEventListener('click', () => {
    const list = shown();
    if (list.length) openViewer(list, 0, true);
  });
}

export async function activate(): Promise<void> {
  const all = await listObservations(); // newest first
  items = all.flatMap((o) => o.photoIds.map((id) => ({ mediaId: id, video: !!o.videoIds?.includes(id), obs: o })));
  render();
}

function shown(): Item[] {
  return filterCat ? items.filter((it) => it.obs.entries.some((e) => e.category === filterCat)) : items;
}

function render(): void {
  root.querySelectorAll<HTMLElement>('#g-chips .filter-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === filterCat)));
  const list = shown();
  const videos = list.filter((it) => it.video).length;
  const photos = list.length - videos;
  root.querySelector('#g-count')!.textContent = [
    photos === 1 ? 'תמונה אחת' : photos ? `${photos} תמונות` : '',
    videos === 1 ? 'סרטון אחד' : videos ? `${videos} סרטונים` : '',
  ].filter(Boolean).join(' · ');
  const grid = root.querySelector<HTMLElement>('#g-grid')!;
  grid.innerHTML = list.map((it, i) => `
    <button type="button" class="gallery-tile" data-index="${i}" aria-label="${escapeHtml(obsTitle(it.obs))}">
      <img alt="" data-thumb="${it.mediaId}" loading="lazy">
      ${it.video ? `<span class="play-badge small">${icon('play', 16, 2)}</span>` : ''}
    </button>`).join('');
  hydrateThumbs(grid);
  (root.querySelector('#g-empty') as HTMLElement).hidden = list.length > 0;
  (root.querySelector('#g-slideshow') as HTMLElement).hidden = list.length === 0;
}

/* ---------- full-screen viewer ---------- */

function openViewer(list: Item[], start: number, slideshow: boolean): void {
  let index = start;
  let playing = slideshow;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrap = document.createElement('div');
  wrap.className = 'viewer';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = `
    <div class="viewer-stage"></div>
    <button type="button" class="viewer-btn viewer-close" aria-label="סגירה">${icon('close', 24, 2.2)}</button>
    <button type="button" class="viewer-btn viewer-play" aria-label="מצגת"></button>
    <button type="button" class="viewer-btn viewer-prev" aria-label="הקודם">${icon('chevron', 26, 2.2)}</button>
    <button type="button" class="viewer-btn viewer-next" aria-label="הבא">${icon('chevron', 26, 2.2)}</button>
    <div class="viewer-info"></div>`;
  document.body.appendChild(wrap);
  const stage = wrap.querySelector<HTMLElement>('.viewer-stage')!;
  const info = wrap.querySelector<HTMLElement>('.viewer-info')!;
  const playBtn = wrap.querySelector<HTMLButtonElement>('.viewer-play')!;

  const schedule = (): void => {
    clearTimeout(timer);
    if (!playing) return;
    const v = stage.querySelector('video');
    // A video in the slideshow plays to its end before moving on.
    if (v) v.onended = () => go(1);
    else timer = setTimeout(() => go(1), SLIDE_MS);
  };
  const paintPlay = (): void => {
    playBtn.innerHTML = playing ? `${icon('pause', 22, 2.2)}` : `${icon('play', 22, 2)}`;
    playBtn.setAttribute('aria-label', playing ? 'עצירת המצגת' : 'מצגת');
  };

  const show = (): void => {
    const it = list[index]!;
    const o = it.obs;
    stage.innerHTML = it.video
      ? `<video controls playsinline ${playing ? 'autoplay muted' : ''}></video>`
      : '<img alt="">';
    const el = stage.firstElementChild as HTMLImageElement | HTMLVideoElement;
    void thumbUrl(it.mediaId).then((u) => {
      if (!u) return;
      if (el instanceof HTMLVideoElement) el.poster = u; else if (!el.src) el.src = u;
    });
    void photoUrl(it.mediaId).then((u) => { if (u) el.src = u; });
    const who = reporterName(o);
    info.innerHTML = `
      <strong>${escapeHtml(obsTitle(o))}</strong>
      <span>${[o.place, fmtDateTime(o.dateTime), who].filter(Boolean).map(escapeHtml).join(' · ')}</span>
      <span class="strip-tags">${[...new Set(o.entries.map((e) => e.category))].map((id) => {
        const c = category(id);
        return `<span class="cat-tag" style="--cat:${c.color}">${c.label}</span>`;
      }).join('')}</span>
      <span class="viewer-bottom"><span class="viewer-pos">${index + 1} / ${list.length}</span>
        <button type="button" class="btn btn-sm btn-soft" data-open>${icon('journal', 16)} לתצפית</button></span>`;
    schedule();
  };
  const go = (step: number): void => {
    index = (index + step + list.length) % list.length;
    show();
  };
  const close = (): void => {
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
    wrap.remove();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
    // RTL: the left arrow moves forward.
    else if (e.key === 'ArrowLeft') go(1);
    else if (e.key === 'ArrowRight') go(-1);
  };
  document.addEventListener('keydown', onKey);
  wrap.querySelector('.viewer-close')!.addEventListener('click', close);
  wrap.querySelector('.viewer-next')!.addEventListener('click', () => go(1));
  wrap.querySelector('.viewer-prev')!.addEventListener('click', () => go(-1));
  playBtn.addEventListener('click', () => { playing = !playing; paintPlay(); schedule(); });
  info.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-open]')) return;
    const id = list[index]!.obs.id;
    close();
    navigate('detail', { viewId: id });
  });
  // Swipe: in RTL, swiping left reveals the next item.
  let x0: number | null = null;
  stage.addEventListener('touchstart', (e) => { x0 = e.touches[0]!.clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0]!.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  });
  paintPlay();
  show();
}
