/* sync/engine.ts — two-way sync of a shared journal through Firestore and
 * Firebase Storage. Every local save/delete is queued (state.ts outbox) and
 * uploaded — photos first, then the report document; remote changes stream
 * in through a live listener. Conflicts: the copy edited last wins. */

import {
  collection, doc, getDocs, onSnapshot, setDoc, type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firebaseDb, firebaseStorage } from './firebase';
import {
  getMedia, getObservationRaw, getSetting, listObservationsRaw, mediaForObservation, onLocalChange,
  putMedia, putObservationRaw, setSetting,
} from '../db/repository';
import { db } from '../db/database';
import {
  getOutbox, queueForSync, removeFromOutbox, setMembers, setStatus, type Me,
} from './state';
import type { Member, Observation } from '../types';

interface RemotePhoto { id: string; full: string; thumb: string }
type RemoteObservation = Observation & { photos?: RemotePhoto[] };

let code = '';
let unsubs: Unsubscribe[] = [];
let flushing: Promise<void> | null = null;
let flushAgain = false;
let serverPending = false;
/** The last upload attempt failed — shown until a later attempt succeeds. */
let lastError = '';

const obsCol = (): ReturnType<typeof collection> => collection(firebaseDb(), 'households', code, 'nature_observations');
const memberCol = (): ReturnType<typeof collection> => collection(firebaseDb(), 'households', code, 'nature_members');

/** Firestore rejects `undefined` fields. */
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Lists the members of a journal before joining it ("who are you?"). */
export async function fetchMembers(journalCode: string): Promise<Member[]> {
  const snap = await getDocs(collection(firebaseDb(), 'households', journalCode, 'nature_members'));
  return snap.docs.map((d) => d.data() as Member).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
}

export async function start(journalCode: string, who: Me): Promise<void> {
  stop();
  code = journalCode;
  setStatus({ state: navigator.onLine ? 'connecting' : 'offline', message: undefined });

  // First connection of this device to this journal: my existing reports
  // get my name on them and all of them go up.
  const seededKey = `syncSeeded_${code}`;
  if (!(await getSetting<boolean>(seededKey, false))) {
    const all = await listObservationsRaw();
    for (const o of all) {
      const mine = !o.reporterId || o.reporterId === who.id;
      if (mine && o.reporterName !== who.name) {
        await putObservationRaw({ ...o, reporterId: who.id, reporterName: who.name, updatedAt: new Date().toISOString() });
      }
    }
    await queueForSync(all.map((o) => o.id));
    await setSetting(seededKey, true);
  }

  // Wait (briefly) for my member entry to reach the server, so someone
  // invited right after creating the journal already sees my name.
  const memberWrite = setDoc(doc(memberCol(), who.id), clean({ id: who.id, name: who.name, joinedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }), { merge: true })
    .catch((err: Error) => setStatus({ state: 'error', message: err.message }));
  await Promise.race([memberWrite, new Promise((r) => setTimeout(r, 8000))]);

  unsubs.push(onLocalChange((id) => { void queueForSync([id]).then(flush); }));

  unsubs.push(onSnapshot(obsCol(), { includeMetadataChanges: true }, (snap) => {
    serverPending = snap.metadata.hasPendingWrites;
    for (const ch of snap.docChanges()) {
      if (ch.type !== 'removed') void mergeRemote(ch.doc.data() as RemoteObservation);
    }
    void refreshState();
  }, (err) => setStatus({ state: navigator.onLine ? 'error' : 'offline', message: err.message })));

  unsubs.push(onSnapshot(memberCol(), (snap) => {
    void setMembers(snap.docs.map((d) => d.data() as Member));
  }, () => { /* members list is cosmetic — the report listener reports errors */ }));

  const onOnline = (): void => { void flush(); void refreshState(); };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOnline);
  unsubs.push(() => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOnline); });

  // Retry anything stuck in the outbox (e.g. an upload cut off mid-way).
  const retry = setInterval(() => { void flush(); }, 60_000);
  unsubs.push(() => clearInterval(retry));

  await flush();
}

