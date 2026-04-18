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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [hallName, setHallName] = useState('');

  const selected = maps.find(m => m.id === selectedMapId);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setHallName(file.name.replace(/\.pdf$/i, ''));
    e.target.value = '';
  };

  const handleConfirm = async () => {
    if (!pendingFile || !hallName.trim()) return;
    const id = await addMap(hallName.trim(), pendingFile);
    onSelect(id);
    setOpen(false);
    setPendingFile(null);
    setHallName('');
  };

  const handleCancel = () => {
    setPendingFile(null);
    setHallName('');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-sm text-gray-700 max-w-[180px]"
      >
        <span className="truncate">{selected?.name ?? 'ホールを選択'}</span>
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
                ホールを追加
              </button>
            </div>
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />

      {pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-gray-800 mb-1">ホール名を入力</h2>
            <p className="text-xs text-gray-400 mb-4">{pendingFile.name}</p>
            <input
              type="text"
              value={hallName}
              onChange={e => setHallName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') handleCancel(); }}
              placeholder="例: 東ホール"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirm}
                disabled={!hallName.trim()}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
