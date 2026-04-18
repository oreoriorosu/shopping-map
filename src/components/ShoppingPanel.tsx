import { useState } from 'react';
import { Plus, Trash2, MapPin, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import {
  addItem, updateItem, deleteItem,
  deleteSpot, uncheckAll,
} from '../hooks/useDb';
import { SPOT_COLORS } from './MapViewer';
import type { Spot, ShoppingItem } from '../types';

interface Props {
  mapId: string;
  spots: Spot[];
  selectedSpotId: string | null;
  onSelectSpot: (id: string | null) => void;
  onStartPlacingPin: (color: string, name: string) => void;
}

export function ShoppingPanel({ mapId, spots, selectedSpotId, onSelectSpot, onStartPlacingPin }: Props) {
  const [newSpotName, setNewSpotName] = useState('');
  const [colorIdx, setColorIdx] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const allItems = useLiveQuery(async () => {
    const spotIds = spots.map(s => s.id);
    if (!spotIds.length) return {} as Record<string, ShoppingItem[]>;
    const items = await db.items.where('spotId').anyOf(spotIds).sortBy('order');
    const result: Record<string, ShoppingItem[]> = {};
    for (const s of spots) result[s.id] = [];
    for (const item of items) result[item.spotId]?.push(item);
    return result;
  }, [spots]);

  const totalCount = Object.values(allItems ?? {}).flat().length as number;
  const checkedCount = Object.values(allItems ?? {}).flat().filter((i: unknown) => (i as ShoppingItem).checked).length;

  const handleAddSpot = () => {
    const name = newSpotName.trim();
    if (!name) return;
    const color = SPOT_COLORS[colorIdx % SPOT_COLORS.length];
    onStartPlacingPin(color, name);
    setNewSpotName('');
    setColorIdx(c => c + 1);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ヘッダー */}
      <div className="px-3 py-2 border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-800">買い物リスト</h2>
          {totalCount > 0 && (
            <span className="text-xs text-gray-500">{checkedCount}/{totalCount}</span>
          )}
        </div>
        {/* 進捗バー */}
        {totalCount > 0 && (
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(checkedCount / totalCount) * 100}%` }}
            />
          </div>
        )}
        {checkedCount > 0 && (
          <button
            onClick={() => uncheckAll(mapId)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            チェックをリセット
          </button>
        )}
      </div>

      {/* スポット追加 */}
      <div className="px-3 py-2 border-b border-gray-100 shrink-0 bg-gray-50">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newSpotName}
            onChange={e => setNewSpotName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSpot()}
            placeholder="店舗名を入力..."
            className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={handleAddSpot}
            disabled={!newSpotName.trim()}
            className="flex items-center gap-1 text-sm px-2 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-40"
          >
            <MapPin size={14} />
            追加
          </button>
        </div>
      </div>

      {/* スポット一覧 */}
      <div className="flex-1 overflow-y-auto">
        {spots.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            <MapPin size={32} className="mx-auto mb-2 opacity-40" />
            店舗を追加してマップにピンを刺してください
          </div>
        ) : (
          spots.map(spot => (
            <SpotSection
              key={spot.id}
              spot={spot}
              items={allItems?.[spot.id] ?? []}
              selected={spot.id === selectedSpotId}
              expanded={expanded[spot.id] ?? true}
              onToggleExpand={() => setExpanded(e => ({ ...e, [spot.id]: !(e[spot.id] ?? true) }))}
              onSelect={() => onSelectSpot(spot.id === selectedSpotId ? null : spot.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SpotSection({ spot, items, selected, expanded, onToggleExpand, onSelect }: {
  spot: Spot;
  items: ShoppingItem[];
  selected: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
}) {
  const [newItem, setNewItem] = useState('');
  const checked = items.filter(i => i.checked).length;

  const handleAddItem = async () => {
    const name = newItem.trim();
    if (!name) return;
    await addItem(spot.id, name);
    setNewItem('');
  };

  return (
    <div className={`border-b border-gray-100 ${selected ? 'bg-blue-50' : ''}`}>
      {/* スポットヘッダー */}
      <div className="flex items-center gap-1 px-3 py-2">
        <button onClick={onToggleExpand} className="text-gray-400">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <button
          onClick={onSelect}
          className="flex items-center gap-1.5 flex-1 text-left"
        >
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: spot.color }} />
          <span className="text-sm font-medium text-gray-800 flex-1">{spot.name}</span>
          {items.length > 0 && (
            <span className="text-xs text-gray-400">{checked}/{items.length}</span>
          )}
        </button>
        <button
          onClick={() => deleteSpot(spot.id)}
          className="text-gray-300 hover:text-red-400 ml-1"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="pb-2">
          {/* アイテム一覧 */}
          {items.map(item => (
            <ItemRow key={item.id} item={item} />
          ))}

          {/* アイテム追加 */}
          <div className="flex gap-1 px-4 mt-1">
            <input
              type="text"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
              placeholder="商品を追加..."
              className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-blue-300"
            />
            <button
              onClick={handleAddItem}
              disabled={!newItem.trim()}
              className="text-blue-500 hover:text-blue-600 disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>
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
    <div className={`flex items-center gap-2 px-4 py-1 group ${item.checked ? 'opacity-50' : ''}`}>
      <button
        onClick={() => updateItem(item.id, { checked: !item.checked })}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
          item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        {item.checked && <Check size={10} className="text-white" />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="flex-1 text-xs px-1 border-b border-blue-400 focus:outline-none"
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          className={`flex-1 text-xs ${item.checked ? 'line-through' : ''}`}
        >
          {item.name}
        </span>
      )}

      <button
        onClick={() => deleteItem(item.id)}
        className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
