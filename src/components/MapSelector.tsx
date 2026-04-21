import { useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2, Pencil, ChevronUp, ChevronDown as ChevronDownIcon, Check, X } from 'lucide-react';
import { addMap, deleteMap, getSpotCountByMap, renameMap, reorderMaps } from '../hooks/useDb';
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
  const [editOpen, setEditOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<MapFile[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; spotCount: number } | null>(null);

  const selected = maps.find(m => m.id === selectedMapId);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setHallName(file.name.replace(/\.[^.]+$/, ''));
    e.target.value = '';
  };

  const handleConfirm = async () => {
    if (!pendingFile || !hallName.trim()) return;
    const fileType = pendingFile.type.startsWith('image/') ? 'image' : 'pdf';
    const id = await addMap(hallName.trim(), pendingFile, fileType);
    onSelect(id);
    setOpen(false);
    setPendingFile(null);
    setHallName('');
  };

  const handleCancel = () => {
    setPendingFile(null);
    setHallName('');
  };

  const openEdit = () => {
    setEditOrder([...maps]);
    setRenamingId(null);
    setRenameValue('');
    setOpen(false);
    setEditOpen(true);
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...editOrder];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setEditOrder(next);
  };

  const startRename = (m: MapFile) => {
    setRenamingId(m.id);
    setRenameValue(m.name);
  };

  const commitRename = async () => {
    if (!renamingId || !renameValue.trim()) return;
    await renameMap(renamingId, renameValue.trim());
    setEditOrder(prev => prev.map(m => m.id === renamingId ? { ...m, name: renameValue.trim() } : m));
    setRenamingId(null);
  };

  const handleEditSave = async () => {
    await reorderMaps(editOrder.map(m => m.id));
    setEditOpen(false);
  };

  const handleEditDelete = async (id: string) => {
    const map = editOrder.find(m => m.id === id);
    const spotCount = await getSpotCountByMap(id);
    if (spotCount > 0) {
      setDeleteConfirm({ id, name: map?.name ?? '', spotCount });
      return;
    }
    await deleteMap(id);
    setEditOrder(prev => prev.filter(m => m.id !== id));
    if (id === selectedMapId) onSelect('');
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    await deleteMap(deleteConfirm.id);
    setEditOrder(prev => prev.filter(m => m.id !== deleteConfirm.id));
    if (deleteConfirm.id === selectedMapId) onSelect('');
    setDeleteConfirm(null);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-3 py-2.5 rounded bg-gray-100 text-body text-gray-700 max-w-[180px]"
      >
        <span className="truncate">{selected?.name ?? 'ホールを選択'}</span>
        <ChevronDown size={16} className="shrink-0" />
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
                <span className="flex-1 text-body truncate">{m.name}</span>
              </div>
            ))}
            <div className="border-t border-gray-100 flex">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 flex items-center gap-2 px-3 py-2.5 text-body text-blue-500 hover:bg-blue-50"
              >
                <Plus size={16} />
                ホールを追加
              </button>
              {maps.length > 0 && (
                <button
                  onClick={openEdit}
                  className="px-3 py-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFile} />

      {pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-gray-800 mb-1">ホール名を入力</h2>
            <p className="text-label text-gray-400 mb-4">{pendingFile.name}</p>
            <input
              type="text"
              value={hallName}
              onChange={e => setHallName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') handleCancel(); }}
              placeholder="例: 東ホール"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-body focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-3 text-body text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirm}
                disabled={!hallName.trim()}
                className="px-4 py-3 text-body bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">ホールを編集</h2>
              <button onClick={() => setEditOpen(false)} className="text-gray-400 hover:text-gray-600 p-2.5">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
              {editOrder.map((m, i) => (
                <div key={m.id} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="flex flex-col">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="text-gray-300 hover:text-gray-500 disabled:opacity-20 p-1"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === editOrder.length - 1}
                      className="text-gray-300 hover:text-gray-500 disabled:opacity-20 p-1"
                    >
                      <ChevronDownIcon size={16} />
                    </button>
                  </div>

                  {renamingId === m.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                      autoFocus
                      className="flex-1 border border-blue-400 rounded px-2 py-2.5 text-body focus:outline-none"
                    />
                  ) : (
                    <span
                      className="flex-1 text-body truncate cursor-pointer hover:text-blue-500"
                      onClick={() => startRename(m)}
                    >
                      {m.name}
                    </span>
                  )}

                  {renamingId === m.id ? (
                    <button
                      onClick={commitRename}
                      disabled={!renameValue.trim()}
                      className="text-blue-500 hover:text-blue-700 disabled:opacity-30 p-2"
                    >
                      <Check size={16} />
                    </button>
                  ) : (
                    <button onClick={() => startRename(m)} className="text-gray-300 hover:text-blue-400 p-2">
                      <Pencil size={16} />
                    </button>
                  )}

                  <button
                    onClick={() => handleEditDelete(m.id)}
                    className="text-gray-300 hover:text-red-400 p-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => setEditOpen(false)}
                className="px-4 py-3 text-body text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleEditSave}
                className="px-4 py-3 text-body bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-gray-800 mb-3">ホールを削除しますか？</h2>
            <p className="text-body text-gray-600 mb-1">
              <span className="font-medium">{deleteConfirm.name}</span> には{deleteConfirm.spotCount}個のピンが設定されています。
            </p>
            <p className="text-body text-red-500 mb-5">削除するとピンとショッピングリストもすべて消えます。</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-3 text-body text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-3 text-body bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
