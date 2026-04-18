import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './store/db';
import { useMaps, useSpots, addSpot } from './hooks/useDb';
import { MapList } from './components/MapList';
import { MapViewer } from './components/MapViewer';
import { ShoppingPanel } from './components/ShoppingPanel';

type PlacingState = { color: string; name: string } | null;

export default function App() {
  const maps = useMaps() ?? [];
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [placing, setPlacing] = useState<PlacingState>(null);

  const spots = useSpots(selectedMapId) ?? [];
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

  const handleSpotClick = useCallback((spotId: string) => {
    setSelectedSpotId(prev => prev === spotId ? null : spotId);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <MapList maps={maps} selectedMapId={selectedMapId} onSelect={handleSelectMap} />

      {selectedMap ? (
        <>
          <div className="flex-1 overflow-hidden">
            <MapViewer
              pdfBlob={selectedMap.blob}
              spots={spots}
              selectedSpotId={selectedSpotId}
              placingPin={!!placing}
              onPinPlace={handlePinPlace}
              onSpotClick={handleSpotClick}
            />
          </div>

          <div className="w-72 shrink-0 border-l border-gray-200 overflow-hidden">
            <ShoppingPanel
              mapId={selectedMapId!}
              spots={spots}
              selectedSpotId={selectedSpotId}
              onSelectSpot={setSelectedSpotId}
              onStartPlacingPin={handleStartPlacing}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-3">🗺️</div>
            <p className="text-lg font-medium text-gray-600">マップを選択してください</p>
            <p className="text-sm mt-1">左サイドバーからPDFマップを追加できます</p>
          </div>
        </div>
      )}
    </div>
  );
}
