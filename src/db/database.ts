/* db/database.ts — typed IndexedDB schema via Dexie. */

import Dexie, { type EntityTable } from 'dexie';
import type { Observation, MediaRecord, SettingRow } from '../types';

export class NatureDatabase extends Dexie {
  observations!: EntityTable<Observation, 'id'>;
  media!: EntityTable<MediaRecord, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor() {
    super('nature-journal');
    this.version(1).stores({
      observations: 'id, dateTime, category, species, updatedAt',
      media: 'id, obsId',
      settings: 'key',
    });
  }
}

export const db = new NatureDatabase();
