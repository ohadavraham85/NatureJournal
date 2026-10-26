/* views/form.ts — new/edit report. Starts from a photo: the first photo's
 * EXIF capture time and GPS position fill in the date and location; without
 * them, the current time and the device GPS are used instead. */

import { CATEGORIES, category, categoryIcon, type CategoryId } from '../data/categories';
import {
  addMedia, deleteUnclaimedMedia, getObservation, newId, placeSuggestions, saveObservation, speciesSuggestions,
} from '../db/repository';
import { readExif } from '../lib/exif';
import { processPhoto } from '../lib/image';
import { thumbUrl } from '../lib/media-url';
import { currentPosition, reverseGeocode } from '../lib/geo';
import { icon } from '../lib/icons';
import { escapeHtml } from '../lib/escape';
import { qs } from '../lib/dom';
import { allTaxa, findTaxonByName, getTaxon, taxonName } from '../lib/catalog';
import { wireCombo, type ComboItem } from '../lib/combo';
import { confirmDialog, fmtCoords, fromLocalInputValue, toast, toLocalInputValue } from '../lib/ui';
import { goBack, navigate } from '../lib/nav';
import type { DateSource, LocationSource, Observation, Taxon } from '../types';
import type { ViewParams } from './view';
import { getMe } from '../sync/state';

let root: HTMLElement;
let editId: string | undefined;
let prefill: Pick<ViewParams, 'prefillCategory' | 'prefillSpecies' | 'prefillTaxonId'> = {};

/** The report being composed. */
let draft: Observation;
/** Photos added during this form session — deleted again if it's abandoned. */
let addedPhotoIds: string[] = [];
/** True once the user typed a place name themselves, so a later reverse-geocode doesn't overwrite it. */
let placeTouched = false;
/** My past species names per category, most reported first ('' = all). */
let mySpecies = new Map<string, string[]>();
let myPlaces: string[] = [];
/** The whole species catalog (downloaded from iNaturalist). */
let catalog: Taxon[] = [];
let saving = false;
/** Bumped on every reset so a slow GPS fix from an earlier form session is ignored. */
let session = 0;

const DATE_SOURCE_LABEL: Record<DateSource, string> = {
  exif: 'מהתמונה', file: 'מתאריך הקובץ', now: 'עכשיו', manual: 'הוזן ידנית',
};
const LOC_SOURCE_LABEL: Record<LocationSource, string> = {
  exif: 'מהתמונה', gps: 'מיקום נוכחי', manual: 'נבחר ידנית', none: '',
};

function blankDraft(): Observation {
  const now = new Date().toISOString();
  return {
    id: newId(), dateTime: now, dateSource: 'now',
    lat: null, lng: null, accuracy: null, locationSource: 'none', place: '',
    category: '' as CategoryId, species: '', quantity: 1, uncertain: false, note: '',
    photoIds: [], createdAt: now, updatedAt: now,
  };
}

