/* lib/observation.ts — helpers for an observation's species list, and
 * conversion of the older one-species-per-report shape (reports saved
 * before multi-species, backups, and docs synced from devices still on an
 * older version). */

import { category } from '../data/categories';
import type { CategoryId } from '../data/categories';
import type { Observation, SpeciesEntry } from '../types';

/** The pre-multi-species fields, still found in old data. */
interface LegacyFields {
  category?: CategoryId;
  species?: string;
  sci?: string;
  taxonId?: number;
  quantity?: number;
  uncertain?: boolean;
}

export function newEntry(cat: CategoryId | '' = ''): SpeciesEntry {
  return { id: crypto.randomUUID(), category: cat as CategoryId, species: '', quantity: 1, uncertain: false };
}

/** Accepts either shape; always returns one with `entries`. */
export function normalizeObservation(raw: Observation & LegacyFields): Observation {
  if (Array.isArray(raw.entries) && raw.entries.length) {
    const { category: _c, species: _s, sci: _sc, taxonId: _t, quantity: _q, uncertain: _u, ...rest } = raw;
    return rest as Observation;
  }
  const { category: cat, species, sci, taxonId, quantity, uncertain, ...rest } = raw;
  const entry: SpeciesEntry = {
    id: `${raw.id}-1`,
    category: cat ?? 'other',
    species: species ?? '',
    quantity: quantity ?? 1,
    uncertain: !!uncertain,
  };
  if (sci) entry.sci = sci;
  if (taxonId) entry.taxonId = taxonId;
  return { ...(rest as Observation), entries: raw.deleted ? [] : [entry] };
}

export function entryName(e: SpeciesEntry): string {
  return e.species.trim() || `${category(e.category).label} — לא מזוהה`;
}

/** "שועל מצוי", "שועל מצוי, צבי", or "שועל מצוי, צבי ועוד 3". */
export function obsTitle(o: Observation): string {
  const names = o.entries.map(entryName);
  if (names.length <= 2) return names.join(', ') || 'תצפית';
  return `${names.slice(0, 2).join(', ')} ועוד ${names.length - 2}`;
}

/** Distinct categories, in entry order. */
export function obsCategories(o: Observation): CategoryId[] {
  return [...new Set(o.entries.map((e) => e.category))];
}

export function primaryCategory(o: Observation): CategoryId {
  return o.entries[0]?.category ?? 'other';
}
