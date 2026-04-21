import { useState } from 'react';
import { MapPin, ArrowUpDown, Filter } from 'lucide-react';
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

export function ShoppingPanel({ maps, spots, selectedSpotId, onSelectSpot, onNavigateToPin, scrollRefMap }: Props) {
  const [reorderMode, setReorderMode] = useState(false);
  const [showUncheckedOnly, setShowUncheckedOnly] = useState(false);

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

  const spotsByMap = maps
    .map(m => ({
      map: m,
      spots: sortByVisitOrder(spots.filter(s => s.mapId === m.id)),
    }))
    .filter(g => g.spots.length > 0);

  const filteredSpotsByMap = showUncheckedOnly
    ? spotsByMap
        .map(g => ({
          ...g,
          spots: g.spots.filter(s => {
            const items = allItems?.[s.id] ?? [];
            if (items.length === 0) return !s.checked;
            return items.some(i => !i.checked);
          }),
        }))
        .filter(g => g.spots.length > 0)
    : spotsByMap;

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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUncheckedOnly(v => !v)}
                className={`flex items-center gap-1 text-body px-3 py-2.5 rounded-full transition-colors ${
                  showUncheckedOnly ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-orange-500'
                }`}
              >
                <Filter size={16} /> 未購入
              </button>
              <button
                onClick={() => setReorderMode(v => !v)}
                className={`flex items-center gap-1 text-body px-3 py-2.5 rounded-full transition-colors ${
                  reorderMode ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-blue-500'
                }`}
              >
                <ArrowUpDown size={16} /> 並び替え
              </button>
            </div>
          </div>
          {reorderMode && (
            <div className="flex gap-1.5 mt-1.5 mb-0.5">
              <button
                onClick={handleSortByName}
                className="text-body px-3 py-2.5 rounded-full bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600 transition-colors"
              >
                名前順
              </button>
              <button
                onClick={handleSortByPriority}
                className="text-body px-3 py-2.5 rounded-full bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600 transition-colors"
              >
                優先度順
              </button>
            </div>
          )}
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
          {filteredSpotsByMap.map(({ map, spots: mapSpots }) => (
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
                    showUncheckedOnly={showUncheckedOnly}
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