export function init(el: HTMLElement): void {
  root = el;
  root.innerHTML = `
    <form class="report-form" novalidate>
      <div class="photo-strip" id="f-photos"></div>
      <div class="photo-pick" id="f-photo-pick">
        <button type="button" class="photo-pick-main" id="f-pick">
          ${icon('camera', 40, 1.6)}
          <strong>צילום או בחירת תמונה</strong>
          <span>התאריך והמיקום יילקחו מהתמונה</span>
        </button>
      </div>
      <input type="file" id="f-file" accept="image/*" multiple hidden>
      <input type="file" id="f-camera" accept="image/*" capture="environment" hidden>

      <fieldset class="field">
        <legend>קטגוריה</legend>
        <div class="cat-picker" id="f-cats">
          ${CATEGORIES.map((c) => `
            <button type="button" class="cat-btn" data-cat="${c.id}" aria-pressed="false" style="--cat:${c.color};--cat-tint:${c.tint}">
              <span class="cat-icon">${categoryIcon(c.id, 22)}</span>
              <span class="cat-label">${c.label}</span>
            </button>`).join('')}
        </div>
      </fieldset>

      <div class="field">
        <label for="f-species">שם המין</label>
        <div class="combo"><input id="f-species" type="text" enterkeyhint="next" placeholder="מקלידים ובוחרים מהרשימה, למשל: שועל"></div>
        <span class="sci-link" id="f-sci" hidden></span>
      </div>

      <div class="field-row">
        <div class="qty">
          <span class="qty-label" id="f-qty-label">כמות</span>
          <button type="button" class="qty-btn" id="f-qty-minus" aria-label="פחות">−</button>
          <input id="f-qty" type="number" inputmode="numeric" min="1" value="1" aria-labelledby="f-qty-label">
          <button type="button" class="qty-btn" id="f-qty-plus" aria-label="יותר">+</button>
        </div>
        <label class="check"><input type="checkbox" id="f-uncertain"> לא בטוח בזיהוי</label>
      </div>

      <div class="where-when">
        <div class="ww-row">
          <span class="ww-icon">${icon('pin', 18)}</span>
          <div class="ww-main">
            <div class="combo combo-inline"><input id="f-place" type="text" placeholder="שם המקום" aria-label="שם המקום"></div>
            <span class="ww-meta" id="f-coords"></span>
          </div>
          <span class="ww-btns">
            <button type="button" class="btn btn-sm btn-soft" id="f-map" title="בחירת מיקום במפה">${icon('map', 16)} במפה</button>
            <button type="button" class="btn btn-sm btn-soft" id="f-gps" title="שימוש במיקום הנוכחי">${icon('crosshair', 16)} מיקום נוכחי</button>
          </span>
        </div>
        <div class="ww-row">
          <span class="ww-icon">${icon('clock', 18)}</span>
          <div class="ww-main">
            <input id="f-date" type="datetime-local" aria-label="תאריך ושעה">
            <span class="ww-meta" id="f-date-src"></span>
          </div>
        </div>
      </div>

      <div class="field">
        <label for="f-note">הערה</label>
        <textarea id="f-note" rows="3" placeholder="מה ראית, התנהגות, סביבה..."></textarea>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn-block" id="f-save">שמירת הדיווח</button>
        <button type="button" class="btn btn-block btn-ghost-dark" id="f-cancel">ביטול</button>
      </div>
    </form>`;

  const form = qs<HTMLFormElement>(root, 'form');
  const fileInput = qs<HTMLInputElement>(root, '#f-file');
  const cameraInput = qs<HTMLInputElement>(root, '#f-camera');

  qs(root, '#f-pick').addEventListener('click', () => fileInput.click());
  for (const inp of [fileInput, cameraInput]) {
    inp.addEventListener('change', () => {
      const files = Array.from(inp.files ?? []);
      inp.value = '';
      if (files.length) void addPhotos(files);
    });
  }

  qs(root, '#f-cats').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.cat-btn');
    if (!btn) return;
    if (draft.category !== btn.dataset.cat) unlinkTaxon();
    draft.category = btn.dataset.cat as CategoryId;
    paintCategory();
  });

  const speciesInput = qs<HTMLInputElement>(root, '#f-species');
  speciesInput.addEventListener('input', () => {
    draft.species = speciesInput.value;
    unlinkTaxon();
  });
  wireCombo(speciesInput, {
    scrollOnFocus: true,
    getGroups: speciesGroups,
    emptyText: 'אין התאמה — אפשר להשאיר את השם כפי שהוקלד',
    onSelect: (item) => {
      const taxon = item.data ? catalog.find((t) => t.id === Number(item.data)) : undefined;
      if (taxon) linkTaxon(taxon);
      else { draft.species = item.value; unlinkTaxon(); }
      speciesInput.value = draft.species;
    },
  });

  const qty = qs<HTMLInputElement>(root, '#f-qty');
  const setQty = (n: number): void => { draft.quantity = Math.max(1, Math.round(n) || 1); qty.value = String(draft.quantity); };
  qs(root, '#f-qty-minus').addEventListener('click', () => setQty(draft.quantity - 1));
  qs(root, '#f-qty-plus').addEventListener('click', () => setQty(draft.quantity + 1));
  qty.addEventListener('change', () => setQty(Number(qty.value)));

  qs<HTMLInputElement>(root, '#f-uncertain').addEventListener('change', (e) => {
    draft.uncertain = (e.target as HTMLInputElement).checked;
  });

  const place = qs<HTMLInputElement>(root, '#f-place');
  place.addEventListener('input', () => { draft.place = place.value; placeTouched = true; });
  wireCombo(place, {
    scrollOnFocus: true,
    getGroups: () => [{ title: 'מקומות קודמים', items: myPlaces.map((p) => ({ value: p, label: p })), limit: 12, emptyLimit: 8 }],
    onSelect: (item) => { draft.place = item.value; placeTouched = true; },
  });

  qs(root, '#f-gps').addEventListener('click', () => void useCurrentLocation(true));
  qs(root, '#f-map').addEventListener('click', () => void chooseOnMap());

  const date = qs<HTMLInputElement>(root, '#f-date');
  date.addEventListener('change', () => {
    const iso = fromLocalInputValue(date.value);
    if (!iso) return;
    draft.dateTime = iso;
    draft.dateSource = 'manual';
    paintWhereWhen();
  });

  qs<HTMLTextAreaElement>(root, '#f-note').addEventListener('input', (e) => {
    draft.note = (e.target as HTMLTextAreaElement).value;
  });

  qs(root, '#f-photos').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const remove = target.closest<HTMLElement>('[data-remove]');
    if (remove) {
      draft.photoIds = draft.photoIds.filter((id) => id !== remove.dataset.remove);
      paintPhotos();
      return;
    }
    if (target.closest('.photo-add')) fileInput.click();
    else if (target.closest('.photo-add-camera')) cameraInput.click();
  });

  form.addEventListener('submit', (e) => { e.preventDefault(); void save(); });
  qs(root, '#f-cancel').addEventListener('click', () => void cancel());
}

