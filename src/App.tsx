import { useState, useCallback, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Map, ShoppingCart } from 'lucide-react';
import { db } from './store/db';
import { useMaps, useSpots, useAllSpots, addSpot } from './hooks/useDb';
import { MapViewer } from './components/MapViewer';
import { ShoppingPanel } from './components/ShoppingPanel';
import { MapSelector } from './components/MapSelector';
import { AddSpotModal } from './components/AddSpotModal';

type Tab = 'map' | 'list';
type PlacingState = { color: string; name: string } | null;

export default function App() {
  const maps = useMaps() ?? [];
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [placing, setPlacing] = useState<PlacingState>(null);
  const [tab, setTab] = useState<Tab>('map');
  const [showAddSpot, setShowAddSpot] = useState(false);
  const listScrollRef = useRef<Record<string, () => void>>({});

  // マップごとの最終表示位置（ズーム・パン）を localStorage で永続化
  const transformStates = useRef<Record<string, { scale: number; posX: number; posY: number }>>(
    (() => {
      try { return JSON.parse(localStorage.getItem('mapTransforms') ?? '{}'); }
      catch { return {}; }
    })()
  );

  // maps 読み込み時に先頭マップを自動選択
  useEffect(() => {
    if (!selectedMapId && maps.length > 0) {
      setSelectedMapId(maps[0].id);
    }
  }, [maps, selectedMapId]);

  const spots = useSpots(selectedMapId) ?? [];
  const allSpots = useAllSpots() ?? [];
  const selectedMap = useLiveQuery(
    () => (selectedMapId ? db.maps.get(selectedMapId) : undefined),
    [selectedMapId],
  );

  const handleSelectMap = (id: string) => {
    setSelectedMapId(id);
    setSelectedSpotId(null);
    setPlacing(null);
  };

  const handleStartPlacing = useCallback((color: string, name: string) => {
    setPlacing({ color, name });
    setTab('map');
  }, []);

  const handlePinPlace = useCallback(async (x: number, y: number) => {
    if (!placing || !selectedMapId) return;
    const id = await addSpot({
      mapId: selectedMapId,
      name: placing.name,
      color: placing.color,
      pin: { x, y, page: 1 },
    });
    setPlacing(null);
    setSelectedSpotId(id);
  }, [placing, selectedMapId]);

  // ピンクリック→リストタブへ切り替えてスポットをハイライト
  const handleSpotClick = useCallback((spotId: string) => {
    setSelectedSpotId(spotId);
    setTab('list');
    setTimeout(() => listScrollRef.current[spotId]?.(), 100);
  }, []);

  // リストでスポット選択→別マップなら切り替え
  const handleSelectSpotFromList = useCallback((spotId: string | null) => {
    if (spotId) {
      const spot = allSpots.find(s => s.id === spotId);
      if (spot && spot.mapId !== selectedMapId) {
        setSelectedMapId(spot.mapId);
      }
    }
    setSelectedSpotId(spotId);
  }, [allSpots, selectedMapId]);

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* ヘッダー */}
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 safe-top">
        <span className="font-bold text-gray-800 text-sm">🛍 ShoppingMap</span>
        <div className="flex-1">
          <MapSelector
            maps={maps}
            selectedMapId={selectedMapId}
            onSelect={handleSelectMap}
          />
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-hidden relative">
        {/* マップビュー */}
        <div className={`absolute inset-0 ${tab === 'map' ? 'block' : 'hidden'}`}>
          {!selectedMap ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <div className="text-5xl">🗺️</div>
              <p className="text-base font-medium text-gray-600">マップを選択してください</p>
              <p className="text-sm">ヘッダーからPDFマップを追加できます</p>
            </div>
          ) : (
            <MapViewer
              pdfBlob={selectedMap.blob}
              spots={spots}
              selectedSpotId={selectedSpotId}
              placingPin={!!placing}
              onPinPlace={handlePinPlace}
              onSpotClick={handleSpotClick}
              savedTransform={selectedMapId ? transformStates.current[selectedMapId] : undefined}
              onTransformChange={(t) => {
                if (selectedMapId) {
                  transformStates.current[selectedMapId] = t;
                  localStorage.setItem('mapTransforms', JSON.stringify(transformStates.current));
                }
              }}
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
            scrollRefMap={listScrollRef.current}
          />
        </div>

        {/* FAB: 店舗追加（マップ選択時のみ） */}
        {selectedMap && !placing && tab === 'map' && (
          <button
            onClick={() => setShowAddSpot(true)}
            className="absolute bottom-4 right-4 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20"
          >
            +
          </button>
        )}

        {/* ピン配置中のバナー */}
        {placing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-sm font-medium px-4 py-2 rounded-full shadow z-20">
            📍 マップをタップしてピンを配置
          </div>
        )}
      </main>

      {/* ボトムタブ（常に表示） */}
      {maps.length > 0 && (
        <nav className="shrink-0 bg-white border-t border-gray-200 flex safe-bottom">
          <TabButton active={tab === 'map'} onClick={() => setTab('map')} icon={<Map size={20} />} label="マップ" />
          <TabButton active={tab === 'list'} onClick={() => setTab('list')} icon={<ShoppingCart size={20} />} label="リスト" />
        </nav>
      )}

      {/* 店舗追加モーダル */}
      {showAddSpot && (
        <AddSpotModal
          usedColors={spots.map(s => s.color)}
          onConfirm={(name, color) => {
            setShowAddSpot(false);
            handleStartPlacing(color, name);
          }}
          onCancel={() => setShowAddSpot(false)}
        />
      )}
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
      className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs ${
        active ? 'text-blue-500' : 'text-gray-400'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
