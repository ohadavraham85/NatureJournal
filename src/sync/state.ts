/* sync/state.ts — the light, always-loaded side of syncing: who "I" am,
 * the shared-journal code, the outbox of reports waiting to upload, the
 * members list and the live status. The Firebase engine (sync/engine.ts)
 * is loaded on demand only once a shared journal is set up, so the app
 * stays small for anyone who never syncs. */

import { getSetting, setSetting } from '../db/repository';
import type { Member, Observation } from '../types';

export interface Me { id: string; name: string }

const ME_KEY = 'me';
const CODE_KEY = 'syncCode';
const OUTBOX_KEY = 'syncOutbox';
const MEMBERS_KEY = 'syncMembers';

/* ---------- me ---------- */

let meCache: Me | null = null;

/** This person's identity — created on first use; the name is set in Settings. */
export async function getMe(): Promise<Me> {
  if (meCache) return meCache;
  let me = await getSetting<Me | null>(ME_KEY, null);
  if (!me) {
    me = { id: crypto.randomUUID(), name: '' };
    await setSetting(ME_KEY, me);
  }
  meCache = me;
  return me;
}

export async function setMe(me: Me): Promise<void> {
  meCache = me;
  await setSetting(ME_KEY, me);
}

/** Reports by someone else in a shared journal are read-only here. */
export function canEdit(o: Observation, me: Me): boolean {
  return !o.reporterId || o.reporterId === me.id;
}

/* ---------- code ---------- */

export function getSyncCode(): Promise<string> {
  return getSetting<string>(CODE_KEY, '');
}

export async function setSyncCode(code: string): Promise<void> {
  await setSetting(CODE_KEY, code);
}

/** Long and random — the code is the key to the shared journal. */
export function newJournalCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return 'nj-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** Accepts a bare code or a whole invite link (…?join=nj-…). */
export function parseJoinInput(raw: string): string {
  const s = raw.trim();
  const fromLink = /[?&]join=([a-z0-9-]+)/i.exec(s);
  const code = (fromLink ? fromLink[1]! : s).toLowerCase();
  return /^nj-[a-z0-9]{8,}$/.test(code) ? code : '';
}

export function inviteLink(code: string): string {
  return `${location.origin}${location.pathname}?join=${code}`;
}

/* ---------- outbox ---------- */

export async function getOutbox(): Promise<string[]> {
  return getSetting<string[]>(OUTBOX_KEY, []);
}

export async function queueForSync(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const box = new Set(await getOutbox());
  ids.forEach((id) => box.add(id));
  await setSetting(OUTBOX_KEY, [...box]);
  setStatus({ pending: box.size });
}

export async function removeFromOutbox(id: string): Promise<void> {
  const box = (await getOutbox()).filter((x) => x !== id);
  await setSetting(OUTBOX_KEY, box);
  setStatus({ pending: box.length });
}

/* ---------- members ---------- */

let members: Member[] = [];
const memberListeners = new Set<(m: Member[]) => void>();

export async function loadCachedMembers(): Promise<void> {
  members = await getSetting<Member[]>(MEMBERS_KEY, []);
}

export function getMembers(): Member[] {
  return members;
}

/** The reporter's current name (members list first, so a rename shows everywhere). */
export function reporterName(o: Observation): string {
  if (!o.reporterId) return o.reporterName ?? '';
  return members.find((m) => m.id === o.reporterId)?.name || o.reporterName || '';
}

export async function setMembers(list: Member[]): Promise<void> {
  members = [...list].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  await setSetting(MEMBERS_KEY, members);
  memberListeners.forEach((fn) => fn(members));
}

export function onMembers(fn: (m: Member[]) => void): () => void {
  memberListeners.add(fn);
  return () => memberListeners.delete(fn);
}

/* ---------- status ---------- */

export type SyncState = 'off' | 'connecting' | 'synced' | 'offline' | 'error';
export interface SyncStatus { state: SyncState; pending: number; message?: string }

let status: SyncStatus = { state: 'off', pending: 0 };
const statusListeners = new Set<(s: SyncStatus) => void>();

export function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  statusListeners.forEach((fn) => fn(status));
}

export function getStatus(): SyncStatus {
  return status;
}

export function onStatus(fn: (s: SyncStatus) => void): () => void {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}

/* ---------- engine (lazy) ---------- */

type Engine = typeof import('./engine');
let enginePromise: Promise<Engine> | null = null;

export function loadEngine(): Promise<Engine> {
  enginePromise ??= import('./engine');
  return enginePromise;
}

/** At startup: resume syncing if this device is part of a shared journal. */
export async function resumeSync(): Promise<void> {
  await loadCachedMembers();
  const code = await getSyncCode();
  if (!code) return;
  setStatus({ state: 'connecting', pending: (await getOutbox()).length });
  const engine = await loadEngine();
  await engine.start(code, await getMe());
}
