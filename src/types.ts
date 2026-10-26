/* types.ts — the app's data model. */

import type { CategoryId } from './data/categories';

/** Where a report's date/time came from — shown next to it in the form. */
export type DateSource = 'exif' | 'file' | 'now' | 'manual';
/** Where a report's coordinates came from. */
export type LocationSource = 'exif' | 'gps' | 'manual' | 'none';

export interface Observation {
  id: string;
  /** ISO timestamp of the sighting itself. */
  dateTime: string;
  dateSource: DateSource;
  lat: number | null;
  lng: number | null;
  /** GPS accuracy in meters, when the location came from the device. */
  accuracy: number | null;
  locationSource: LocationSource;
  /** Free-text place name ("נחל עמוד"), filled from reverse geocoding when online. */
  place: string;
  category: CategoryId;
  species: string;
  /** Scientific name, when the species was picked from the species catalog. */
  sci?: string;
  /** iNaturalist taxon id, when picked from the species catalog. */
  taxonId?: number;
  quantity: number;
  uncertain: boolean;
  note: string;
  /** Media ids, in display order — the first is the cover photo. */
  photoIds: string[];
  createdAt: string;
  updatedAt: string;
  /** Who reported it, in a shared journal (see sync/). Absent = this device's owner. */
  reporterId?: string;
  reporterName?: string;
  /** Tombstone: deleted reports stay as a marker so the deletion syncs to other devices. */
  deleted?: boolean;
}

/** Someone reporting into a shared journal. */
export interface Member {
  id: string;
  name: string;
  joinedAt: string;
  updatedAt: string;
}

export interface MediaRecord {
  id: string;
  /** '' while the photo is attached to a report that hasn't been saved yet. */
  obsId: string;
  /** Downscaled photo (long side ≤ PHOTO_MAX_PX) kept for full-screen viewing.
   * Absent for photos synced from another device (shown from `remoteFull`). */
  blob?: Blob;
  /** Small preview for grids. */
  thumb?: Blob;
  /** Cloud copies (Firebase Storage download URLs), once uploaded or synced. */
  remoteFull?: string;
  remoteThumb?: string;
  name: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

/** One species from the downloaded catalog (iNaturalist observations in Israel). */
export interface Taxon {
  /** iNaturalist taxon id. */
  id: number;
  category: CategoryId;
  /** Hebrew common name — '' when iNaturalist has none. */
  he: string;
  /** English common name, when known. */
  en: string;
  sci: string;
  /** How many research-grade observations it has in Israel — a rough "how common". */
  count: number;
  photo: string;
  photoMedium: string;
  wiki: string;
}