export function stop(): void {
  unsubs.forEach((u) => u());
  unsubs = [];
  code = '';
  setStatus({ state: 'off', message: undefined });
}

/** Renames me in the members list (the name on my future reports changes too). */
export async function updateMyName(who: Me): Promise<void> {
  if (!code) return;
  await setDoc(doc(memberCol(), who.id), clean({ id: who.id, name: who.name, updatedAt: new Date().toISOString() }), { merge: true });
}

async function refreshState(): Promise<void> {
  if (!code) return;
  const pending = (await getOutbox()).length;
  if (!navigator.onLine) setStatus({ state: 'offline', pending });
  else if (lastError && pending) setStatus({ state: 'error', pending, message: lastError });
  else if (!pending && !serverPending) setStatus({ state: 'synced', pending, message: undefined });
  else setStatus({ state: 'connecting', pending });
}

/** Uploads everything in the outbox (one run at a time). */
export function flush(): Promise<void> {
  if (flushing) { flushAgain = true; return flushing; }
  flushing = (async () => {
    do {
      flushAgain = false;
      lastError = '';
      if (!code || !navigator.onLine) break;
      for (const id of await getOutbox()) {
        try {
          await pushOne(id);
          await removeFromOutbox(id);
        } catch (err) {
          lastError = (err as Error).message;
          console.warn('sync: upload failed', id, err);
        }
      }
    } while (flushAgain);
  })().finally(() => { flushing = null; void refreshState(); });
  return flushing;
}

async function uploadPhoto(mediaId: string): Promise<RemotePhoto | null> {
  const m = await getMedia(mediaId);
  if (!m) return null;
  if (m.remoteFull && m.remoteThumb) return { id: m.id, full: m.remoteFull, thumb: m.remoteThumb };
  if (!m.blob || !m.thumb) return null;
  const base = `households/${code}/nature-media/${m.id}`;
  const meta = { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' };
  const fullRef = ref(firebaseStorage(), `${base}.jpg`);
  const thumbRef = ref(firebaseStorage(), `${base}-t.jpg`);
  await Promise.all([uploadBytes(fullRef, m.blob, meta), uploadBytes(thumbRef, m.thumb, meta)]);
  const [full, thumb] = await Promise.all([getDownloadURL(fullRef), getDownloadURL(thumbRef)]);
  await putMedia({ ...m, remoteFull: full, remoteThumb: thumb });
  return { id: m.id, full, thumb };
}

async function pushOne(id: string): Promise<void> {
  const o = await getObservationRaw(id);
  if (!o) return;
  const photos: RemotePhoto[] = [];
  for (const pid of o.photoIds) {
    const p = await uploadPhoto(pid);
    if (p) photos.push(p);
  }
  // Not awaited: with the offline cache the write is durable as soon as it's
  // queued, and the promise only settles once the server confirms.
  void setDoc(doc(obsCol(), id), clean({ ...o, photos }))
    .catch((err: Error) => { setStatus({ state: 'error', message: err.message }); void queueForSync([id]); });
}

async function mergeRemote(remote: RemoteObservation): Promise<void> {
  if (!remote?.id) return;
  const local = await getObservationRaw(remote.id);
  if (local && (local.updatedAt || '') >= (remote.updatedAt || '')) return;
  const { photos = [], ...obs } = remote;
  const keep = new Set(obs.photoIds ?? []);
  for (const m of await mediaForObservation(obs.id)) if (!keep.has(m.id)) await db.media.delete(m.id);
  if (!obs.deleted) {
    for (const p of photos) {
      const existing = await getMedia(p.id);
      await putMedia(existing
        ? { ...existing, obsId: obs.id, remoteFull: p.full, remoteThumb: p.thumb }
        : { id: p.id, obsId: obs.id, name: '', width: 0, height: 0, createdAt: obs.updatedAt, remoteFull: p.full, remoteThumb: p.thumb });
    }
  }
  await putObservationRaw({ ...obs, photoIds: obs.deleted ? [] : obs.photoIds ?? [] } as Observation);
}
