import { useState } from 'react';
import { SPOT_COLORS } from './MapViewer';

interface Props {
  usedColors: string[];
  onConfirm: (name: string, color: string) => void;
  onCancel: () => void;
}

export function AddSpotModal({ usedColors, onConfirm, onCancel }: Props) {
  const [name, setName] = useState('');
  const defaultColor = SPOT_COLORS.find(c => !usedColors.includes(c)) ?? SPOT_COLORS[0];
  const [color, setColor] = useState(defaultColor);

  const handleConfirm = () => {
    const n = name.trim();
    if (!n) return;
    onConfirm(n, color);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
        <h3 className="text-base font-semibold text-gray-800 mb-4">店舗を追加</h3>

        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          placeholder="店舗名を入力"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 mb-4"
        />

        <div className="flex gap-2 mb-5">
          {SPOT_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            次へ（マップにピンを置く）
          </button>
        </div>
      </div>
    </div>
  );
}
