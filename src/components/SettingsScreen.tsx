import { useState } from 'react';
import { ArrowLeft, Plus, Check, Trash2, Pencil, RefreshCw, Upload, HelpCircle } from 'lucide-react';
import { useGenres, addGenre, updateGenre, deleteGenre, uncheckAllItems } from '../hooks/useDb';
import { GENRE_COLORS, mixWithWhite } from './MapViewer';
import { CsvImportModal } from './CsvImportModal';
import { HelpModal } from './HelpModal';
import type { MapFile, Genre } from '../types';

interface Props {
  maps: MapFile[];
  selectedMapId: string | null;
  onClose: () => void;
}

export function SettingsScreen({ maps, selectedMapId, onClose }: Props) {
  const genres = useGenres() ?? [];
  const [showCsv, setShowCsv] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showNewGenre, setShowNewGenre] = useState(false);
  const [newGenreName, setNewGenreName] = useState('');
  const [newGenreColor, setNewGenreColor] = useState(GENRE_COLORS[0]);

  const startEdit = (g: Genre) => {
    setEditingId(g.id);
    setEditName(g.name);
    setEditColor(g.color);
    setDeletingId(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateGenre(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const handleAddGenre = async () => {
    if (!newGenreName.trim()) return;
    await addGenre(newGenreName.trim(), newGenreColor);
    setNewGenreName('');
    setNewGenreColor(GENRE_COLORS[0]);
    setShowNewGenre(false);
  };

  const handleDelete = async (id: string) => {
    await deleteGenre(id);
    setDeletingId(null);
  };

  const handleReset = async () => {
    await uncheckAllItems();
    setConfirmReset(false);
  };

  return (
    <div className="fixed inset-0 z-40 bg-gray-50 flex flex-col safe-top safe-bottom">
      {/* ヘッダー */}
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-semibold text-gray-800">設定</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* ジャンル管理 */}
        <section className="mt-4 bg-white border-t border-b border-gray-200">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ジャンル</span>
          </div>

          {genres.length === 0 && !showNewGenre && (
            <div className="px-4 pb-3 text-sm text-gray-400">まだジャンルがありません</div>
          )}

          {genres.map((g, i) => (
            <div key={g.id} className={`${i > 0 ? 'border-t border-gray-100' : ''}`}>
              {editingId === g.id ? (
                <div className="px-4 py-3 space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    {GENRE_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={`w-6 h-6 rounded-full transition-transform ${editColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={!editName.trim()}
                      className="flex-1 py-1.5 text-xs bg-blue-500 text-white rounded-lg disabled:opacity-40"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : deletingId === g.id ? (
                <div className="px-4 py-3 flex items-center gap-3 bg-red-50">
                  <span className="flex-1 text-sm text-red-600">「{g.name}」を削除しますか？</span>
                  <button onClick={() => setDeletingId(null)} className="text-xs text-gray-500 px-2 py-1">キャンセル</button>
                  <button onClick={() => handleDelete(g.id)} className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg">削除</button>
                </div>
              ) : (
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ background: g.color }} />
                  <span className="flex-1 text-sm text-gray-800">{g.name}</span>
                  <div className="flex gap-1">
                    {GENRE_COLORS.slice(0, 4).map(c => (
                      <div key={c} className="w-3 h-3 rounded-full" style={{ background: mixWithWhite(g.color, [0, 0.25, 0.5, 0.7][GENRE_COLORS.slice(0,4).indexOf(c)] ?? 0) }} />
                    ))}
                  </div>
                  <button onClick={() => startEdit(g)} className="p-1.5 text-gray-300 hover:text-blue-400">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => { setDeletingId(g.id); setEditingId(null); }} className="p-1.5 text-gray-300 hover:text-red-400">
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {showNewGenre ? (
            <div className="px-4 py-3 border-t border-gray-100 space-y-2">
              <input
                type="text"
                value={newGenreName}
                onChange={e => setNewGenreName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddGenre()}
                placeholder="ジャンル名"
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
                autoFocus
              />
              <div className="flex gap-1.5">
                {GENRE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewGenreColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform ${newGenreColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowNewGenre(false); setNewGenreName(''); }}
                  className="flex-1 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddGenre}
                  disabled={!newGenreName.trim()}
                  className="flex-1 py-1.5 text-xs bg-blue-500 text-white rounded-lg disabled:opacity-40"
                >
                  追加
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowNewGenre(true); setEditingId(null); setDeletingId(null); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-blue-500 border-t border-gray-100"
            >
              <Plus size={16} /> ジャンルを追加
            </button>
          )}
        </section>

        {/* データ管理 */}
        <section className="mt-6 bg-white border-t border-b border-gray-200">
          <div className="px-4 py-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">データ</span>
          </div>

          <button
            onClick={() => setShowCsv(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-t border-gray-100 text-left active:bg-gray-50"
          >
            <Upload size={18} className="text-gray-400 shrink-0" />
            <span className="flex-1 text-sm text-gray-700">CSVインポート</span>
          </button>

          <div className="border-t border-gray-100">
            {confirmReset ? (
              <div className="px-4 py-3 flex items-center gap-3 bg-red-50">
                <span className="flex-1 text-sm text-red-600">全スポットのチェックをリセットしますか？</span>
                <button onClick={() => setConfirmReset(false)} className="text-xs text-gray-500 px-2 py-1">キャンセル</button>
                <button onClick={handleReset} className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg flex items-center gap-1">
                  <Check size={12} /> リセット
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50"
              >
                <RefreshCw size={18} className="text-gray-400 shrink-0" />
                <span className="flex-1 text-sm text-gray-700">全チェックリセット</span>
              </button>
            )}
          </div>
        </section>

        {/* ヘルプ */}
        <section className="mt-6 bg-white border-t border-b border-gray-200">
          <div className="px-4 py-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ヘルプ</span>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-t border-gray-100 text-left active:bg-gray-50"
          >
            <HelpCircle size={18} className="text-gray-400 shrink-0" />
            <span className="flex-1 text-sm text-gray-700">使い方・Q&A</span>
          </button>
        </section>

        <div className="h-8" />
      </div>

      {showCsv && (
        <CsvImportModal
          maps={maps}
          selectedMapId={selectedMapId}
          onClose={() => setShowCsv(false)}
          onDone={() => setShowCsv(false)}
        />
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
