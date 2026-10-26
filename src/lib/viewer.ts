/* lib/viewer.ts — full-screen photo/video viewer shared by the gallery and
 * the observation screen: swipe, arrows or keys between items, each with
 * its species and observation details, and a slideshow mode (4 s per photo;
 * a clip plays to its end before moving on). */

import { category } from '../data/categories';
import { photoUrl, thumbUrl } from './media-url';
import { entryName, obsTitle } from './observation';
import { escapeHtml } from './escape';
import { icon } from './icons';
import { fmtDateTime } from './ui';
import { navigate } from './nav';
import { reporterName } from '../sync/state';
import type { Observation } from '../types';

export interface ViewerItem { mediaId: string; video: boolean; obs: Observation }

const SLIDE_MS = 4000;

export function openViewer(list: ViewerItem[], start: number, slideshow = false): void {
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
    // A photo that belongs to one species is captioned with that species.
    const entry = o.entries.find((e) => e.mediaIds?.includes(it.mediaId));
    info.innerHTML = `
      <strong>${escapeHtml(entry ? entryName(entry) : obsTitle(o))}</strong>
      ${entry?.note ? `<span class="viewer-note">${escapeHtml(entry.note)}</span>` : ''}
      <span>${[o.place, fmtDateTime(o.dateTime), who].filter(Boolean).map(escapeHtml).join(' · ')}</span>
      <span class="strip-tags">${[...new Set((entry ? [entry] : o.entries).map((e) => e.category))].map((id) => {
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
