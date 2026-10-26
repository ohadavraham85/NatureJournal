/* data/catalog-sources.ts — which iNaturalist taxa make up each category's
 * species catalog. Queries are limited to research-grade observations inside
 * Israel's bounding box, so the lists hold species actually seen here. */

import type { CategoryId } from './categories';

/** Papilionoidea (butterflies) — split out of the insects. */
const BUTTERFLIES_TAXON = '47224';

export const CATALOG_QUERIES: Record<CategoryId, Record<string, string>> = {
  mammals: { iconic_taxa: 'Mammalia' },
  butterflies: { taxon_id: BUTTERFLIES_TAXON },
  plants: { iconic_taxa: 'Plantae' },
  reptiles: { iconic_taxa: 'Reptilia,Amphibia' },
  insects: { iconic_taxa: 'Insecta', without_taxon_id: BUTTERFLIES_TAXON },
  fungi: { iconic_taxa: 'Fungi' },
  other: { iconic_taxa: 'Arachnida,Mollusca' },
};

/** Israel (incl. the Golan and Eilat) — slightly generous at the edges. */
export const ISRAEL_BOUNDS = { swlat: '29.45', swlng: '34.20', nelat: '33.40', nelng: '35.95' };

/** Caps a category at this many species (most observed first). */
export const MAX_SPECIES_PER_CATEGORY = 3000;

/** The catalog refreshes itself in the background after this long. */
export const CATALOG_MAX_AGE_DAYS = 60;
