/* lib/backup.ts — Settings ← ייצוא / גיבוי: a readable CSV table of all
 * reports, and a full backup file (reports + photos) that restores the
 * journal on any device. Files are saved to the device or handed to the
 * phone's share sheet (Drive, WhatsApp, email...). */

import { db } from '../db/database';
import { category } from '../data/categories';
import type { MediaRecord, Observation } from '../types';
import { getSyncCode, loadEngine, queueForSync } from '../sync/state';

const BACKUP_APP = 'nature-journal';
const BACKUP_FORMAT = 1;
const LAST_BACKUP_KEY = 'nj-last-backup';

function csvField(v: unknown): string {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

/** BOM first, so Excel opens the Hebrew correctly. */
function toCsv(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(csvField).join(',')).join('\r\n');
}

const today = (): string => new Date().toISOString().slice(0, 10);

function localDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function buildCsv(): Promise<File> {
  const obs = (await db.observations.filter((o) => !o.deleted).toArray()).sort((a, b) => (a.dateTime < b.dateTime ? -1 : 1));
  const rows: unknown[][] = [[
    'תאריך ושעה', 'קטגוריה', 'מין', 'שם מדעי', 'כמות', 'לא בטוח בזיהוי', 'מקום', 'קו רוחב', 'קו אורך', 'הערה', 'תמונות',
  ]];
  for (const o of obs) {
    rows.push([
      localDateTime(o.dateTime), category(o.category).label, o.species, o.sci ?? '', o.quantity,
      o.uncertain ? 'כן' : '', o.place, o.lat?.toFixed(6) ?? '', o.lng?.toFixed(6) ?? '', o.note, o.photoIds.length,
    ]);
  }
  return new File([toCsv(rows)], `יומן-טבע-${today()}.csv`, { type: 'text/csv;charset=utf-8' });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

export interface BackupInfo { file: File; observations: number; photos: number }

/** Built from many Blob parts rather than one giant string, so a large photo
 * collection doesn't exhaust the phone's memory. */
export async function buildBackup(): Promise<BackupInfo> {
  const observations = await db.observations.filter((o) => !o.deleted).toArray();
  const head = JSON.stringify({ app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), observations });
  const parts: BlobPart[] = [head.slice(0, -1), ',"media":['];
  let photos = 0;
  await db.media.where('obsId').notEqual('').each(() => { photos++; });
  let written = 0;
  for (const m of await db.media.where('obsId').notEqual('').toArray()) {
    const { blob, thumb, ...meta } = m;
    parts.push((written++ ? ',' : '') + JSON.stringify({
      ...meta,
      // A photo synced from another device may exist only in the cloud — its links are kept instead.
      blob: blob ? await blobToDataUrl(blob) : '',
      thumb: thumb ? await blobToDataUrl(thumb) : '',
    }));
  }
  parts.push(']}');
  try { localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString()); } catch { /* storage blocked */ }
  return {
    file: new File(parts, `גיבוי-יומן-טבע-${today()}.json`, { type: 'application/json' }),
    observations: observations.length,
    photos,
  };
}

export function lastBackupTime(): string | null {
  try { return localStorage.getItem(LAST_BACKUP_KEY); } catch { return null; }
}

interface BackupFile {
  app: string;
  format: number;
  exportedAt: string;
  observations: Observation[];
  media: Array<Omit<MediaRecord, 'blob' | 'thumb'> & { blob: string; thumb: string }>;
}

export interface ParsedBackup { data: BackupFile; observations: number; photos: number; exportedAt: string }

export async function readBackup(file: File): Promise<ParsedBackup> {
  let data: BackupFile;
  try {
    data = JSON.parse(await file.text()) as BackupFile;
  } catch {
    throw new Error('הקובץ אינו קובץ גיבוי תקין');
  }
  if (data?.app !== BACKUP_APP || !Array.isArray(data.observations)) throw new Error('זה לא קובץ גיבוי של יומן טבע');
  return { data, observations: data.observations.length, photos: data.media?.length ?? 0, exportedAt: data.exportedAt };
}

/** Merges a backup into this device: reports missing here are added, and a
 * report present in both keeps whichever copy was edited last. Nothing on
 * the device is deleted. Returns how many reports were added or updated. */
export async function restoreBackup({ data }: ParsedBackup): Promise<number> {
  const existing = new Map((await db.observations.toArray()).map((o) => [o.id, o]));
  const incoming = data.observations.filter((o) => {
    const cur = existing.get(o.id);
    return !cur || (o.updatedAt || '') > (cur.updatedAt || '');
  });
  const wanted = new Set(incoming.flatMap((o) => o.photoIds));
  const media: MediaRecord[] = [];
  for (const m of data.media ?? []) {
    if (!wanted.has(m.id)) continue;
    const [blob, thumb] = await Promise.all([
      m.blob ? fetch(m.blob).then((r) => r.blob()) : undefined,
      m.thumb ? fetch(m.thumb).then((r) => r.blob()) : undefined,
    ]);
    media.push({ ...m, blob, thumb });
  }
  await db.transaction('rw', db.observations, db.media, async () => {
    await db.media.bulkPut(media);
    await db.observations.bulkPut(incoming);
  });
  // In a shared journal, restored reports go up to the cloud too.
  if (await getSyncCode()) {
    await queueForSync(incoming.map((o) => o.id));
    void loadEngine().then((e) => e.flush());
  }
  return incoming.length;
}

/** Saves a file to the device (browser download). */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function canShareFile(file: File): boolean {
  return !!navigator.canShare?.({ files: [file] });
}

/** Opens the phone's share sheet. Resolves false if the user cancelled. */
export async function shareFile(file: File, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title });
    return true;
  } catch {
    return false;
  }
}