export function setParams(params: ViewParams): void {
  editId = params.editId;
  prefill = { prefillCategory: params.prefillCategory, prefillSpecies: params.prefillSpecies, prefillTaxonId: params.prefillTaxonId };
}

export async function activate(): Promise<void> {
  session++;
  saving = false;
  addedPhotoIds = [];
  placeTouched = false;
  const existing = editId ? await getObservation(editId) : undefined;
  draft = existing ? { ...existing, photoIds: [...existing.photoIds] } : blankDraft();
  if (existing) placeTouched = true;
  else if (prefill.prefillCategory) {
    draft.category = prefill.prefillCategory as CategoryId;
    draft.species = prefill.prefillSpecies ?? '';
    const taxon = prefill.prefillTaxonId ? await getTaxon(prefill.prefillTaxonId) : undefined;
    if (taxon) { draft.taxonId = taxon.id; draft.sci = taxon.sci; }
  }

  document.getElementById('topbar-title')!.textContent = existing ? 'עריכת דיווח' : 'דיווח חדש';
  qs<HTMLInputElement>(root, '#f-species').value = draft.species;
  qs<HTMLInputElement>(root, '#f-qty').value = String(draft.quantity);
  qs<HTMLInputElement>(root, '#f-uncertain').checked = draft.uncertain;
  qs<HTMLInputElement>(root, '#f-place').value = draft.place;
  qs<HTMLTextAreaElement>(root, '#f-note').value = draft.note;
  qs(root, '#f-save').textContent = existing ? 'שמירת השינויים' : 'שמירת הדיווח';
  paintCategory();
  paintPhotos();
  paintWhereWhen();
  paintSci();

  [myPlaces, catalog] = await Promise.all([placeSuggestions(), allTaxa()]);
  mySpecies = new Map(await Promise.all(['', ...CATEGORIES.map((c) => c.id)].map(async (id) => [id, await speciesSuggestions(id || undefined)] as const)));

  // A new report gets the current position right away, so it's ready even
  // without a photo; a photo with its own GPS replaces it.
  if (!existing) void useCurrentLocation(false);
}

export function deactivate(): void {
  // Leaving without saving (tab bar, back button) discards photos added here.
  if (!saving && addedPhotoIds.length) void deleteUnclaimedMedia(addedPhotoIds);
  addedPhotoIds = [];
}

/* ---------- photos ---------- */

async function addPhotos(files: File[]): Promise<void> {
  const mySession = session;
  const wasEmpty = draft.photoIds.length === 0;
  const strip = qs(root, '#f-photos');
  strip.classList.add('busy');
  try {
    for (const [i, file] of files.entries()) {
      // The first photo of a report sets its time and place.
      if (wasEmpty && i === 0) {
        const exif = await readExif(file);
        if (mySession !== session) return;
        applyPhotoMetadata(exif.date, exif.lat, exif.lng, file);
      }
      const rec = await processPhoto(file);
      if (mySession !== session) return;
      await addMedia(rec);
      addedPhotoIds.push(rec.id);
      draft.photoIds.push(rec.id);
      paintPhotos();
    }
  } catch (err) {
    toast('לא ניתן לטעון את התמונה: ' + (err as Error).message, true);
  } finally {
    strip.classList.remove('busy');
  }
}

