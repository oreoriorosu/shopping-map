import { useState, useRef, useEffect } from 'react';
import { Image, X, Plus, Check } from 'lucide-react';
import { useGenres, addGenre } from '../hooks/useDb';
import { GENRE_COLORS } from './MapViewer';
import type { Spot, Genre } from '../types';

type CircleFormData = Omit<Spot, 'id' | 'mapId' | 'pin'>;

interface Props {
  mapName: string;
  initialData?: CircleFormData;
  onConfirm: (data: CircleFormData) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

const PRIORITIES = ['A', 'B', 'C', 'D'] as const;

export function AddSpotModal({ mapName, initialData, onConfirm, onDelete, onCancel }: Props) {
  const isEdit = !!initialData;
  const genres = useGenres() ?? [];

  const [name, setName] = useState(initialData?.name ?? '');
  const locationParts = initialData?.location?.match(/^(.+)-(\d{2})$/) ?? null;
  const [locationChar, setLocationChar] = useState(locationParts?.[1] ?? '');
  const [locationNum, setLocationNum] = useState(locationParts?.[2] ?? '');
  const locationNumRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [priority, setPriority] = useState<'A' | 'B' | 'C' | 'D' | undefined>(initialData?.priority);
  const [oshi, setOshi] = useState(initialData?.oshi ?? '');
  const [genreId, setGenreId] = useState<string | undefined>(initialData?.genreId);
  const [image, setImage] = useState<Blob | undefined>(initialData?.image);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [showNewGenre, setShowNewGenre] = useState(false);
  const [newGenreName, setNewGenreName] = useState('');
  const [newGenreColor, setNewGenreColor] = useState(GENRE_COLORS[0]);

  useEffect(() => {
    if (initialData?.image) {
      const url = URL.createObjectURL(initialData.image);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(undefined);
    setImagePreview(null);
  };

  const handleAddGenre = async () => {
    if (!newGenreName.trim()) return;
    const genre: Genre = await addGenre(newGenreName.trim(), newGenreColor);
    setGenreId(genre.id);
    setNewGenreName('');
    setNewGenreColor(GENRE_COLORS[0]);
    setShowNewGenre(false);
  };

  const handleConfirm = () => {
    const location = locationChar && locationNum ? `${locationChar}-${locationNum}` : '';
    const resolvedName = name.trim() || location || '名称未設定';
    onConfirm({
      name: resolvedName,
      hallName: mapName || undefined,
      location: location || undefined,
      priority,
      oshi: oshi.trim() || undefined,
      genreId,
      image,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl max-h-[55vh] flex flex-col pointer-events-auto shadow-2xl"
      >
        <div className="px-5 pt-5 pb-3 shrink-0">
          <h3 className="text-base font-semibold text-gray-800">
            {isEdit ? 'サークルを編集' : 'サークルを追加'}
          </h3>
        </div>

        <div className="overflow-y-auto flex-1 px-5 space-y-4 pb-2">
          {/* ホール名（読み取り専用） */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ホール名</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              {mapName}
            </div>
          </div>

          {/* 場所 + サークル名 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">場所</label>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-blue-400">
                <input
                  type="text"
                  value={locationChar}
                  onChange={e => {
                    const val = e.target.value;
                    setLocationChar(val);
                    if (val.length >= 1) locationNumRef.current?.focus();
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                  placeholder="さ"
                  className="w-10 px-2 py-2 text-sm text-center focus:outline-none bg-white"
                />
                <span className="text-gray-400 text-sm select-none">-</span>
                <input
                  ref={locationNumRef}
                  type="text"
                  inputMode="numeric"
                  value={locationNum}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setLocationNum(val);
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                  placeholder="10"
                  className="w-10 px-2 py-2 text-sm text-center focus:outline-none bg-white"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">サークル名（任意）</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                placeholder="空欄なら場所名を使用"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* 優先度 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">優先度</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => {
                const isSelected = priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(priority === p ? undefined : p)}
                    className={`w-10 h-10 rounded-full font-bold text-sm transition-transform ${
                      isSelected ? 'scale-110 shadow ring-2 ring-offset-1 ring-gray-400 bg-gray-700 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 推し */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">推し</label>
            <input
              type="text"
              value={oshi}
              onChange={e => setOshi(e.target.value)}
              placeholder="例: キャラ名"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* ジャンル */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ジャンル</label>
            <div className="flex flex-wrap gap-2">
              {genres.map(g => (
                <button
                  key={g.id}
                  onClick={() => setGenreId(genreId === g.id ? undefined : g.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-transform ${
                    genreId === g.id ? 'scale-105 ring-2 ring-offset-1 ring-gray-400' : 'opacity-70'
                  }`}
                  style={{ backgroundColor: g.color, color: '#fff' }}
                >
                  {genreId === g.id && <Check size={12} />}
                  {g.name}
                </button>
              ))}

              {!showNewGenre && (
                <button
                  onClick={() => setShowNewGenre(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-gray-400 border border-dashed border-gray-300 hover:border-blue-300 hover:text-blue-400"
                >
                  <Plus size={14} /> 追加
                </button>
              )}
            </div>

            {showNewGenre && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                <input
                  type="text"
                  value={newGenreName}
                  onChange={e => setNewGenreName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddGenre()}
                  placeholder="ジャンル名"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 bg-white"
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
                    作成
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* お品書き画像 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">お品書き画像</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            {imagePreview ? (
              <div className="relative inline-block">
                <img src={imagePreview} alt="お品書き" className="h-32 rounded-lg object-cover border border-gray-200" />
                <button
                  onClick={clearImage}
                  className="absolute -top-2 -right-2 bg-gray-600 text-white rounded-full w-5 h-5 flex items-center justify-center"
                >
                  <X size={12} />
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded"
                >
                  変更
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-blue-300 hover:text-blue-400 w-full justify-center"
              >
                <Image size={18} /> 画像を追加
              </button>
            )}
          </div>
        </div>

        {isEdit && onDelete && (
          <div className="px-5 pb-2 shrink-0">
            {confirmDelete ? (
              <div className="flex gap-2 items-center bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span className="flex-1 text-sm text-red-600">本当に削除しますか？</span>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 px-2 py-1">
                  キャンセル
                </button>
                <button onClick={onDelete} className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg font-medium">
                  削除
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2 text-sm text-red-400 hover:text-red-600 border border-red-200 rounded-lg"
              >
                このサークルを削除
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2 px-5 py-4 shrink-0">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600">
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium"
          >
            {isEdit ? '保存' : '追加'}
          </button>
        </div>
      </div>
    </div>
  );
}
