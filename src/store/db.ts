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

db.version(2).stores({
  maps: 'id, name, createdAt',
  spots: 'id, mapId, name',
  items: 'id, spotId, checked, order',
}).upgrade(tx =>
  tx.table('items').toCollection().modify((item: ShoppingItem) => {
    if (item.soldOut === undefined) item.soldOut = false;
  })
);

db.version(3).stores({
  maps: 'id, name, createdAt',
  spots: 'id, mapId, name',
  items: 'id, spotId, checked, order',
});

export { db };
