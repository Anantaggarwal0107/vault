import Dexie, { type Table } from 'dexie';
import type { Item, Marker } from './types';

/** A favourite or gone mark that was taken off, so other devices can learn about it when syncing. */
export interface Removal {
  key: string;
  at: number;
}

class VaultDB extends Dexie {
  items!: Table<Item, string>;
  markers!: Table<Marker, string>;
  removed!: Table<Removal, string>;

  constructor() {
    super('vault');
    this.version(1).stores({
      items: 'key, source',
      markers: 'key',
    });
    this.version(2).stores({
      items: 'key, source',
      markers: 'key',
      removed: 'key',
    });
  }
}

export const db = new VaultDB();
