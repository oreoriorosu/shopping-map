import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Spot, ShoppingItem } from '../types';

export function useMaps() {
  return useLiveQuery(() => db.maps.orderBy('createdAt').reverse().toArray(), []);
}

export function useSpots(mapId: string | null) {
  return useLiveQuery(
    () => (mapId ? db.spots.where('mapId').equals(mapId).toArray() : []),
    [mapId],
  );
}

export function useAllSpots() {
  return useLiveQuery(() => db.spots.toArray(), []);
}

export function useItems(spotId: string | null) {
  return useLiveQuery(
    () => (spotId ? db.items.where('spotId').equals(spotId).sortBy('order') : []),
    [spotId],
  );
}

export function useAllItemsByMap(mapId: string | null) {
  return useLiveQuery(async () => {
    if (!mapId) return {};
    const spots = await db.spots.where('mapId').equals(mapId).toArray();
    const spotIds = spots.map((s) => s.id);
    const items = await db.items.where('spotId').anyOf(spotIds).sortBy('order');
    const result: Record<string, ShoppingItem[]> = {};
    for (const spot of spots) result[spot.id] = [];
    for (const item of items) result[item.spotId]?.push(item);
    return result;
  }, [mapId]);
}

// CRUD
export async function addMap(name: string, blob: Blob) {
  const id = crypto.randomUUID();
  await db.maps.add({ id, name, blob, createdAt: new Date() });
  return id;
}

export async function deleteMap(id: string) {
  const spots = await db.spots.where('mapId').equals(id).toArray();
  const spotIds = spots.map((s) => s.id);
  await db.items.where('spotId').anyOf(spotIds).delete();
  await db.spots.where('mapId').equals(id).delete();
  await db.maps.delete(id);
}

export async function addSpot(data: Omit<Spot, 'id'>) {
  const id = crypto.randomUUID();
  await db.spots.add({ ...data, id });
  return id;
}

export async function updateSpot(id: string, data: Partial<Spot>) {
  await db.spots.update(id, data);
}

export async function deleteSpot(id: string) {
  await db.items.where('spotId').equals(id).delete();
  await db.spots.delete(id);
}

export async function addItem(spotId: string, name: string, price?: number) {
  const existing = await db.items.where('spotId').equals(spotId).count();
  const id = crypto.randomUUID();
  await db.items.add({ id, spotId, name, memo: '', checked: false, soldOut: false, price, order: existing });
  return id;
}

export async function updateItem(id: string, data: Partial<ShoppingItem>) {
  await db.items.update(id, data);
}

export async function deleteItem(id: string) {
  await db.items.delete(id);
}

export async function uncheckAll(mapId: string) {
  const spots = await db.spots.where('mapId').equals(mapId).toArray();
  const spotIds = spots.map((s) => s.id);
  await db.items.where('spotId').anyOf(spotIds).modify({ checked: false });
}

export async function uncheckAllItems() {
  await db.items.toCollection().modify({ checked: false });
}

export async function reorderSpots(orderedIds: string[]) {
  await db.transaction('rw', db.spots, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.spots.update(orderedIds[i], { visitOrder: i + 1 });
    }
  });
}
