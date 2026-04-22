import { useState } from 'react';
import { MapPin, Filter, ArrowUpDown } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { db } from '../store/db';
import { reorderSpots, toggleSpotCheck } from '../hooks/useDb';
import { SortableSpotSection } from './SpotSection';
import type { MapFile, Spot, ShoppingItem } from '../types';

interface Props {
  maps: MapFile[];
  spots: Spot[];
  selectedSpotId: string | null;
  onSelectSpot: (id: string | null) => void;
  onNavigateToPin: (id: string) => void;
  scrollRefMap: Record<string, () => void>;
  filterPriorities?: Set<string>;
  filterTags?: Set<string>;
  hideDone?: boolean;
  filterActiveCount?: number;
  onOpenFilter?: () => void;
}

const PRIORITY_RANK: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };

function sortByVisitOrder(spots: Spot[]): Spot[] {
  return [...spots].sort((a, b) => {
    if (a.visitOrder == null && b.visitOrder == null) return 0;
    if (a.visitOrder == null) return 1;
    if (b.visitOrder == null) return -1;
    return a.visitOrder - b.visitOrder;
  });
}

export function ShoppingPanel({ maps, spots, selectedSpotId, onSelectSpot, onNavigateToPin, scrollRefMap, filterPriorities, filterTags, hideDone, filterActiveCount, onOpenFilter }: Props) {
  const [reorderMode, setReorderMode] = useState(false);

  const allItems = useLiveQuery(async () => {
    const spotIds = spots.map(s => s.id);
    if (!spotIds.length) return {} as Record<string, ShoppingItem[]>;
    const items = await db.items.where('spotId').anyOf(spotIds).sortBy('order');
    const result: Record<string, ShoppingItem[]> = {};
    for (const s of spots) result[s.id] = [];
    for (const item of items) result[item.spotId]?.push(item);
    return result;
  }, [spots]);

  const allFlat = Object.values(allItems ?? {}).flat() as ShoppingItem[];
  const spotsWithNoItems = spots.filter(s => (allItems?.[s.id]?.length ?? 0) === 0);
  const totalCount = allFlat.length + spotsWithNoItems.length;
  const checkedCount = allFlat.filter(i => i.checked).length + spotsWithNoItems.filter(s => s.checked).length;
  const soldOutCount = allFlat.filter(i => i.soldOut && !i.checked).length;
  const totalPrice = allFlat.reduce((s, i) => s + (i.price ?? 0), 0);
  const checkedPrice = allFlat.filter(i => i.checked).reduce((s, i) => s + (i.price ?? 0), 0);
  const hasPrices = allFlat.some(i => i.price !== undefined);

  const filteredSpots = spots.filter(s => {
    if (hideDone) {
      const items = allItems?.[s.id] ?? [];
      const done = items.length === 0
        ? (s.checked ?? false)
        : items.every(i => i.checked || i.soldOut);
      if (done) return false;
    }
    if ((filterPriorities?.size ?? 0) > 0 && (s.priority == null || !filterPriorities!.has(s.priority))) return false;
    if ((filterTags?.size ?? 0) > 0 && ![...filterTags!].every(t => (s.tags ?? []).includes(t))) return false;
    return true;
  });

  const spotsByMap = maps
    .map(m => ({
      map: m,
      spots: sortByVisitOrder(filteredSpots.filter(s => s.mapId === m.id)),
    }))
    .filter(g => g.spots.length > 0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleSortByName = async () => {
    for (const { spots: mapSpots } of spotsByMap) {
      const sorted = [...mapSpots].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      await reorderSpots(sorted.map(s => s.id));
    }
  };

  const handleSortByPriority = async () => {
    for (const { spots: mapSpots } of spotsByMap) {
      const sorted = [...mapSpots].sort((a, b) => {
        const ra = a.priority ? PRIORITY_RANK[a.priority] : 5;
        const rb = b.priority ? PRIORITY_RANK[b.priority] : 5;
        return ra - rb;
      });
      await reorderSpots(sorted.map(s => s.id));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    for (const { spots: mapSpots } of spotsByMap) {
      const oldIdx = mapSpots.findIndex(s => s.id === active.id);
      const newIdx = mapSpots.findIndex(s => s.id === over.id);
      if (oldIdx === -1 || newIdx === -1) continue;
      const reordered = arrayMove(mapSpots, oldIdx, newIdx);
      await reorderSpots(reordered.map(s => s.id));
      break;
    }
  };

  return (
    <div className="pb-4 bg-gray-100 min-h-full">
      {/* 進捗ヘッダー */}
      {totalCount > 0 && (
        <div className="sticky top-0 bg-gray-100 border-b border-gray-200 px-4 py-2 z-10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-body text-gray-600">
              {checkedCount}/{totalCount} 購入済み
              {soldOutCount > 0 && <span className="ml-2 text-red-400 text-label">{soldOutCount} 売切</span>}
            </span>
            {hasPrices && (
              <span className="text-body font-medium text-gray-700">
                ¥{checkedPrice.toLocaleString()}
                <span className="text-label text-gray-400 font-normal"> / ¥{totalPrice.toLocaleString()}</span>
              </span>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onOpenFilter?.()}
                className={`relative p-2.5 rounded-full transition-colors ${
                  (filterActiveCount ?? 0) > 0 ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-orange-500'
                }`}
                aria-label="フィルター"
              >
                <Filter size={18} />
                {(filterActiveCount ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold leading-none">
                    {filterActiveCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setReorderMode(v => !v)}
                className={`p-2.5 rounded-full transition-colors ${
                  reorderMode ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-blue-500'
                }`}
                aria-label="並び替え"
              >
                <ArrowUpDown size={18} />
              </button>
            </div>
          </div>
          {/* 並び替えパネル */}
          {reorderMode && (
            <div className="flex gap-1.5 mb-1.5">
              <button
                onClick={handleSortByName}
                className="text-body px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                名前順
              </button>
              <button
                onClick={handleSortByPriority}
                className="text-body px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                優先度順
              </button>
            </div>
          )}
          {/* 進捗バー */}
          <div className="w-full bg-gray-200 rounded-full h-2 flex overflow-hidden">
            <div
              className="bg-green-500 h-2 transition-all duration-300"
              style={{ width: `${totalCount ? (checkedCount / totalCount) * 100 : 0}%` }}
            />
            <div
              className="bg-red-400 h-2 transition-all duration-300"
              style={{ width: `${totalCount ? (soldOutCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {spots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <MapPin size={40} className="opacity-30" />
          <p className="text-body">マップを選択してサークルを追加してください</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {spotsByMap.map(({ map, spots: mapSpots }) => (
            <div key={map.id}>
              {maps.length > 1 && (
                <div className="px-4 pt-3 pb-1">
                  <span className="text-label font-semibold text-gray-500 uppercase tracking-wide">{map.name}</span>
                </div>
              )}
              <SortableContext items={mapSpots.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {mapSpots.map((spot, idx) => (
                  <SortableSpotSection
                    key={spot.id}
                    spot={spot}
                    items={allItems?.[spot.id] ?? []}
                    selected={spot.id === selectedSpotId}
                    onSelect={() => onSelectSpot(spot.id === selectedSpotId ? null : spot.id)}
                    onNavigateToPin={() => onNavigateToPin(spot.id)}
                    registerScroll={(fn) => { scrollRefMap[spot.id] = fn; }}
                    reorderMode={reorderMode}
                    visitIndex={idx + 1}
                    onToggleSpotCheck={() => toggleSpotCheck(spot.id, !spot.checked)}
                    showUncheckedOnly={false}
                  />
                ))}
              </SortableContext>
            </div>
          ))}
        </DndContext>
      )}
    </div>
  );
}
