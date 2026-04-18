import { useState, useRef, useEffect } from 'react';
import { Image, X } from 'lucide-react';
import { SPOT_COLORS } from './MapViewer';
import type { Spot } from '../types';

type CircleFormData = Omit<Spot, 'id' | 'mapId' | 'pin'>;

interface Props {
  usedColors: string[];
  onConfirm: (data: CircleFormData) => void;
  onCancel: () => void;
}

const PRIORITIES = ['A', 'B', 'C', 'D'] as const;
const PRIORITY_COLORS: Record<string, string> = {
  A: 'bg-red-500 text-white',
  B: 'bg-orange-400 text-white',
  C: 'bg-yellow-400 text-gray-800',
  D: 'bg-gray-400 text-white',
};

export function AddSpotModal({ usedColors, onConfirm, onCancel }: Props) {
  const defaultColor = SPOT_COLORS.find(c => !usedColors.includes(c)) ?? SPOT_COLORS[0];
  const [name, setName] = useState('');
  const [hallName, setHallName] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<'A' | 'B' | 'C' | 'D' | undefined>();
  const [oshi, setOshi] = useState('');
  const [genre, setGenre] = useState('');
  const [color, setColor] = useState(defaultColor);
  const [image, setImage] = useState<Blob | undefined>();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview); };
  }, [imagePreview]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleConfirm = () => {
    const n = name.trim();
    if (!n) return;
    onConfirm({
      name: n,
      color,
      hallName: hallName.trim() || undefined,
      location: location.trim() || undefined,
      priority,
      oshi: oshi.trim() || undefined,
      genre: genre.trim() || undefined,
      image,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
          <h3 className="text-base font-semibold text-gray-800">サークルを追加</h3>
        </div>

        <div className="overflow-y-auto flex-1 px-5 space-y-4 pb-2">
          {/* サークル名 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">サークル名 *</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="サークル名を入力"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* ホール名 + 場所 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">ホール名</label>
              <input
                type="text"
                value={hallName}
                onChange={e => setHallName(e.target.value)}
                placeholder="例: 東1"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">場所</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="例: さ-10"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* 優先度 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">優先度</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(priority === p ? undefined : p)}
                  className={`w-10 h-10 rounded-full font-bold text-sm transition-transform ${
                    priority === p ? `${PRIORITY_COLORS[p]} scale-110 shadow` : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* 推し + ジャンル */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">推し</label>
              <input
                type="text"
                value={oshi}
                onChange={e => setOshi(e.target.value)}
                placeholder="例: キャラ名"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">ジャンル</label>
              <input
                type="text"
                value={genre}
                onChange={e => setGenre(e.target.value)}
                placeholder="例: 漫画・イラスト"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* ピンカラー */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ピンカラー</label>
            <div className="flex gap-2">
              {SPOT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* お品書き画像 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">お品書き画像</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            {imagePreview ? (
              <div className="relative inline-block">
                <img src={imagePreview} alt="お品書き" className="h-32 rounded-lg object-cover border border-gray-200" />
                <button
                  onClick={() => { setImage(undefined); setImagePreview(null); }}
                  className="absolute -top-2 -right-2 bg-gray-600 text-white rounded-full w-5 h-5 flex items-center justify-center"
                >
                  <X size={12} />
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

        <div className="flex gap-2 px-5 py-4 shrink-0">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600">
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            次へ（ピンを配置）
          </button>
        </div>
      </div>
    </div>
  );
}
