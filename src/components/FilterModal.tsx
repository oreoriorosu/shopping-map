import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Genre } from '../types';

const PRIORITY_COLOR: Record<string, { bg: string; text: string }> = {
  A: { bg: '#1e293b', text: '#fff' },
  B: { bg: '#475569', text: '#fff' },
  C: { bg: '#94a3b8', text: '#fff' },
  D: { bg: '#cbd5e1', text: '#475569' },
};

export interface FilterState {
  filterPriorities: Set<string>;
  filterGenreIds: Set<string>;
  filterTags: Set<string>;
  hideDone: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  current: FilterState;
  allTags: string[];
  allGenres: Genre[];
  onApply: (state: FilterState) => void;
}

export function FilterModal({ isOpen, onClose, current, allTags, allGenres, onApply }: Props) {
  const [draft, setDraft] = useState<FilterState>({
    filterPriorities: new Set(),
    filterGenreIds: new Set(),
    filterTags: new Set(),
    hideDone: false,
  });

  useEffect(() => {
    if (isOpen) {
      setDraft({
        filterPriorities: new Set(current.filterPriorities),
        filterGenreIds: new Set(current.filterGenreIds),
        filterTags: new Set(current.filterTags),
        hideDone: current.hideDone,
      });
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const togglePriority = (p: string) => {
    setDraft(prev => {
      const next = new Set(prev.filterPriorities);
      if (next.has(p)) next.delete(p); else next.add(p);
      return { ...prev, filterPriorities: next };
    });
  };

  const toggleGenre = (id: string) => {
    setDraft(prev => {
      const next = new Set(prev.filterGenreIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, filterGenreIds: next };
    });
  };

  const toggleTag = (tag: string) => {
    setDraft(prev => {
      const next = new Set(prev.filterTags);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return { ...prev, filterTags: next };
    });
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const activeCount =
    draft.filterPriorities.size + draft.filterGenreIds.size + draft.filterTags.size + (draft.hideDone ? 1 : 0);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full bg-white rounded-t-2xl shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-body">フィルター</span>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="px-5 py-4 space-y-5">
          {/* 完了非表示 */}
          <div>
            <p className="text-label font-semibold text-gray-500 uppercase tracking-wide mb-2.5">表示</p>
            <button
              onClick={() => setDraft(prev => ({ ...prev, hideDone: !prev.hideDone }))}
              className={`text-body px-4 py-2 rounded-full transition-colors ${
                draft.hideDone
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-500'
              }`}
            >
              完了非表示
            </button>
          </div>

          {/* 優先度 */}
          <div>
            <p className="text-label font-semibold text-gray-500 uppercase tracking-wide mb-2.5">優先度</p>
            <div className="flex items-center gap-2">
              {(['A', 'B', 'C', 'D'] as const).map(p => {
                const active = draft.filterPriorities.has(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePriority(p)}
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-body transition-opacity"
                    style={{
                      background: PRIORITY_COLOR[p].bg,
                      color: PRIORITY_COLOR[p].text,
                      opacity: active ? 1 : 0.3,
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ジャンル */}
          {allGenres.length > 0 && (
            <div>
              <p className="text-label font-semibold text-gray-500 uppercase tracking-wide mb-2.5">ジャンル</p>
              <div className="flex flex-wrap gap-2">
                {allGenres.map(genre => {
                  const active = draft.filterGenreIds.has(genre.id);
                  return (
                    <button
                      key={genre.id}
                      onClick={() => toggleGenre(genre.id)}
                      className="text-body px-4 py-2 rounded-full font-medium transition-opacity"
                      style={{
                        background: genre.color,
                        color: '#fff',
                        opacity: active ? 1 : 0.3,
                      }}
                    >
                      {genre.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* タグ */}
          {allTags.length > 0 && (
            <div>
              <p className="text-label font-semibold text-gray-500 uppercase tracking-wide mb-2.5">タグ</p>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => {
                  const active = draft.filterTags.has(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`text-body px-4 py-2 rounded-full transition-colors ${
                        active
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-500'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 pb-8 pt-1">
          <button
            onClick={handleApply}
            className="w-full py-3 bg-blue-500 text-white rounded-full font-semibold text-body hover:bg-blue-600 active:bg-blue-700 transition-colors"
          >
            {activeCount > 0 ? `適用（${activeCount}件）` : '適用'}
          </button>
        </div>
      </div>
    </div>
  );
}