function applyPhotoMetadata(date: Date | null, lat: number | null, lng: number | null, file: File): void {
  if (draft.dateSource !== 'manual') {
    if (date) {
      draft.dateTime = date.toISOString();
      draft.dateSource = 'exif';
    } else if (file.lastModified && Date.now() - file.lastModified > 10 * 60 * 1000) {
      // A photo picked from the gallery (not just taken) with no EXIF date —
      // its file date is a better guess than "now".
      draft.dateTime = new Date(file.lastModified).toISOString();
      draft.dateSource = 'file';
    }
  }
  if (lat != null && lng != null && draft.locationSource !== 'manual') {
    draft.lat = lat;
    draft.lng = lng;
    draft.accuracy = null;
    draft.locationSource = 'exif';
    void fillPlaceName();
  }
  paintWhereWhen();
}

function paintPhotos(): void {
  const strip = qs(root, '#f-photos');
  const has = draft.photoIds.length > 0;
  qs(root, '#f-photo-pick').hidden = has;
  strip.hidden = !has;
  if (!has) { strip.innerHTML = ''; return; }
  strip.innerHTML = draft.photoIds.map((id, i) => `
    <div class="photo-thumb${i === 0 ? ' cover' : ''}">
      <img alt="" data-id="${id}">
      <button type="button" class="photo-remove" data-remove="${id}" aria-label="הסרת התמונה">${icon('close', 16, 2.2)}</button>
    </div>`).join('') + `
    <button type="button" class="photo-add" aria-label="הוספת תמונה מהגלריה">${icon('image', 26, 1.6)}<span>עוד תמונה</span></button>
    <button type="button" class="photo-add-camera" aria-label="צילום תמונה נוספת">${icon('camera', 26, 1.6)}<span>צילום</span></button>`;
  strip.querySelectorAll<HTMLImageElement>('img[data-id]').forEach((img) => {
    void thumbUrl(img.dataset.id!).then((url) => { if (url) img.src = url; });
  });
}

/* ---------- category & species ---------- */

function paintCategory(): void {
  root.querySelectorAll<HTMLElement>('.cat-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.cat === draft.category));
  });
}

/** Pick-list groups for the species field: my past names first, then the
 * catalog — the chosen category's species, or every category if none is
 * chosen yet (picking one then sets the category too). */
function speciesGroups(): Array<{ title: string; items: ComboItem[]; limit: number; emptyLimit: number }> {
  const cat = draft.category;
  const mine = mySpecies.get(cat) ?? [];
  const mineSet = new Set(mine);
  return [
    { title: 'מהדיווחים שלך', items: mine.map((n) => ({ value: n, label: n })), limit: 5, emptyLimit: 6 },
    {
      title: cat ? `${category(cat).label} בישראל` : 'מאגר המינים בישראל',
      items: catalogItemsFor(cat).filter((it) => !mineSet.has(it.value)),
      limit: 40, emptyLimit: 15,
    },
  ];
}

/** Catalog rows per category, built once (most observed first) and reused on every keystroke. */
let itemCache: { source: Taxon[]; byCat: Map<string, ComboItem[]> } = { source: [], byCat: new Map() };
function catalogItemsFor(cat: string): ComboItem[] {
  if (itemCache.source !== catalog) itemCache = { source: catalog, byCat: new Map() };
  const cached = itemCache.byCat.get(cat);
  if (cached) return cached;
  const inCat = cat ? catalog.filter((t) => t.category === cat) : catalog;
  const items: ComboItem[] = inCat.map((t) => ({
    value: taxonName(t),
    label: taxonName(t),
    sub: [t.sci !== taxonName(t) ? t.sci : '', cat ? '' : category(t.category).label].filter(Boolean).join(' · '),
    img: t.photo,
    keys: [t.he, t.en, t.sci],
    data: String(t.id),
    weight: t.count,
  })).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  itemCache.byCat.set(cat, items);
  return items;
}

function linkTaxon(t: Taxon): void {
  if (draft.category !== t.category) {
    draft.category = t.category;
    paintCategory();
  }
  draft.species = taxonName(t);
  draft.taxonId = t.id;
  draft.sci = t.sci;
  paintSci();
}

function unlinkTaxon(): void {
  if (draft.taxonId === undefined && draft.sci === undefined) return;
  delete draft.taxonId;
  delete draft.sci;
  paintSci();
}

function paintSci(): void {
  const el = qs(root, '#f-sci');
  el.hidden = !draft.sci;
  el.innerHTML = draft.sci ? `${icon('check', 14, 2.4)} מהמאגר · <span dir="ltr">${escapeHtml(draft.sci)}</span>` : '';
}

/* ---------- where & when ---------- */

