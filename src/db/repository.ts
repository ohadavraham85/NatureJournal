/* db/repository.ts — every read/write of observations and photos goes
 * through here, so views can subscribe to a single "data changed" signal. */

import { db } from './database';
import type { Observation, MediaRecord } from '../types';

type Listener = () => void;
const listeners = new Set<Listener>();

export function onDataChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** For bulk writes made outside this module (e.g. restoring a backup). */
export function notifyDataChanged(): void {
  emit();
}

function emit(): void {
  for (const fn of listeners) fn();
}

export function newId(): string {
  return crypto.randomUUID();
}

/* ---------- observations ---------- */

/** Newest sighting first. */
export async function listObservations(): Promise<Observation[]> {
  return (await db.observations.toArray()).sort((a, b) => (a.dateTime < b.dateTime ? 1 : a.dateTime > b.dateTime ? -1 : 0));
}

export function getObservation(id: string): Promise<Observation | undefined> {
  return db.observations.get(id);
}

/** Saves the report and claims its photos (setting their obsId), dropping
 * any photo that was attached to it before but removed in this edit. */
export async function saveObservation(obs: Observation): Promise<void> {
  await db.transaction('rw', db.observations, db.media, async () => {
    const previous = await db.media.where('obsId').equals(obs.id).primaryKeys();
    const keep = new Set(obs.photoIds);
    await db.media.bulkDelete(previous.filter((id) => !keep.has(id)));
    for (const id of obs.photoIds) await db.media.update(id, { obsId: obs.id });
    await db.observations.put({ ...obs, updatedAt: new Date().toISOString() });
  });
  emit();
}

export async function deleteObservation(id: string): Promise<void> {
  await db.transaction('rw', db.observations, db.media, async () => {
    await db.media.where('obsId').equals(id).delete();
    await db.observations.delete(id);
  });
  emit();
}

/** Distinct species names used so far, most frequently reported first —
 * feeds the species autocomplete. Optionally narrowed to one category. */
export async function speciesSuggestions(categoryId?: string): Promise<string[]> {
  const counts = new Map<string, number>();
  for (const o of await db.observations.toArray()) {
    if (categoryId && o.category !== categoryId) continue;
    const name = o.species.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he')).map(([n]) => n);
}

/** Distinct place names used so far, most recent first. */
export async function placeSuggestions(): Promise<string[]> {
  const seen = new Set<string>();
  for (const o of await listObservations()) {
    const p = o.place.trim();
    if (p) seen.add(p);
  }
  return [...seen];
}

/* ---------- media ---------- */

export async function addMedia(rec: MediaRecord): Promise<void> {
  await db.media.put(rec);
}

export function getMedia(id: string): Promise<MediaRecord | undefined> {
  return db.media.get(id);
}

/** Photos attached in a form that was then abandoned never get an obsId —
 * clear them out at startup so they don't pile up in storage. */
export async function purgeOrphanMedia(): Promise<void> {
  await db.media.where('obsId').equals('').delete();
}

/** Discards photos added in a form session that's being cancelled. */
export async function deleteUnclaimedMedia(ids: string[]): Promise<void> {
  const rows = await db.media.bulkGet(ids);
  await db.media.bulkDelete(rows.filter((m): m is MediaRecord => !!m && !m.obsId).map((m) => m.id));
}
