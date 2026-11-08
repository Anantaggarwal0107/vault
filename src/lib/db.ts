import Dexie, { type Table } from 'dexie';
import type { Item, Marker } from './types';

class VaultDB extends Dexie {
  items!: Table<Item, string>;
  markers!: Table<Marker, string>;

  constructor() {
    super('vault');
    this.version(1).stores({
      items: 'key, source',
      markers: 'key',
    });
  }
}

export const db = new VaultDB();
