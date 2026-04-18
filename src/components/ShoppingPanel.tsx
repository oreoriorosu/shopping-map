import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, MapPin, Check, RotateCcw, ChevronDown, ChevronRight, Pencil, ArrowUpDown, ChevronUp } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import { addItem, updateItem, deleteItem, deleteSpot, updateSpot, uncheckAllItems, reorderSpots } from '../hooks/useDb';
import { AddSpotModal } from './AddSpotModal';
import type { MapFile, Spot, ShoppingItem } from '../types';

interface Props {
  maps: MapFile[];
  spots: Spot[];
  selectedSpotId: string | null;
  onSelectSpot: (id: string | null) => void;
  scrollRefMap: Record<string, () => void>;
}

const PRIORITY_STYLE: Record<string, string> = {
  A: 'bg-red-500 text-white',
  B: 'bg-orange-400 text-white',
  C: 'bg-yellow-400 text-gray-800',
  D: 'bg-gray-400 text-white',
};

function sortByVisitOrder(spots: Spot[]): Spot[] {
  return [...spots].sort((a, b) => {
    if (a.visitOrder == null && b.visitOrder == null) return 0;
    if (a.visitOrder == null) return 1;
    if (b.visitOrder == null) return -1;
    return a.visitOrder - b.visitOrder;
  });
}

