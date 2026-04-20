import { useRef } from 'react';
import { useBlobUrl } from '../hooks/useBlobUrl';
import type { Spot, ShoppingItem } from '../types';

const PRIORITY_COLOR: Record<string, { bg: string; text: string }> = {
  A: { bg: '#ef4444', text: '#fff' },
  B: { bg: '#fb923c', text: '#fff' },
  C: { bg: '#facc15', text: '#1f2937' },
  D: { bg: '#9ca3af', text: '#fff' },
};

interface Pos { x: number; y: number }

interface Props {
  spot: Spot;
  pos: Pos;
  pageSize: { width: number; height: number };
  scale: number;
  selected: boolean;
  isDragging: boolean;
  done: boolean;
  popupOpen: boolean;
  items: ShoppingItem[];
  editMode: boolean;
  onClick: (e: React.MouseEvent | React.TouchEvent) => void;
  onItemClick: (e: React.MouseEvent | React.TouchEvent) => void;
  onLongPress: () => void;
  onImageClick: (url: string) => void;
}

export function SpotPin({ spot, pos, pageSize, scale, selected, isDragging, done, popupOpen, items, editMode, onClick, onItemClick, onLongPress, onImageClick }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const imageUrl = useBlobUrl(spot.image);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!editMode) return;
    didLongPress.current = false;
    timer.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress();
    }, 500);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    clearTimeout(timer.current!);
    if (!isDragging && !didLongPress.current) onClick(e);
  };

  return (
    <div
      className="absolute flex flex-col items-center select-none touch-none"
      style={{
        left: pos.x * pageSize.width,
        top: pos.y * pageSize.height,
        transform: `translate(-50%, -100%) scale(${Math.pow(scale, -0.6)})`,
        transformOrigin: 'center bottom',
        zIndex: isDragging ? 20 : popupOpen ? 30 : 10,
      }}
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchMove={() => clearTimeout(timer.current!)}
      onTouchEnd={handleTouchEnd}
    >
      {/* お品書きポップアップ */}
      {popupOpen && (
        <div
          className="mb-1 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200"
          style={{ minWidth: 240, maxWidth: 400 }}
          onClick={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
        >
          <div
            className="px-6 py-3 text-white text-sm font-bold cursor-pointer active:opacity-70 flex items-center justify-between gap-2"
            style={{ background: spot.color }}
            onClick={onItemClick}
            onTouchEnd={onItemClick}
          >
            <span className="truncate">{spot.name}</span>
            <span className="opacity-80 flex-shrink-0 text-sm">→</span>
          </div>
          {imageUrl && (
            <div
              className="cursor-pointer active:opacity-80"
              onClick={e => { e.stopPropagation(); onImageClick(imageUrl); }}
              onTouchEnd={e => { e.stopPropagation(); onImageClick(imageUrl); }}
            >
              <img src={imageUrl} alt="お品書き" className="w-full object-cover" style={{ maxHeight: 240 }} />
            </div>
          )}
          {items.length > 0 && (
            <ul>
              {items.map(item => (
                <li
                  key={item.id}
                  className={`px-6 py-3 text-sm border-t border-gray-100 cursor-pointer active:bg-blue-50 flex items-center gap-3 ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}
                  onClick={onItemClick}
                  onTouchEnd={onItemClick}
                >
                  <span className={`w-5 h-5 rounded-full border flex-shrink-0 ${item.checked ? 'bg-gray-300 border-gray-300' : 'border-gray-400'}`} />
                  <span className="truncate">{item.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="relative">
        <div
          className={`text-white font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-md ${selected ? 'ring-2 ring-white ring-offset-1' : ''} ${isDragging ? 'scale-110' : ''} ${editMode && !isDragging ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
          style={{ background: done ? '#9ca3af' : spot.color, fontSize: 11 }}
        >
          {spot.name}
        </div>
        {spot.priority != null && (
          <span
            className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full flex items-center justify-center font-bold"
            style={{ fontSize: 9, background: done ? '#9ca3af' : PRIORITY_COLOR[spot.priority].bg, color: done ? 'white' : PRIORITY_COLOR[spot.priority].text }}
          >
            {spot.priority}
          </span>
        )}
      </div>
      <div className="w-2 h-2 rotate-45 -mt-1" style={{ background: done ? '#9ca3af' : spot.color }} />
    </div>
  );
}
