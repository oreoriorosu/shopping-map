import Dexie, { type EntityTable } from 'dexie';
import type { MapFile, Spot, ShoppingItem, Genre } from '../types';

const db = new Dexie('ShoppingMapDB') as Dexie & {
  maps: EntityTable<MapFile, 'id'>;
  spots: EntityTable<Spot, 'id'>;
  items: EntityTable<ShoppingItem, 'id'>;
  genres: EntityTable<Genre, 'id'>;
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

db.version(4).stores({
  maps: 'id, name, createdAt, order',
  spots: 'id, mapId, name',
  items: 'id, spotId, checked, order',
}).upgrade(async tx => {
  const maps = await tx.table('maps').orderBy('createdAt').reverse().toArray();
  for (let i = 0; i < maps.length; i++) {
    await tx.table('maps').update(maps[i].id, { order: i });
  }
});

db.version(5).stores({
  maps: 'id, name, createdAt, order',
  spots: 'id, mapId, name, genreId',
  items: 'id, spotId, checked, order',
  genres: 'id, name',
}).upgrade(tx =>
  // colorフィールドは削除（参照しないだけでOK、Dexieは余分なフィールドを無視する）
  tx.table('spots').toCollection().modify((spot: Spot & { color?: string; genre?: string }) => {
    delete spot.color;
    delete spot.genre;
  })
);

export { db };
