import Dexie, { type EntityTable } from 'dexie';
import type { MapFile, Spot, ShoppingItem } from '../types';

const db = new Dexie('ShoppingMapDB') as Dexie & {
  maps: EntityTable<MapFile, 'id'>;
  spots: EntityTable<Spot, 'id'>;
  items: EntityTable<ShoppingItem, 'id'>;
};

db.version(1).stores({
  maps: 'id, name, createdAt',
  spots: 'id, mapId, name',
  items: 'id, spotId, checked, order',
});

export { db };
