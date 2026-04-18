import { useRef } from 'react';
import { Map, Plus, Trash2 } from 'lucide-react';
import { addMap, deleteMap } from '../hooks/useDb';
import type { MapFile } from '../types';

interface Props {
  maps: MapFile[];
  selectedMapId: string | null;
  onSelect: (id: string) => void;
}

export function MapList({ maps, selectedMapId, onSelect }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const id = await addMap(file.name.replace(/\.pdf$/i, ''), file);
    onSelect(id);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white w-48 shrink-0">
      <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700">
        マップ
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {maps.map(m => (
          <div
            key={m.id}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer group ${
              m.id === selectedMapId ? 'bg-gray-700' : 'hover:bg-gray-800'
            }`}
            onClick={() => onSelect(m.id)}
          >
            <Map size={14} className="shrink-0 text-gray-400" />
            <span className="flex-1 text-sm truncate">{m.name}</span>
            <button
              onClick={e => { e.stopPropagation(); deleteMap(m.id); }}
              className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-gray-700">
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-1.5 text-sm py-1.5 bg-blue-600 hover:bg-blue-500 rounded"
        >
          <Plus size={14} />
          PDFを追加
        </button>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}
