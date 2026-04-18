import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, MapPin, Check, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import { addItem, updateItem, deleteItem, deleteSpot, uncheckAllItems } from '../hooks/useDb';
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

export function ShoppingPanel({ maps, spots, selectedSpotId, onSelectSpot, scrollRefMap }: Props) {
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
    .map(m => ({ map: m, spots: spots.filter(s => s.mapId === m.id) }))
    .filter(g => g.spots.length > 0);

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
            {checkedCount > 0 && (
              <button onClick={uncheckAllItems} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <RotateCcw size={12} /> リセット
              </button>
            )}
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
            {mapSpots.map(spot => (
              <SpotSection
                key={spot.id}
                spot={spot}
                items={allItems?.[spot.id] ?? []}
                selected={spot.id === selectedSpotId}
                onSelect={() => onSelectSpot(spot.id === selectedSpotId ? null : spot.id)}
                registerScroll={(fn) => { scrollRefMap[spot.id] = fn; }}
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

function SpotSection({ spot, items, selected, onSelect, registerScroll }: {
  spot: Spot;
  items: ShoppingItem[];
  selected: boolean;
  onSelect: () => void;
  registerScroll: (fn: () => void) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
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
        <button onClick={() => setExpanded(e => !e)} className="text-gray-400 shrink-0">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        {spot.priority && (
          <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${PRIORITY_STYLE[spot.priority]}`}>
            {spot.priority}
          </span>
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

        {imageUrl && (
          <button onClick={() => setShowImageModal(true)} className="shrink-0 ml-1">
            <img src={imageUrl} alt="お品書き" className="w-9 h-9 rounded object-cover border border-gray-200" />
          </button>
        )}

        <button onClick={() => deleteSpot(spot.id)} className="text-gray-300 hover:text-red-400 shrink-0 p-1">
          <Trash2 size={16} />
        </button>
      </div>

      {showImageModal && imageUrl && (
        <ImageModal url={imageUrl} onClose={() => setShowImageModal(false)} />
      )}

      {/* メタ情報タグ */}
      {hasMeta && (
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

      {expanded && (
        <div className="pb-2">
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
      {/* 購入済みチェック */}
      <button
        onClick={() => updateItem(item.id, { checked: !item.checked })}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300'
        }`}
      >
        {item.checked && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>

      {/* 売切ボタン */}
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
