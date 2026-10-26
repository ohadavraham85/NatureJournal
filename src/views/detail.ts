/* views/detail.ts — one report in full: photos, details, edit and delete. */

import { category, categoryIcon } from '../data/categories';
import { deleteObservation, getObservation } from '../db/repository';
import { displayName } from '../lib/obs-card';
import { photoUrl } from '../lib/media-url';
import { findTaxonByName, getTaxon } from '../lib/catalog';
import { openSpeciesCard } from '../lib/species-info';
import { listObservations } from '../db/repository';
import { escapeHtml } from '../lib/escape';
import { icon } from '../lib/icons';
import { confirmDialog, fmtCoords, fmtDateTime, showImageModal, toast } from '../lib/ui';
import { goBack, navigate } from '../lib/nav';
import type { ViewParams } from './view';
import { canEdit, getMe, reporterName } from '../sync/state';

let root: HTMLElement;
let viewId = '';

export function init(el: HTMLElement): void {
  root = el;
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const img = t.closest<HTMLImageElement>('.detail-photos img');
    if (img?.src) { showImageModal(img.src); return; }
    if (t.closest('#d-info')) void openInfo();
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
  const c = category(o.category);
  const me = await getMe();
  const mine = canEdit(o, me);
  const coords = fmtCoords(o.lat, o.lng);
  const mapsUrl = o.lat != null && o.lng != null ? `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}` : '';
  root.innerHTML = `
    <article class="detail" style="--cat:${c.color};--cat-tint:${c.tint}">
      ${o.photoIds.length
        ? `<div class="detail-photos${o.photoIds.length > 1 ? ' multi' : ''}">${o.photoIds.map((id) => `<img alt="${escapeHtml(displayName(o))}" data-full="${id}">`).join('')}</div>`
        : `<div class="detail-placeholder">${categoryIcon(c.id, 64, 1.3)}</div>`}
      <div class="detail-body">
        <div class="detail-title">
          <h2>${escapeHtml(displayName(o))}</h2>
          ${o.sci ? `<p class="detail-sci" dir="ltr">${escapeHtml(o.sci)}</p>` : ''}
          <span class="cat-tag">${categoryIcon(c.id, 14, 2)} ${c.label}</span>
        </div>
        ${o.uncertain ? `<p class="uncertain-note">${icon('question', 18)} לא בטוח בזיהוי</p>` : ''}
        <dl class="detail-facts">
          <div><dt>${icon('clock', 18)}</dt><dd>${fmtDateTime(o.dateTime)}</dd></div>
          <div><dt>${icon('pin', 18)}</dt><dd>${o.place ? escapeHtml(o.place) : 'ללא שם מקום'}${coords ? `<br><a href="${mapsUrl}" target="_blank" rel="noopener" dir="ltr" class="coords">${coords}</a>` : ''}</dd></div>
          <div><dt>כמות</dt><dd>${o.quantity}</dd></div>
          ${reporterName(o) ? `<div><dt>דיווח</dt><dd>${escapeHtml(reporterName(o))}${o.reporterId === me.id ? ' (אני)' : ''}</dd></div>` : ''}
        </dl>
        ${o.note ? `<div class="detail-note">${escapeHtml(o.note).replace(/\n/g, '<br>')}</div>` : ''}
        ${o.species.trim() ? `<button type="button" class="btn btn-soft" id="d-info">${icon('info', 18)} מידע על המין</button>` : ''}
        ${mine ? `<div class="detail-actions">
          <button type="button" class="btn btn-primary" id="d-edit">${icon('edit', 18)} עריכה</button>
          <button type="button" class="btn btn-danger" id="d-delete">${icon('trash', 18)} מחיקה</button>
        </div>` : '<p class="hint">רק מי שדיווח יכול לערוך או למחוק את הדיווח.</p>'}
      </div>
    </article>`;
  root.querySelectorAll<HTMLImageElement>('img[data-full]').forEach((img) => {
    void photoUrl(img.dataset.full!).then((url) => { if (url) img.src = url; });
  });
}

async function openInfo(): Promise<void> {
  const o = await getObservation(viewId);
  if (!o) return;
  const taxon = o.taxonId ? await getTaxon(o.taxonId) : await findTaxonByName(o.category, o.species);
  const name = o.species.trim();
  const myCount = (await listObservations()).filter((x) => x.category === o.category && x.species.trim() === name).length;
  openSpeciesCard({ name, categoryId: o.category, taxon, myCount });
}

async function remove(): Promise<void> {
  if (!(await confirmDialog('למחוק את הדיווח ואת התמונות שלו? אי אפשר לבטל את זה.', 'מחיקה'))) return;
  await deleteObservation(viewId);
  toast('הדיווח נמחק');
  goBack();
}
