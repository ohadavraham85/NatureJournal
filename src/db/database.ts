/* db/database.ts — typed IndexedDB schema via Dexie. */

import Dexie, { type EntityTable } from 'dexie';
import type { Observation, MediaRecord, SettingRow, Taxon } from '../types';

export class NatureDatabase extends Dexie {
  observations!: EntityTable<Observation, 'id'>;
  media!: EntityTable<MediaRecord, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  taxa!: EntityTable<Taxon, 'id'>;

  constructor() {
    super('nature-journal');
    this.version(1).stores({
      observations: 'id, dateTime, category, species, updatedAt',
      media: 'id, obsId',
      settings: 'key',
    });
    // v2: species catalog downloaded from iNaturalist (see lib/catalog.ts).
    this.version(2).stores({
      observations: 'id, dateTime, category, species, updatedAt',
      media: 'id, obsId',
      settings: 'key',
      taxa: 'id, category',
    });
  }
}

export const db = new NatureDatabase();
