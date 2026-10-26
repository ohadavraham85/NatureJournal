/* views/detail.ts — one observation in full: where and when at the top,
 * the photos, then every species seen there; edit and delete. */

import { category, categoryIcon } from '../data/categories';
import { deleteObservation, getObservation, listObservations } from '../db/repository';
import { hydrateThumbs, photoUrl, thumbUrl } from '../lib/media-url';
import { openViewer } from '../lib/viewer';
import { findTaxonByName, getTaxon } from '../lib/catalog';
import { openSpeciesCard } from '../lib/species-info';
import { entryName, obsTitle, primaryCategory } from '../lib/observation';
import { escapeHtml } from '../lib/escape';
import { icon } from '../lib/icons';
import { confirmDialog, fmtCoords, fmtDateTime, showImageModal, toast } from '../lib/ui';
import { goBack, navigate } from '../lib/nav';
import type { ViewParams } from './view';
import { canEdit, getMe, isMe, reporterName } from '../sync/state';

let root: HTMLElement;
let viewId = '';

export function init(el: HTMLElement): void {
  root = el;
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const media = t.closest<HTMLElement>('[data-media]');
    if (media) { void openMedia(media.dataset.media!); return; }
    const img = t.closest<HTMLImageElement>('.detail-photos img');
    if (img?.src) { showImageModal(img.src); return; }
    const info = t.closest<HTMLElement>('[data-info]');
    if (info) void openInfo(info.dataset.info!);
    else if (t.closest('#d-edit')) navigate('form', { editId: viewId });
    else if (t.closest('#d-delete')) void remove();
  });
}

export function setParams(params: ViewParams): void {
  if (params.viewId) viewId = params.viewId;
}

export async function activate(): Promise<void> {
  const o = await getObservation(viewId);
  if (!o) {
    root.innerHTML = '<div class="empty"><p>הדיווח לא נמצא.</p></div>';
    return;
  }
  const c = category(primaryCategory(o));
  const me = await getMe();
  const mine = canEdit(o, me);
  const coords = fmtCoords(o.lat, o.lng);
  const mapsUrl = o.lat != null && o.lng != null ? `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}` : '';
  const who = reporterName(o);
  // Media not tied to a species (reports from before per-species photos) shows on top.
  const assigned = new Set(o.entries.flatMap((e) => e.mediaIds ?? []));
  const loose = o.photoIds.filter((id) => !assigned.has(id));
  root.innerHTML = `
    <article class="detail" style="--cat:${c.color};--cat-tint:${c.tint}">
      <div class="detail-where">
        <div class="detail-place">${icon('pin', 22)}<div><strong>${o.place ? escapeHtml(o.place) : 'ללא שם מקום'}</strong>
          ${coords ? `<a href="${mapsUrl}" target="_blank" rel="noopener" dir="ltr" class="coords">${coords}</a>` : ''}</div></div>
        <div class="detail-when">${icon('clock', 18)} ${fmtDateTime(o.dateTime)}${who ? ` · ${escapeHtml(who)}${isMe(o.reporterId, me) ? ' (אני)' : ''}` : ''}</div>
      </div>
      ${loose.length
        ? `<div class="detail-photos${loose.length > 1 ? ' multi' : ''}">${loose.map((id) => o.videoIds?.includes(id)
          ? `<video controls playsinline preload="metadata" data-video="${id}" aria-label="סרטון"></video>`
          : `<img alt="${escapeHtml(obsTitle(o))}" data-full="${id}">`).join('')}</div>`
        : ''}
      <div class="detail-body">
        <h2 class="detail-heading">${o.entries.length > 1 ? `${o.entries.length} מינים בתצפית` : 'המין'}</h2>
        <ul class="entry-list">
          ${o.entries.map((e) => {
            const ec = category(e.category);
            return `
              <li class="entry-card" style="--cat:${ec.color};--cat-tint:${ec.tint}">
                <span class="cat-icon">${categoryIcon(ec.id, 22)}</span>
                <span class="entry-text">
                  <strong>${escapeHtml(entryName(e))}${e.quantity > 1 ? ` <span class="strip-qty">×${e.quantity}</span>` : ''}</strong>
                  ${e.sci ? `<small dir="ltr" class="entry-sci">${escapeHtml(e.sci)}</small>` : ''}
                  <span class="strip-tags"><span class="cat-tag">${ec.label}</span>${e.uncertain ? '<span class="uncertain-tag">לא בטוח בזיהוי</span>' : ''}</span>
                </span>
                ${e.species.trim() ? `<button type="button" class="btn btn-sm btn-soft" data-info="${e.id}" aria-label="מידע על ${escapeHtml(entryName(e))}">${icon('info', 16)} מידע</button>` : ''}
                ${e.mediaIds?.length ? `<span class="entry-media-view">${e.mediaIds.map((id) => `
                  <button type="button" class="entry-thumb" data-media="${id}" aria-label="הצגה במסך מלא">
                    <img alt="" data-thumb="${id}">${o.videoIds?.includes(id) ? `<span class="play-badge small">${icon('play', 14, 2)}</span>` : ''}
                  </button>`).join('')}</span>` : ''}
                ${e.note ? `<span class="entry-note">${escapeHtml(e.note).replace(/\n/g, '<br>')}</span>` : ''}
              </li>`;
          }).join('')}
        </ul>
        ${o.note ? `<div class="detail-note">${escapeHtml(o.note).replace(/\n/g, '<br>')}</div>` : ''}
        ${mine ? `<div class="detail-actions">
          <button type="button" class="btn btn-primary" id="d-edit">${icon('edit', 18)} עריכה</button>
          <button type="button" class="btn btn-danger" id="d-delete">${icon('trash', 18)} מחיקה</button>
        </div>` : '<p class="hint">רק מי שדיווח (או מנהל היומן) יכול לערוך או למחוק את הדיווח.</p>'}
      </div>
    </article>`;
  hydrateThumbs(root);
  root.querySelectorAll<HTMLImageElement>('img[data-full]').forEach((img) => {
    void photoUrl(img.dataset.full!).then((url) => { if (url) img.src = url; });
  });
  root.querySelectorAll<HTMLVideoElement>('video[data-video]').forEach((v) => {
    void thumbUrl(v.dataset.video!).then((url) => { if (url) v.poster = url; });
    void photoUrl(v.dataset.video!).then((url) => { if (url) v.src = url; });
  });
}

/** A species photo opens the full-screen viewer over all of the observation's media. */
async function openMedia(mediaId: string): Promise<void> {
  const o = await getObservation(viewId);
  if (!o) return;
  const list = o.photoIds.map((id) => ({ mediaId: id, video: !!o.videoIds?.includes(id), obs: o }));
  openViewer(list, Math.max(0, o.photoIds.indexOf(mediaId)));
}

async function openInfo(entryId: string): Promise<void> {
  const o = await getObservation(viewId);
  const e = o?.entries.find((x) => x.id === entryId);
  if (!e) return;
  const taxon = e.taxonId ? await getTaxon(e.taxonId) : await findTaxonByName(e.category, e.species);
  const name = e.species.trim();
  let myCount = 0;
  for (const x of await listObservations()) myCount += x.entries.filter((y) => y.category === e.category && y.species.trim() === name).length;
  openSpeciesCard({ name, categoryId: e.category, taxon, myCount });
}

async function remove(): Promise<void> {
  if (!(await confirmDialog('למחוק את התצפית, כל המינים שבה והתמונות שלה? אי אפשר לבטל את זה.', 'מחיקה'))) return;
  await deleteObservation(viewId);
  toast('התצפית נמחקה');
  goBack();
}
