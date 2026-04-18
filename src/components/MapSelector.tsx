import { useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { addMap, deleteMap } from '../hooks/useDb';
import type { MapFile } from '../types';

interface Props {
  maps: MapFile[];
  selectedMapId: string | null;
  onSelect: (id: string) => void;
}

export function MapSelector({ maps, selectedMapId, onSelect }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const selected = maps.find(m => m.id === selectedMapId);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const id = await addMap(file.name.replace(/\.pdf$/i, ''), file);
    onSelect(id);
    setOpen(false);
    e.target.value = '';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-sm text-gray-700 max-w-[180px]"
      >
        <span className="truncate">{selected?.name ?? 'マップを選択'}</span>
        <ChevronDown size={14} className="shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-40 overflow-hidden">
            {maps.map(m => (
              <div
                key={m.id}
                className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer ${
                  m.id === selectedMapId ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
                }`}
                onClick={() => { onSelect(m.id); setOpen(false); }}
              >
                <span className="flex-1 text-sm truncate">{m.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); deleteMap(m.id); if (m.id === selectedMapId) setOpen(false); }}
                  className="text-gray-300 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="border-t border-gray-100">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-500 hover:bg-blue-50"
              >
                <Plus size={14} />
                PDFを追加
              </button>
            </div>
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
    </div>
  );
}
