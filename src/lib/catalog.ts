/* lib/catalog.ts — the species catalog: for every category, the species
 * observed in Israel on iNaturalist, with Hebrew names where they exist.
 * Downloaded by the app itself (the iNaturalist API allows browser requests)
 * and kept in IndexedDB, so search and autocomplete work with no reception. */

import { db } from '../db/database';
import { CATEGORIES, type CategoryId } from '../data/categories';
import { CATALOG_MAX_AGE_DAYS, CATALOG_QUERIES, ISRAEL_BOUNDS, MAX_SPECIES_PER_CATEGORY } from '../data/catalog-sources';
import type { Taxon } from '../types';
import { bestScore } from './fuzzy';

const API = 'https://api.inaturalist.org/v1/observations/species_counts';
const PER_PAGE = 500;
const META_KEY = 'catalogMeta';

export interface CatalogMeta {
  /** ISO time each category was last downloaded. */
  updated: Partial<Record<CategoryId, string>>;
}

interface INatTaxon {
  id: number;
  name: string;
  rank: string;
  preferred_common_name?: string;
  english_common_name?: string;
  wikipedia_url?: string | null;
  default_photo?: { square_url?: string; medium_url?: string } | null;
}

interface INatResponse {
  total_results: number;
  results: Array<{ count: number; taxon: INatTaxon }>;
}

const HEBREW = /[֐-׿]/;

export async function getCatalogMeta(): Promise<CatalogMeta> {
  const row = await db.settings.get(META_KEY);
  return (row?.value as CatalogMeta | undefined) ?? { updated: {} };
}

async function setUpdated(cat: CategoryId): Promise<void> {
  const meta = await getCatalogMeta();
  meta.updated[cat] = new Date().toISOString();
  await db.settings.put({ key: META_KEY, value: meta });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function toTaxon(cat: CategoryId, count: number, t: INatTaxon): Taxon {
  const common = t.preferred_common_name?.trim() ?? '';
  return {
    id: t.id,
    category: cat,
    he: HEBREW.test(common) ? common : '',
    en: t.english_common_name?.trim() || (common && !HEBREW.test(common) ? common : ''),
    sci: t.name,
    count,
    photo: t.default_photo?.square_url ?? '',
    photoMedium: t.default_photo?.medium_url ?? '',
    wiki: t.wikipedia_url ?? '',
  };
}

/** Downloads one category's list, replacing what was stored for it. */
export async function downloadCategory(cat: CategoryId, onPage?: (loaded: number) => void): Promise<number> {
  const taxa: Taxon[] = [];
  for (let page = 1; taxa.length < MAX_SPECIES_PER_CATEGORY; page++) {
    const params = new URLSearchParams({
      ...CATALOG_QUERIES[cat], ...ISRAEL_BOUNDS,
      quality_grade: 'research', locale: 'he',
      per_page: String(PER_PAGE), page: String(page),
    });
    const res = await fetch(`${API}?${params}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`iNaturalist ${res.status}`);
    const data = (await res.json()) as INatResponse;
    for (const r of data.results) {
      if (r.taxon?.rank === 'species') taxa.push(toTaxon(cat, r.count, r.taxon));
    }
    onPage?.(taxa.length);
    if (data.results.length < PER_PAGE || page * PER_PAGE >= data.total_results) break;
    await sleep(1100); // iNaturalist asks for at most ~1 request per second
  }
  await db.transaction('rw', db.taxa, async () => {
    await db.taxa.where('category').equals(cat).delete();
    await db.taxa.bulkPut(taxa);
  });
  await setUpdated(cat);
  return taxa.length;
}

export type CatalogProgress = (cat: CategoryId, state: 'loading' | 'done' | 'error', count: number) => void;

let running: Promise<void> | null = null;

/** Downloads the given categories one after another (all, by default). */
export function downloadCatalog(cats: CategoryId[] = CATEGORIES.map((c) => c.id), onProgress?: CatalogProgress): Promise<void> {
  if (running) return running;
  running = (async () => {
    for (const cat of cats) {
      onProgress?.(cat, 'loading', 0);
      try {
        const n = await downloadCategory(cat, (loaded) => onProgress?.(cat, 'loading', loaded));
        onProgress?.(cat, 'done', n);
      } catch {
        onProgress?.(cat, 'error', 0);
      }
    }
    catalogListeners.forEach((fn) => fn());
  })().finally(() => { running = null; });
  return running;
}

export function isCatalogDownloading(): boolean {
  return running !== null;
}

const catalogListeners = new Set<() => void>();
export function onCatalogUpdated(fn: () => void): void {
  catalogListeners.add(fn);
}

/** At startup: quietly fetch categories never downloaded or gone stale. */
export async function refreshCatalogIfNeeded(): Promise<void> {
  if (!navigator.onLine) return;
  const meta = await getCatalogMeta();
  const maxAge = CATALOG_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const stale = CATEGORIES.map((c) => c.id).filter((id) => {
    const t = meta.updated[id];
    return !t || Date.now() - new Date(t).getTime() > maxAge;
  });
  if (stale.length) await downloadCatalog(stale);
}

export async function catalogCounts(): Promise<Map<CategoryId, number>> {
  const counts = new Map<CategoryId, number>();
  await db.taxa.each((t) => counts.set(t.category, (counts.get(t.category) ?? 0) + 1));
  return counts;
}

export function taxaInCategory(cat: CategoryId): Promise<Taxon[]> {
  return db.taxa.where('category').equals(cat).toArray();
}

export function allTaxa(): Promise<Taxon[]> {
  return db.taxa.toArray();
}

export function getTaxon(id: number): Promise<Taxon | undefined> {
  return db.taxa.get(id);
}

/** The name shown for a catalog species: Hebrew, else English, else scientific. */
export function taxonName(t: Taxon): string {
  return t.he || t.en || t.sci;
}

/** Ranks catalog species against a typed query with forgiving spelling
 * (see fuzzy.ts); ties — and the unfiltered list — in alphabetical order. */
export function searchTaxa(taxa: Taxon[], query: string, limit: number): Taxon[] {
  if (!query.trim()) return [...taxa].sort(byName).slice(0, limit);
  const scored: Array<[number, Taxon]> = [];
  for (const t of taxa) {
    const s = bestScore(query, [t.he, t.en, t.sci]);
    if (s !== null) scored.push([s, t]);
  }
  return scored.sort((a, b) => a[0] - b[0] || byName(a[1], b[1])).slice(0, limit).map(([, t]) => t);
}

const collator = new Intl.Collator('he');
/** Alphabetical (Hebrew א–ת first, then names that only have a Latin name). */
export function byName(a: Taxon, b: Taxon): number {
  const ah = !!a.he, bh = !!b.he;
  if (ah !== bh) return ah ? -1 : 1;
  return collator.compare(taxonName(a), taxonName(b));
}

/** Exact Hebrew/English/scientific name match within a category — links a
 * typed name to its catalog entry on save. */
export async function findTaxonByName(cat: CategoryId, name: string): Promise<Taxon | undefined> {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return (await taxaInCategory(cat)).find((t) => t.he === name.trim() || t.en.toLowerCase() === n || t.sci.toLowerCase() === n);
}
