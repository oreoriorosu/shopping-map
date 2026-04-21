import { useState } from 'react';
import { Check, X, Trash2 } from 'lucide-react';
import { updateItem, deleteItem } from '../hooks/useDb';
import type { ShoppingItem } from '../types';

function cycleState(checked: boolean, soldOut: boolean) {
  if (!checked && !soldOut) return { checked: true, soldOut: false };
  if (checked) return { checked: false, soldOut: true };
  return { checked: false, soldOut: false };
}

export function ItemRow({ item }: { item: ShoppingItem }) {
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
        onClick={() => updateItem(item.id, cycleState(item.checked, item.soldOut))}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          item.checked ? 'bg-green-500 border-green-500' :
          item.soldOut ? 'bg-red-400 border-red-400' :
          'border-gray-400 hover:border-green-400'
        }`}
      >
        {item.checked && <Check size={11} className="text-white" strokeWidth={3} />}
        {item.soldOut && <X size={11} className="text-white" strokeWidth={3} />}
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
        className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 p-0.5 shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
