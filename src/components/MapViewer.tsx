import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { Spot } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const SPOT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

interface Props {
  pdfBlob: Blob;
  spots: Spot[];
  selectedSpotId: string | null;
  placingPin: boolean;
  onPinPlace: (x: number, y: number) => void;
  onSpotClick: (spotId: string) => void;
}

export function MapViewer({ pdfBlob, spots, selectedSpotId, placingPin, onPinPlace, onSpotClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1.5);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // PDF読み込み
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      if (cancelled) return;
      pdfRef.current = pdf;
      setTotalPages(pdf.numPages);
      setPage(1);
    })();
    return () => { cancelled = true; };
  }, [pdfBlob]);

  // ページ描画
  useEffect(() => {
    if (!pdfRef.current) return;
    let cancelled = false;
    (async () => {
      const pdfPage = await pdfRef.current!.getPage(page);
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPageSize({ width: viewport.width, height: viewport.height });
      const ctx = canvas.getContext('2d')!;
      await pdfPage.render({ canvasContext: ctx, viewport, canvas: canvas }).promise;
    })();
    return () => { cancelled = true; };
  }, [page, scale, pdfRef.current]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingPin || !pageSize.width) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / pageSize.width;
    const y = (e.clientY - rect.top) / pageSize.height;
    onPinPlace(x, y);
  }, [placingPin, pageSize, onPinPlace]);

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* ツールバー */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white text-sm shrink-0">
        <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">−</button>
        <span className="w-14 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(10, s + 0.25))} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">+</button>
        <button onClick={() => setScale(1.5)} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs">リセット</button>
        {totalPages > 1 && (
          <>
            <span className="ml-auto">ページ</span>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-40">‹</button>
            <span>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-40">›</button>
          </>
        )}
        {placingPin && (
          <span className="ml-auto text-yellow-400 font-medium">📍 クリックでピンを配置</span>
        )}
      </div>

      {/* マップ本体 */}
      <div className="flex-1 overflow-auto">
        <div
          ref={containerRef}
          className={`relative inline-block ${placingPin ? 'cursor-crosshair' : 'cursor-default'}`}
          onClick={handleCanvasClick}
        >
          <canvas ref={canvasRef} />

          {/* ピンオーバーレイ */}
          {pageSize.width > 0 && spots
            .filter(s => s.pin.page === page)
            .map(spot => (
              <SpotPin
                key={spot.id}
                spot={spot}
                pageSize={pageSize}
                selected={spot.id === selectedSpotId}
                onClick={(e) => {
                  e.stopPropagation();
                  onSpotClick(spot.id);
                }}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function SpotPin({ spot, pageSize, selected, onClick }: {
  spot: Spot;
  pageSize: { width: number; height: number };
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const x = spot.pin.x * pageSize.width;
  const y = spot.pin.y * pageSize.height;

  return (
    <div
      onClick={onClick}
      className="absolute flex flex-col items-center"
      style={{ left: x, top: y, transform: 'translate(-50%, -100%)', zIndex: 10 }}
    >
      <div
        className={`text-white text-xs font-bold px-1.5 py-0.5 rounded whitespace-nowrap mb-0.5 shadow ${selected ? 'ring-2 ring-white' : ''}`}
        style={{ background: spot.color }}
      >
        {spot.name}
      </div>
      <div
        className="w-3 h-3 rotate-45 -mt-1"
        style={{ background: spot.color }}
      />
    </div>
  );
}

export { SPOT_COLORS };
