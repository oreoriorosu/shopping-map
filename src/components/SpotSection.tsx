import { useState, useEffect, useRef } from 'react';
import { Plus, Check, ChevronDown, ChevronRight, Pencil, MapPin, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { addItem, updateSpot, deleteSpot, useGenres } from '../hooks/useDb';
import { useBlobUrl } from '../hooks/useBlobUrl';
import { AddSpotModal } from './AddSpotModal';
import { ImageModal } from './ImageModal';
import { ItemRow } from './ItemRow';
import type { Spot, ShoppingItem } from '../types';

const PRIORITY_STYLE: Record<string, string> = {
  A: 'bg-red-500 text-white',
  B: 'bg-orange-400 text-white',
  C: 'bg-yellow-400 text-gray-800',
  D: 'bg-gray-400 text-white',
};

interface SpotSectionProps {
  spot: Spot;
  items: ShoppingItem[];
  selected: boolean;
  onSelect: () => void;
  onNavigateToPin: () => void;
  registerScroll: (fn: () => void) => void;
  reorderMode: boolean;
  visitIndex: number;
  onToggleSpotCheck: () => void;
  showUncheckedOnly: boolean;
  dragHandleProps?: Record<string, unknown>;
}

export function SortableSpotSection(props: Omit<SpotSectionProps, 'dragHandleProps'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.spot.id,
    disabled: !props.reorderMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: isDragging ? ('relative' as const) : undefined,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SpotSection {...props} dragHandleProps={props.reorderMode ? { ...attributes, ...listeners } : undefined} />
    </div>
  );
}

function SpotSection({ spot, items, selected, onSelect, onNavigateToPin, registerScroll, reorderMode, visitIndex, onToggleSpotCheck, showUncheckedOnly, dragHandleProps }: SpotSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const imageUrl = useBlobUrl(spot.image);
  const genres = useGenres() ?? [];
  const visibleItems = showUncheckedOnly ? items.filter(i => !i.checked) : items;
  const checkedCount = items.filter(i => i.checked).length;
  const soldOutCount = items.filter(i => i.soldOut && !i.checked).length;
  const isSpotDone = items.length > 0 ? items.every(i => i.checked || i.soldOut) : spot.checked;

  useEffect(() => {
    registerScroll(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setExpanded(true);
    });
  }, [registerScroll]);

  useEffect(() => {
    if (selected) setExpanded(true);
  }, [selected]);

  const handleAddItem = async () => {
    const name = newName.trim();
    if (!name) return;
    const price = newPrice.trim() ? parseInt(newPrice.trim().replace(/[^0-9]/g, ''), 10) : undefined;
    await addItem(spot.id, name, price);
    setNewName('');
    setNewPrice('');
  };

  const genreColor = genres.find(g => g.id === spot.genreId)?.color;
  const hasMeta = spot.hallName || spot.location || (spot.tags && spot.tags.length > 0) || spot.genreId;

  return (
    <div ref={ref} className={`border-b border-gray-100 ${selected ? 'bg-blue-50' : isSpotDone ? 'bg-gray-100' : 'bg-white'}`}>
      {/* ヘッダー行 */}
      <div className="flex items-center gap-2 px-4 py-3">
        {reorderMode ? (
          <div
            {...(dragHandleProps as React.HTMLAttributes<HTMLDivElement>)}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-blue-500 shrink-0 touch-none"
          >
            <GripVertical size={18} />
          </div>
        ) : (
          <button onClick={() => setExpanded(e => !e)} className="text-gray-400 shrink-0">
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
        )}

        {reorderMode ? (
          <div className="flex items-center gap-1 shrink-0">
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
              {visitIndex}
            </span>
            {spot.priority && (
              <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${PRIORITY_STYLE[spot.priority]}`}>
                {spot.priority}
              </span>
            )}
          </div>
        ) : (
          spot.priority && (
            <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${PRIORITY_STYLE[spot.priority]}`}>
              {spot.priority}
            </span>
          )
        )}

        <button onClick={onSelect} className="flex items-center gap-2 flex-1 text-left min-w-0">
          <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: isSpotDone ? '#9ca3af' : (genreColor ?? '#6b7280') }} />
          <span className={`font-medium truncate ${isSpotDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{spot.name}</span>
          {items.length > 0 && (
            <span className="text-xs text-gray-400 shrink-0">
              {checkedCount}/{items.length}
              {soldOutCount > 0 && <span className="text-red-400 ml-1">{soldOutCount}売切</span>}
            </span>
          )}
        </button>

        {!reorderMode && items.length === 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSpotCheck(); }}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              spot.checked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
            }`}
          >
            {spot.checked && <Check size={12} className="text-white" strokeWidth={3} />}
          </button>
        )}

        {!reorderMode && (
          <button onClick={(e) => { e.stopPropagation(); onNavigateToPin(); }} className="text-gray-300 hover:text-blue-500 shrink-0 p-1">
            <MapPin size={15} />
          </button>
        )}
        {!reorderMode && (
          <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-blue-400 shrink-0 p-1">
            <Pencil size={15} />
          </button>
        )}
      </div>

      {showImageModal && imageUrl && (
        <ImageModal url={imageUrl} onClose={() => setShowImageModal(false)} />
      )}

      {editing && (
        <AddSpotModal
          mapName={spot.hallName ?? ''}
          initialData={{ name: spot.name, hallName: spot.hallName, location: spot.location, priority: spot.priority, tags: spot.tags, genreId: spot.genreId, image: spot.image }}
          onConfirm={async (data) => {
            await updateSpot(spot.id, data);
            setEditing(false);
          }}
          onDelete={async () => {
            await deleteSpot(spot.id);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {!reorderMode && hasMeta && (
        <div className="flex flex-wrap gap-1 px-10 pb-2">
          {spot.hallName && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{spot.hallName}</span>
          )}
          {spot.location && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{spot.location}</span>
          )}
          {spot.tags?.map(tag => (
            <span key={tag} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{tag}</span>
          ))}
          {genreColor && (
            <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: genreColor }}>
              {genres.find(g => g.id === spot.genreId)?.name}
            </span>
          )}
        </div>
      )}

      {!reorderMode && expanded && (
        <div className="flex pb-2">
          <div className="flex-1 min-w-0">
            {visibleItems.map(item => <ItemRow key={item.id} item={item} />)}

            {addingItem ? (
              <div className="px-4 mt-1 space-y-1.5">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') setAddingItem(false); }}
                  onBlur={() => { if (!newName.trim() && !newPrice.trim()) setAddingItem(false); }}
                  placeholder="商品名"
                  className="w-full text-sm px-3 py-2 border border-blue-300 rounded-lg focus:outline-none"
                />
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); }}
                      placeholder="金額（任意）"
                      className="w-full text-sm pl-7 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300"
                    />
                  </div>
                  <button onClick={handleAddItem} disabled={!newName.trim()} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm disabled:opacity-40">
                    追加
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1.5 mx-4 mt-1 text-sm text-gray-400 hover:text-blue-500 py-1"
              >
                <Plus size={15} /> 商品を追加
              </button>
            )}
          </div>

          {imageUrl && (
            <button
              onClick={e => { e.stopPropagation(); setShowImageModal(true); }}
              onTouchStart={e => e.stopPropagation()}
              className="w-[30%] shrink-0 self-stretch pl-1 pr-2 py-1"
            >
              <img
                src={imageUrl}
                alt="お品書き"
                className="w-full h-full object-cover rounded-lg border border-gray-200 min-h-20"
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