async function useCurrentLocation(userAsked: boolean): Promise<void> {
  const mySession = session;
  const btn = qs<HTMLButtonElement>(root, '#f-gps');
  btn.disabled = true;
  if (userAsked || draft.locationSource === 'none') qs(root, '#f-coords').textContent = 'מאתר מיקום...';
  const pos = await currentPosition();
  if (mySession !== session) return;
  btn.disabled = false;
  // An automatic fix never overrides a location the photo (or the user) already gave.
  if (pos && (userAsked || draft.locationSource === 'none' || draft.locationSource === 'gps')) {
    draft.lat = pos.lat;
    draft.lng = pos.lng;
    draft.accuracy = pos.accuracy;
    draft.locationSource = userAsked ? 'manual' : 'gps';
    if (userAsked) placeTouched = false;
    void fillPlaceName();
  } else if (!pos && userAsked) {
    toast('לא ניתן לקבל מיקום. כדאי לבדוק שהרשאת המיקום פעילה.', true);
  }
  paintWhereWhen();
}

async function chooseOnMap(): Promise<void> {
  const mySession = session;
  const { pickLocation } = await import('../lib/location-picker');
  const current = draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null;
  const picked = await pickLocation(current);
  if (!picked || mySession !== session) return;
  draft.lat = picked.lat;
  draft.lng = picked.lng;
  draft.accuracy = null;
  draft.locationSource = 'manual';
  placeTouched = false;
  paintWhereWhen();
  void fillPlaceName();
}

async function fillPlaceName(): Promise<void> {
  if (placeTouched || draft.lat == null || draft.lng == null) return;
  const mySession = session;
  const { lat, lng } = draft;
  const name = await reverseGeocode(lat, lng);
  if (mySession !== session || placeTouched || draft.lat !== lat || draft.lng !== lng || !name) return;
  draft.place = name;
  qs<HTMLInputElement>(root, '#f-place').value = name;
}

function paintWhereWhen(): void {
  const coords = qs(root, '#f-coords');
  if (draft.lat != null && draft.lng != null) {
    const src = LOC_SOURCE_LABEL[draft.locationSource];
    const acc = draft.accuracy ? ` ±${draft.accuracy} מ׳` : '';
    coords.innerHTML = `<span dir="ltr">${fmtCoords(draft.lat, draft.lng)}</span>${acc}${src ? ` · ${src}` : ''}`;
  } else if (coords.textContent !== 'מאתר מיקום...') {
    coords.textContent = 'אין מיקום';
  }
  qs<HTMLInputElement>(root, '#f-date').value = toLocalInputValue(new Date(draft.dateTime));
  qs(root, '#f-date-src').textContent = DATE_SOURCE_LABEL[draft.dateSource];
}

/* ---------- save / cancel ---------- */

async function save(): Promise<void> {
  if (!draft.category) {
    toast('יש לבחור קטגוריה', true);
    qs(root, '#f-cats').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (!draft.species.trim() && !draft.photoIds.length) {
    toast('יש להוסיף תמונה או שם מין', true);
    return;
  }
  // A typed name that exactly matches a catalog species gets linked to it.
  if (!draft.taxonId && draft.species.trim()) {
    const t = await findTaxonByName(draft.category, draft.species);
    if (t) { draft.taxonId = t.id; draft.sci = t.sci; }
  }
  if (!editId) {
    const me = await getMe();
    draft.reporterId = me.id;
    if (me.name) draft.reporterName = me.name;
  }
  saving = true;
  const btn = qs<HTMLButtonElement>(root, '#f-save');
  btn.disabled = true;
  try {
    await saveObservation({ ...draft, species: draft.species.trim(), place: draft.place.trim(), note: draft.note.trim() });
    addedPhotoIds = [];
    toast(editId ? 'השינויים נשמרו' : `נשמר: ${draft.species.trim() || category(draft.category).label}`);
    if (editId) goBack();
    else navigate('journal', undefined, true); // back from the journal shouldn't reopen a blank form
  } catch (err) {
    saving = false;
    toast('השמירה נכשלה: ' + (err as Error).message, true);
  } finally {
    btn.disabled = false;
  }
}

async function cancel(): Promise<void> {
  const dirty = addedPhotoIds.length > 0 || (!editId && (draft.species.trim() || draft.note.trim()));
  if (dirty && !(await confirmDialog('לצאת בלי לשמור? מה שהוזן לא יישמר.', 'יציאה בלי שמירה'))) return;
  goBack();
}
