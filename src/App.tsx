import { useState, useCallback, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Map, ShoppingCart, Settings } from 'lucide-react';
import { db } from './store/db';
import { useMaps, useSpots, useAllSpots, useAllItemsByMap, addSpot, useGenres, useAllTags } from './hooks/useDb';
import { MapViewer } from './components/MapViewer';
import { ShoppingPanel } from './components/ShoppingPanel';
import { MapSelector } from './components/MapSelector';
import { AddSpotModal } from './components/AddSpotModal';
import { SettingsScreen } from './components/SettingsScreen';
import { FilterModal, type FilterState } from './components/FilterModal';

type Tab = 'map' | 'list';
type Priority = 'A' | 'B' | 'C' | 'D';

export default function App() {
  const maps = useMaps() ?? [];
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [tab, setTab] = useState<Tab>('map');
  const [showAddSpot, setShowAddSpot] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterPriorities, setFilterPriorities] = useState<Set<Priority>>(new Set());
  const [filterGenreIds, setFilterGenreIds] = useState<Set<string>>(new Set());
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());
  const [hideDone, setHideDone] = useState(false);
  const [openPopupSpotId, setOpenPopupSpotId] = useState<{ id: string; nonce: number } | null>(null);
  const listScrollRef = useRef<Record<string, () => void>>({});

  // 戻るジェスチャー・バックキーでアプリが閉じるのを防ぐ
  const handleBackRef = useRef<() => void>(() => {});
  handleBackRef.current = () => {
    if (showFilterModal) {
      setShowFilterModal(false);
    } else if (showAddSpot) {
      setShowAddSpot(false);
      setPendingPin(null);
    } else if (placing) {
      setPlacing(false);
    } else if (tab === 'list') {
      setTab('map');
    }
    history.pushState(null, '');
  };
  useEffect(() => {
    history.pushState(null, '');
    const handler = () => handleBackRef.current();
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // マップごとの最終表示位置（ズーム・パン）を localStorage で永続化
  const transformStates = useRef<Record<string, { scale: number; posX: number; posY: number }>>(
    (() => {
      try { return JSON.parse(localStorage.getItem('mapTransforms') ?? '{}'); }
      catch { return {}; }
    })()
  );

  useEffect(() => {
    if (!selectedMapId && maps.length > 0) {
      setSelectedMapId(maps[0].id);
    }
  }, [maps, selectedMapId]);

  const genres = useGenres() ?? [];
  const allTags = useAllTags() ?? [];
  const spots = useSpots(selectedMapId) ?? [];
  const allSpots = useAllSpots() ?? [];
  const itemsBySpot = useAllItemsByMap(selectedMapId) ?? {};
  const doneSpotIds = new Set([
    ...Object.entries(itemsBySpot)
      .filter(([, items]) => items.length > 0 && items.every(i => i.checked || i.soldOut))
      .map(([id]) => id),
    ...spots.filter(s => s.checked && (itemsBySpot[s.id]?.length ?? 0) === 0).map(s => s.id),
  ]);

  const filteredSpots = spots.filter(s => {
    if (hideDone && doneSpotIds.has(s.id)) return false;
    if (filterPriorities.size > 0 && (s.priority == null || !filterPriorities.has(s.priority as Priority))) return false;
    if (filterGenreIds.size > 0 && (s.genreId == null || !filterGenreIds.has(s.genreId))) return false;
    if (filterTags.size > 0 && ![...filterTags].every(t => (s.tags ?? []).includes(t))) return false;
    return true;
  });

  const handleApplyFilter = useCallback((state: FilterState) => {
    setFilterPriorities(new Set(state.filterPriorities) as Set<Priority>);
    setFilterGenreIds(new Set(state.filterGenreIds));
    setFilterTags(new Set(state.filterTags));
    setHideDone(state.hideDone);
  }, []);

  const selectedMap = useLiveQuery(
    () => (selectedMapId ? db.maps.get(selectedMapId) : undefined),
    [selectedMapId],
  );

  const handleSelectMap = (id: string) => {
    setSelectedMapId(id);
    setSelectedSpotId(null);
    setPlacing(false);
  };

  const handlePinPlace = useCallback((x: number, y: number) => {
    if (!placing || !selectedMapId) return;
    setPendingPin({ x, y });
    setShowAddSpot(true);
  }, [placing, selectedMapId]);

  const handleSpotClick = useCallback((spotId: string) => {
    setSelectedSpotId(spotId);
    setTab('list');
    setTimeout(() => listScrollRef.current[spotId]?.(), 100);
  }, []);

  const handleSelectSpotFromList = useCallback((spotId: string | null) => {
    if (spotId) {
      const spot = allSpots.find(s => s.id === spotId);
      if (spot && spot.mapId !== selectedMapId) {
        setSelectedMapId(spot.mapId);
      }
    }
    setSelectedSpotId(spotId);
  }, [allSpots, selectedMapId]);

  const handleNavigateToPin = useCallback((spotId: string) => {
    const spot = allSpots.find(s => s.id === spotId);
    if (spot && spot.mapId !== selectedMapId) {
      setSelectedMapId(spot.mapId);
    }
    setSelectedSpotId(spotId);
    setOpenPopupSpotId(prev => ({ id: spotId, nonce: (prev?.nonce ?? 0) + 1 }));
    setTab('map');
  }, [allSpots, selectedMapId]);

  const filterActiveCount =
    filterPriorities.size + filterGenreIds.size + filterTags.size + (hideDone ? 1 : 0);

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* ヘッダー */}
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 safe-top" style={{ touchAction: 'manipulation' }}>
        <span className="flex items-center gap-1.5 font-bold text-gray-800 text-body">
          <img src="/favicon.svg" alt="meguri" className="w-6 h-6 rounded-md" />
          meguri
        </span>
        <div className="flex-1">
          <MapSelector
            maps={maps}
            selectedMapId={selectedMapId}
            onSelect={handleSelectMap}
          />
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2.5 text-gray-400 hover:text-blue-500 active:text-blue-600"
          title="設定"
        >
          <Settings size={18} />
        </button>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-hidden relative">
        {/* マップビュー */}
        <div className={`absolute inset-0 ${tab === 'map' ? 'block' : 'hidden'}`}>
          {!selectedMap ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <div className="text-5xl">🗺️</div>
              <p className="text-base font-medium text-gray-600">マップを選択してください</p>
              <p className="text-body">ヘッダーからPDFマップを追加できます</p>
            </div>
          ) : (
            <MapViewer
              pdfBlob={selectedMap.blob}
              fileType={selectedMap.fileType}
              spots={filteredSpots}
              genres={genres}
              selectedSpotId={selectedSpotId}
              placingPin={!!placing}
              pendingPinPos={pendingPin}
              onPinPlace={handlePinPlace}
              onSpotClick={handleSpotClick}
              doneSpotIds={doneSpotIds}
              itemsBySpot={itemsBySpot}
              savedTransform={selectedMapId ? transformStates.current[selectedMapId] : undefined}
              onTransformChange={(t) => {
                if (selectedMapId) {
                  transformStates.current[selectedMapId] = t;
                  localStorage.setItem('mapTransforms', JSON.stringify(transformStates.current));
                }
              }}
              filterActiveCount={filterActiveCount}
              onOpenFilter={() => setShowFilterModal(true)}
              openPopupSpotId={openPopupSpotId}
            />
          )}
        </div>

        {/* リストビュー（全マップ横断） */}
        <div className={`absolute inset-0 overflow-y-auto ${tab === 'list' ? 'block' : 'hidden'}`}>
          <ShoppingPanel
            maps={maps}
            spots={allSpots}
            selectedSpotId={selectedSpotId}
            onSelectSpot={handleSelectSpotFromList}
            onNavigateToPin={handleNavigateToPin}
            scrollRefMap={listScrollRef.current}
            filterPriorities={filterPriorities}
            filterGenreIds={filterGenreIds}
            filterTags={filterTags}
            hideDone={hideDone}
            filterActiveCount={filterActiveCount}
            onOpenFilter={() => setShowFilterModal(true)}
          />
        </div>

        {/* FAB: 店舗追加（マップ選択時のみ） */}
        {selectedMap && !placing && tab === 'map' && (
          <button
            onClick={() => setPlacing(true)}
            className="absolute bottom-4 right-4 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20"
          >
            +
          </button>
        )}

        {/* ピン配置中のバナー */}
        {placing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-body font-medium px-4 py-2.5 rounded-full shadow z-20">
            📍 マップをタップしてピンを配置
          </div>
        )}
      </main>

      {/* ボトムタブ（常に表示） */}
      {maps.length > 0 && (
        <nav className="shrink-0 bg-white border-t border-gray-200 flex safe-bottom" style={{ touchAction: 'manipulation' }}>
          <TabButton active={tab === 'map'} onClick={() => setTab('map')} icon={<Map size={20} />} label="マップ" />
          <TabButton active={tab === 'list'} onClick={() => setTab('list')} icon={<ShoppingCart size={20} />} label="リスト" />
        </nav>
      )}

      {/* サークル追加モーダル */}
      {showAddSpot && selectedMap && pendingPin && (
        <AddSpotModal
          mapName={selectedMap.name}
          onConfirm={async (data) => {
            const id = await addSpot({
              mapId: selectedMapId!,
              pin: { x: pendingPin.x, y: pendingPin.y, page: 1 },
              ...data,
            });
            setShowAddSpot(false);
            setPendingPin(null);
            setPlacing(false);
            setSelectedSpotId(id);
          }}
          onCancel={() => {
            setShowAddSpot(false);
            setPendingPin(null);
            setPlacing(false);
          }}
        />
      )}

      {showSettings && (
        <SettingsScreen
          maps={maps}
          selectedMapId={selectedMapId}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* 共通フィルターモーダル */}
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        current={{ filterPriorities, filterGenreIds, filterTags, hideDone }}
        allTags={allTags}
        allGenres={genres}
        onApply={handleApplyFilter}
      />
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-label ${
        active ? 'text-blue-500' : 'text-gray-400'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