export function ShoppingPanel({ maps, spots, selectedSpotId, onSelectSpot, scrollRefMap }: Props) {
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
  const totalCount = allFlat.length;
  const checkedCount = allFlat.filter(i => i.checked).length;
  const soldOutCount = allFlat.filter(i => i.soldOut && !i.checked).length;

  const spotsByMap = maps
    .map(m => ({
      map: m,
      spots: sortByVisitOrder(spots.filter(s => s.mapId === m.id)),
    }))
    .filter(g => g.spots.length > 0);

  const handleMoveSpot = async (mapId: string, spotId: string, direction: 'up' | 'down') => {
    const group = spotsByMap.find(g => g.map.id === mapId);
    if (!group) return;
    const idx = group.spots.findIndex(s => s.id === spotId);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === group.spots.length - 1) return;
    const newOrder = [...group.spots];
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swap]] = [newOrder[swap], newOrder[idx]];
    await reorderSpots(newOrder.map(s => s.id));
  };

  return (
    <div className="pb-4">
      {/* 進捗ヘッダー */}
      {totalCount > 0 && (
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-2 z-10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-gray-600">
              {checkedCount}/{totalCount} 購入済み
              {soldOutCount > 0 && <span className="ml-2 text-red-400 text-xs">{soldOutCount} 売切</span>}
            </span>
            <div className="flex items-center gap-2">
              {checkedCount > 0 && (
                <button onClick={uncheckAllItems} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  <RotateCcw size={12} /> リセット
                </button>
              )}
              <button
                onClick={() => setReorderMode(v => !v)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                  reorderMode ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-blue-500'
                }`}
              >
                <ArrowUpDown size={12} /> 並び替え
              </button>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 flex overflow-hidden">
            <div
              className="bg-green-500 h-1.5 transition-all duration-300"
              style={{ width: `${totalCount ? (checkedCount / totalCount) * 100 : 0}%` }}
            />
            <div
              className="bg-red-400 h-1.5 transition-all duration-300"
              style={{ width: `${totalCount ? (soldOutCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {spots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <MapPin size={40} className="opacity-30" />
          <p className="text-sm">マップを選択してサークルを追加してください</p>
        </div>
      ) : (
        spotsByMap.map(({ map, spots: mapSpots }) => (
          <div key={map.id}>
            {maps.length > 1 && (
              <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{map.name}</span>
              </div>
            )}
            {mapSpots.map((spot, idx) => (
              <SpotSection
                key={spot.id}
                spot={spot}
                items={allItems?.[spot.id] ?? []}
                selected={spot.id === selectedSpotId}
                onSelect={() => onSelectSpot(spot.id === selectedSpotId ? null : spot.id)}
                registerScroll={(fn) => { scrollRefMap[spot.id] = fn; }}
                reorderMode={reorderMode}
                visitIndex={idx + 1}
                canMoveUp={idx > 0}
                canMoveDown={idx < mapSpots.length - 1}
                onMoveUp={() => handleMoveSpot(map.id, spot.id, 'up')}
                onMoveDown={() => handleMoveSpot(map.id, spot.id, 'down')}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function useBlobUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function ImageModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <img
        src={url}
        alt="お品書き"
        className="max-w-full max-h-full rounded-lg object-contain"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

function SpotSection({ spot, items, selected, onSelect, registerScroll, reorderMode, visitIndex, canMoveUp, canMoveDown, onMoveUp, onMoveDown }: {
  spot: Spot;
  items: ShoppingItem[];
  selected: boolean;
  onSelect: () => void;
  registerScroll: (fn: () => void) => void;
  reorderMode: boolean;
  visitIndex: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const imageUrl = useBlobUrl(spot.image);
  const checkedCount = items.filter(i => i.checked).length;
  const soldOutCount = items.filter(i => i.soldOut && !i.checked).length;

  useEffect(() => {
    registerScroll(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setExpanded(true);
    });
  }, [registerScroll]);

  useEffect(() => {
    if (selected) setExpanded(true);
  }, [selected]);

  const handleAddItem = async () => {
    const name = newName.trim();
    if (!name) return;
    const price = newPrice.trim() ? parseInt(newPrice.trim().replace(/[^0-9]/g, ''), 10) : undefined;
    await addItem(spot.id, name, price);
    setNewName('');
    setNewPrice('');
  };

  const hasMeta = spot.hallName || spot.location || spot.oshi || spot.genre;

  return (
    <div ref={ref} className={`border-b border-gray-100 ${selected ? 'bg-blue-50' : 'bg-white'}`}>
      {/* ヘッダー行 */}
      <div className="flex items-center gap-2 px-4 py-3">
        {reorderMode ? (
          <div className="flex flex-col gap-0.5 shrink-0">
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="text-gray-300 hover:text-blue-500 disabled:opacity-20 p-0.5"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="text-gray-300 hover:text-blue-500 disabled:opacity-20 p-0.5 rotate-180"
            >
              <ChevronUp size={16} />
            </button>
          </div>
        ) : (
          <button onClick={() => setExpanded(e => !e)} className="text-gray-400 shrink-0">
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
        )}

        {reorderMode ? (
          <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {visitIndex}
          </span>
        ) : (
          spot.priority && (
            <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${PRIORITY_STYLE[spot.priority]}`}>
              {spot.priority}
            </span>
          )
        )}

        <button onClick={onSelect} className="flex items-center gap-2 flex-1 text-left min-w-0">
          <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: spot.color }} />
          <span className="font-medium text-gray-800 truncate">{spot.name}</span>
          {items.length > 0 && (
            <span className="text-xs text-gray-400 shrink-0">
              {checkedCount}/{items.length}
              {soldOutCount > 0 && <span className="text-red-400 ml-1">{soldOutCount}売切</span>}
            </span>
          )}
        </button>

        {!reorderMode && (
          <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-blue-400 shrink-0 p-1">
            <Pencil size={15} />
          </button>
        )}
      </div>

      {showImageModal && imageUrl && (
        <ImageModal url={imageUrl} onClose={() => setShowImageModal(false)} />
      )}

      {editing && (
        <AddSpotModal
          usedColors={[]}
          mapName={spot.hallName ?? ''}
          initialData={{ name: spot.name, color: spot.color, hallName: spot.hallName, location: spot.location, priority: spot.priority, oshi: spot.oshi, genre: spot.genre, image: spot.image }}
          onConfirm={async (data) => {
            await updateSpot(spot.id, data);
            setEditing(false);
          }}
          onDelete={async () => {
            await deleteSpot(spot.id);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {!reorderMode && hasMeta && (
        <div className="flex flex-wrap gap-1 px-10 pb-2">
          {spot.hallName && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{spot.hallName}</span>
          )}
          {spot.location && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{spot.location}</span>
          )}
          {spot.oshi && (
            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">推し: {spot.oshi}</span>
          )}
          {spot.genre && (
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{spot.genre}</span>
          )}
        </div>
      )}

      {!reorderMode && expanded && (
        <div className="flex pb-2">
          <div className="flex-1 min-w-0">
            {items.map(item => <ItemRow key={item.id} item={item} />)}

            {addingItem ? (
              <div className="px-4 mt-1 space-y-1.5">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') setAddingItem(false); }}
                  onBlur={() => { if (!newName.trim() && !newPrice.trim()) setAddingItem(false); }}
                  placeholder="商品名"
                  className="w-full text-sm px-3 py-2 border border-blue-300 rounded-lg focus:outline-none"
                />
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); }}
                      placeholder="金額（任意）"
                      className="w-full text-sm pl-7 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300"
                    />
                  </div>
                  <button onClick={handleAddItem} disabled={!newName.trim()} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm disabled:opacity-40">
                    追加
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1.5 mx-4 mt-1 text-sm text-gray-400 hover:text-blue-500 py-1"
              >
                <Plus size={15} /> 商品を追加
              </button>
            )}
          </div>

          {imageUrl && (
            <button
              onClick={() => setShowImageModal(true)}
              className="w-[30%] shrink-0 self-stretch pl-1 pr-2 py-1"
            >
              <img
                src={imageUrl}
                alt="お品書き"
                className="w-full h-full object-cover rounded-lg border border-gray-200 min-h-20"
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: ShoppingItem }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.name);

  const save = () => {
    if (val.trim()) updateItem(item.id, { name: val.trim() });
    else setVal(item.name);
    setEditing(false);
  };

  const isFaded = item.checked || item.soldOut;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 group ${isFaded ? 'opacity-60' : ''}`}>
      <button
        onClick={() => updateItem(item.id, { checked: !item.checked })}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300'
        }`}
      >
        {item.checked && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>

      <button
        onClick={() => updateItem(item.id, { soldOut: !item.soldOut })}
        className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 transition-colors ${
          item.soldOut ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500'
        }`}
      >
        売切
      </button>

      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="flex-1 text-sm border-b border-blue-400 focus:outline-none bg-transparent"
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          className={`flex-1 text-sm ${isFaded ? 'line-through text-gray-400' : 'text-gray-700'}`}
        >
          {item.name}
        </span>
      )}

      {item.price !== undefined && (
        <span className="text-xs text-gray-400 shrink-0">¥{item.price.toLocaleString()}</span>
      )}

      <button
        onClick={() => deleteItem(item.id)}
        className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 p-0.5 shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
