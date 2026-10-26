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
  /** The species seen — one observation (place + time) can hold several. */
  entries: SpeciesEntry[];
  /** General note (older reports; new notes are per species). */
  note: string;
  /** All media ids (photos and video clips) — every species' media, plus any
   * general ones from before per-species media; the first is the cover. */
  photoIds: string[];
  /** Which of photoIds are video clips. */
  videoIds?: string[];
  createdAt: string;
  updatedAt: string;
  /** Who reported it, in a shared journal (see sync/). Absent = this device's owner. */
  reporterId?: string;
  reporterName?: string;
  /** Tombstone: deleted reports stay as a marker so the deletion syncs to other devices. */
  deleted?: boolean;
}

/** One species within an observation. */
export interface SpeciesEntry {
  id: string;
  category: CategoryId;
  species: string;
  /** Scientific name, when the species was picked from the species catalog. */
  sci?: string;
  /** iNaturalist taxon id, when picked from the species catalog. */
  taxonId?: number;
  quantity: number;
  uncertain: boolean;
  /** A note about this species. */
  note?: string;
  /** This species' photos/clips (ids also listed, in order, in the observation's photoIds). */
  mediaIds?: string[];
}

/** Someone reporting into a shared journal. */
export interface Member {
  id: string;
  name: string;
  joinedAt: string;
  updatedAt: string;
  /** Journal admin — may edit and delete everyone's observations. */
  admin?: boolean;
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
  /** 'video' for a clip (blob = the clip as recorded, thumb = a still frame). */
  kind?: 'photo' | 'video';
  mime?: string;
  /** Clip length in seconds. */
  duration?: number;
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
