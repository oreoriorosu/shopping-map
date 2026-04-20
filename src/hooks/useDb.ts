import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Spot, ShoppingItem, Genre } from '../types';

export function useMaps() {
  return useLiveQuery(async () => {
    const maps = await db.maps.toArray();
    return maps.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, []);
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
export async function addMap(name: string, blob: Blob, fileType: 'pdf' | 'image' = 'pdf') {
  const id = crypto.randomUUID();
  const count = await db.maps.count();
  await db.maps.add({ id, name, blob, fileType, createdAt: new Date(), order: count });
  return id;
}

export async function renameMap(id: string, name: string) {
  await db.maps.update(id, { name });
}

export async function reorderMaps(orderedIds: string[]) {
  await db.transaction('rw', db.maps, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.maps.update(orderedIds[i], { order: i });
    }
  });
}

export async function getSpotCountByMap(mapId: string) {
  return db.spots.where('mapId').equals(mapId).count();
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

export async function toggleSpotCheck(id: string, checked: boolean) {
  await db.spots.update(id, { checked });
}

export async function uncheckAll(mapId: string) {
  const spots = await db.spots.where('mapId').equals(mapId).toArray();
  const spotIds = spots.map((s) => s.id);
  await db.items.where('spotId').anyOf(spotIds).modify({ checked: false });
  await db.spots.where('mapId').equals(mapId).modify({ checked: false });
}

export async function uncheckAllItems() {
  await db.items.toCollection().modify({ checked: false });
  await db.spots.toCollection().modify({ checked: false });
}

export function useGenres() {
  return useLiveQuery(() => db.genres.toArray(), []);
}

export async function addGenre(name: string, color: string): Promise<Genre> {
  const genre: Genre = { id: crypto.randomUUID(), name, color };
  await db.genres.add(genre);
  return genre;
}

export async function deleteGenre(id: string) {
  await db.genres.delete(id);
}

export async function reorderSpots(orderedIds: string[]) {
  await db.transaction('rw', db.spots, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.spots.update(orderedIds[i], { visitOrder: i + 1 });
    }
  });
}
