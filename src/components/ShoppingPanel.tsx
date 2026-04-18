import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, MapPin, Check, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import { addItem, updateItem, deleteItem, deleteSpot, uncheckAll } from '../hooks/useDb';
import type { Spot, ShoppingItem } from '../types';

interface Props {
  mapId: string;
  spots: Spot[];
  selectedSpotId: string | null;
  onSelectSpot: (id: string | null) => void;
  onStartPlacingPin: (color: string, name: string) => void;
  scrollRefMap: Record<string, () => void>;
}

export function ShoppingPanel({ mapId, spots, selectedSpotId, onSelectSpot, scrollRefMap }: Props) {
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

  return (
    <div className="pb-4">
      {/* 進捗ヘッダー */}
      {totalCount > 0 && (
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-2 z-10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-gray-600">{checkedCount}/{totalCount} チェック済み</span>
            {checkedCount > 0 && (
              <button onClick={() => uncheckAll(mapId)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <RotateCcw size={12} /> リセット
              </button>
            )}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${totalCount ? (checkedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {spots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <MapPin size={40} className="opacity-30" />
          <p className="text-sm">右下の＋ボタンで店舗を追加</p>
        </div>
      ) : (
        spots.map(spot => (
          <SpotSection
            key={spot.id}
            spot={spot}
            items={allItems?.[spot.id] ?? []}
            selected={spot.id === selectedSpotId}
            onSelect={() => onSelectSpot(spot.id === selectedSpotId ? null : spot.id)}
            registerScroll={(fn) => { scrollRefMap[spot.id] = fn; }}
          />
        ))
      )}
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
  const [newItem, setNewItem] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const checked = items.filter(i => i.checked).length;

  useEffect(() => {
    registerScroll(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setExpanded(true);
    });
  }, [registerScroll]);

  // 選択時に自動展開
  useEffect(() => {
    if (selected) setExpanded(true);
  }, [selected]);

  const handleAddItem = async () => {
    const name = newItem.trim();
    if (!name) return;
    await addItem(spot.id, name);
    setNewItem('');
  };

  return (
    <div ref={ref} className={`border-b border-gray-100 ${selected ? 'bg-blue-50' : 'bg-white'}`}>
      {/* スポットヘッダー */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => setExpanded(e => !e)} className="text-gray-400 shrink-0">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        <button onClick={onSelect} className="flex items-center gap-2 flex-1 text-left min-w-0">
          <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: spot.color }} />
          <span className="font-medium text-gray-800 truncate">{spot.name}</span>
          {items.length > 0 && (
            <span className="text-xs text-gray-400 shrink-0">{checked}/{items.length}</span>
          )}
        </button>
        <button onClick={() => deleteSpot(spot.id)} className="text-gray-300 hover:text-red-400 shrink-0 p-1">
          <Trash2 size={16} />
        </button>
      </div>

      {expanded && (
        <div className="pb-2">
          {items.map(item => <ItemRow key={item.id} item={item} />)}

          {addingItem ? (
            <div className="flex gap-2 px-4 mt-1">
              <input
                autoFocus
                type="text"
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') setAddingItem(false); }}
                onBlur={() => { if (!newItem.trim()) setAddingItem(false); }}
                placeholder="商品名"
                className="flex-1 text-sm px-3 py-2 border border-blue-300 rounded-lg focus:outline-none"
              />
              <button onClick={handleAddItem} disabled={!newItem.trim()} className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm disabled:opacity-40">
                追加
              </button>
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

  return (
    <div className={`flex items-center gap-3 px-4 py-2 group ${item.checked ? 'opacity-50' : ''}`}>
      <button
        onClick={() => updateItem(item.id, { checked: !item.checked })}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300'
        }`}
      >
        {item.checked && <Check size={11} className="text-white" strokeWidth={3} />}
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
          className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}
        >
          {item.name}
        </span>
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
