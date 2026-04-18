import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { updateSpot } from '../hooks/useDb';
import type { Spot, ShoppingItem } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export const SPOT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

const PRIORITY_COLOR: Record<string, { bg: string; text: string }> = {
  A: { bg: '#ef4444', text: '#fff' },
  B: { bg: '#fb923c', text: '#fff' },
  C: { bg: '#facc15', text: '#1f2937' },
  D: { bg: '#9ca3af', text: '#fff' },
};

interface TransformState { scale: number; posX: number; posY: number }

interface Props {
  pdfBlob: Blob;
  spots: Spot[];
  selectedSpotId: string | null;
  placingPin: boolean;
  onPinPlace: (x: number, y: number) => void;
  onSpotClick: (spotId: string) => void;
  doneSpotIds?: Set<string>;
  savedTransform?: TransformState;
  onTransformChange?: (t: TransformState) => void;
  itemsBySpot?: Record<string, ShoppingItem[]>;
}

interface Pos { x: number; y: number }

const BASE_RENDER_SCALE = 2.0;

export function MapViewer({ pdfBlob, spots, selectedSpotId, placingPin, onPinPlace, onSpotClick, doneSpotIds, savedTransform, onTransformChange, itemsBySpot }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [currentScale, setCurrentScale] = useState(1);

  // pendingTransform: set when new PDF loads, consumed when pageSize updates
  const pendingTransformRef = useRef<TransformState | 'reset' | null>(null);
  const savedTransformRef = useRef(savedTransform);
  savedTransformRef.current = savedTransform;

  // ピン配置
  const [previewPin, setPreviewPin] = useState<Pos | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActive = useRef(false);
  const lastTouchEndTime = useRef(0);

  // ピン移動
  const [draggingSpotId, setDraggingSpotId] = useState<string | null>(null);
  const [draggingPos, setDraggingPos] = useState<Pos | null>(null);
  const draggingPosRef = useRef<Pos | null>(null);
  draggingPosRef.current = draggingPos;
  const pageRef = useRef(page);
  pageRef.current = page;

  // ポップアップ
  const [popupSpotId, setPopupSpotId] = useState<string | null>(null);

  // ─── PDF load ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const buf = await pdfBlob.arrayBuffer();
      const loaded = await pdfjsLib.getDocument({
        data: buf,
        cMapUrl: '/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/standard_fonts/',
      }).promise;
      if (cancelled) return;
      pendingTransformRef.current = savedTransformRef.current ?? 'reset';
      setPdf(loaded);
      setTotalPages(loaded.numPages);
      setPage(1);
    })();
    return () => { cancelled = true; };
  }, [pdfBlob]);

  // ─── Apply pending transform after pageSize updates ──────────
  useEffect(() => {
    if (pageSize.width === 0 || pendingTransformRef.current === null) return;
    const t = pendingTransformRef.current;
    pendingTransformRef.current = null;
    requestAnimationFrame(() => {
      if (t === 'reset') {
        transformRef.current?.resetTransform(0);
      } else {
        transformRef.current?.setTransform(t.posX, t.posY, t.scale, 0);
      }
    });
  }, [pageSize]);

  // ─── PDF render ──────────────────────────────────────────────
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      renderTaskRef.current?.cancel();
      const pdfPage = await pdf.getPage(page);
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale: BASE_RENDER_SCALE });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPageSize({ width: viewport.width, height: viewport.height });
      const ctx = canvas.getContext('2d')!;
      const task = pdfPage.render({ canvasContext: ctx, viewport, canvas });
      renderTaskRef.current = task;
      await task.promise.catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [pdf, page]);

  // ─── ピン座標変換 ─────────────────────────────────────────────
  const getCanvasPos = useCallback((clientX: number, clientY: number): Pos | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  // ─── ピン移動 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!draggingSpotId) return;
    const onMove = (e: TouchEvent) => {
      const pos = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY);
      if (pos) setDraggingPos(pos);
    };
    const onEnd = async () => {
      const pos = draggingPosRef.current;
      if (pos) await updateSpot(draggingSpotId, { pin: { x: pos.x, y: pos.y, page: pageRef.current } });
      setDraggingSpotId(null);
      setDraggingPos(null);
    };
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [draggingSpotId, getCanvasPos]);

  // ─── PDF外ピンチを無効化 ──────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const anyOnCanvas = Array.from(e.touches).some(
        t => t.clientX >= rect.left && t.clientX <= rect.right &&
             t.clientY >= rect.top  && t.clientY <= rect.bottom
      );
      if (!anyOnCanvas) e.stopImmediatePropagation();
    };
    container.addEventListener('touchstart', handler, { capture: true, passive: true });
    return () => container.removeEventListener('touchstart', handler, { capture: true });
  }, []);

  // ─── ピン配置タッチハンドラ ───────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!placingPin || e.touches.length !== 1) return;
    const touch = e.touches[0];
    longPressActive.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressActive.current = true;
      const pos = getCanvasPos(touch.clientX, touch.clientY);
      if (pos) setPreviewPin(pos);
      navigator.vibrate?.(30);
    }, 400);
  }, [placingPin, getCanvasPos]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!placingPin || !longPressActive.current || e.touches.length !== 1) return;
    const pos = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY);
    if (pos) setPreviewPin(pos);
  }, [placingPin, getCanvasPos]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearTimeout(longPressTimer.current!);
    if (!placingPin) {
      // ピン配置モードでなければポップアップを閉じる
      if (popupSpotId) setPopupSpotId(null);
      return;
    }
    if (longPressActive.current && previewPin) {
      onPinPlace(previewPin.x, previewPin.y);
      setPreviewPin(null);
    } else if (!longPressActive.current) {
      const touch = e.changedTouches[0];
      const pos = getCanvasPos(touch.clientX, touch.clientY);
      if (pos) onPinPlace(pos.x, pos.y);
    }
    longPressActive.current = false;
    lastTouchEndTime.current = Date.now();
  }, [placingPin, previewPin, getCanvasPos, onPinPlace, popupSpotId]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (popupSpotId) {
      setPopupSpotId(null);
      return;
    }
    if (!placingPin) return;
    // touchend直後に発火する合成clickを無視する
    if (Date.now() - lastTouchEndTime.current < 500) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    if (pos) onPinPlace(pos.x, pos.y);
  }, [placingPin, getCanvasPos, onPinPlace, popupSpotId]);

  const isPanDisabled = placingPin || !!draggingSpotId;

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-gray-800">
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.3}
        maxScale={10}
        limitToBounds={false}
        centerOnInit
        onTransform={(ref) => {
          setCurrentScale(ref.state.scale);
          onTransformChange?.({ scale: ref.state.scale, posX: ref.state.positionX, posY: ref.state.positionY });
        }}
        panning={{ disabled: isPanDisabled, velocityDisabled: false }}
        doubleClick={{ disabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white text-sm shrink-0">
              <button onClick={() => zoomOut()} className="p-1.5 bg-gray-700 rounded-lg hover:bg-gray-600"><ZoomOut size={16} /></button>
              <button onClick={() => zoomIn()} className="p-1.5 bg-gray-700 rounded-lg hover:bg-gray-600"><ZoomIn size={16} /></button>
              <button onClick={() => resetTransform()} className="p-1.5 bg-gray-700 rounded-lg hover:bg-gray-600"><RotateCcw size={14} /></button>
              {totalPages > 1 && (
                <div className="flex items-center gap-1 ml-auto">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 bg-gray-700 rounded-lg disabled:opacity-30"><ChevronLeft size={16} /></button>
                  <span className="text-xs w-12 text-center">{page}/{totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 bg-gray-700 rounded-lg disabled:opacity-30"><ChevronRight size={16} /></button>
                </div>
              )}
            </div>

            <TransformComponent
              wrapperStyle={{ flex: 1, width: '100%', overflow: 'hidden' }}
              contentStyle={{ position: 'relative', cursor: placingPin ? 'crosshair' : 'grab' }}
            >
              <canvas
                ref={canvasRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={handleClick}
              />

              {pageSize.width > 0 && spots
                .filter(s => s.pin.page === page)
                .map(spot => {
                  const isDragging = spot.id === draggingSpotId;
                  const pos = isDragging && draggingPos ? draggingPos : spot.pin;
                  return (
                    <SpotPin
                      key={spot.id}
                      spot={spot}
                      pos={pos}
                      pageSize={pageSize}
                      scale={currentScale}
                      selected={spot.id === selectedSpotId}
                      isDragging={isDragging}
                      done={doneSpotIds?.has(spot.id) ?? false}
                      popupOpen={spot.id === popupSpotId}
                      items={itemsBySpot?.[spot.id] ?? []}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (placingPin) return;
                        setPopupSpotId(prev => prev === spot.id ? null : spot.id);
                      }}
                      onItemClick={(e) => {
                        e.stopPropagation();
                        setPopupSpotId(null);
                        onSpotClick(spot.id);
                      }}
                      onLongPress={() => {
                        navigator.vibrate?.(30);
                        setDraggingSpotId(spot.id);
                        setDraggingPos(spot.pin);
                      }}
                    />
                  );
                })}

              {previewPin && pageSize.width > 0 && (
                <div
                  className="absolute pointer-events-none flex flex-col items-center"
                  style={{ left: previewPin.x * pageSize.width, top: previewPin.y * pageSize.height, transform: `translate(-50%, -100%) scale(${Math.pow(currentScale, -0.6)})`, transformOrigin: 'center bottom', zIndex: 30 }}
                >
                  <div className="bg-gray-700/80 text-white text-xs font-bold px-2 py-0.5 rounded-full">ここに配置</div>
                  <div className="w-2 h-2 rotate-45 -mt-1 bg-gray-700/80" />
                </div>
              )}
            </TransformComponent>
          </div>
        )}
      </TransformWrapper>
    </div>
  );
}

function SpotPin({ spot, pos, pageSize, scale, selected, isDragging, done, popupOpen, items, onClick, onItemClick, onLongPress }: {
  spot: Spot;
  pos: Pos;
  pageSize: { width: number; height: number };
  scale: number;
  selected: boolean;
  isDragging: boolean;
  done: boolean;
  popupOpen: boolean;
  items: ShoppingItem[];
  onClick: (e: React.MouseEvent | React.TouchEvent) => void;
  onItemClick: (e: React.MouseEvent | React.TouchEvent) => void;
  onLongPress: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    didLongPress.current = false;
    timer.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress();
    }, 500);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
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
          style={{ minWidth: 120, maxWidth: 200 }}
          onClick={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
        >
          {items.length === 0 ? (
            <div
              className="px-3 py-2 text-xs font-medium cursor-pointer active:opacity-70 flex items-center gap-1"
              style={{ background: spot.color, color: 'white' }}
              onClick={onItemClick}
              onTouchEnd={onItemClick}
            >
              <span className="truncate">{spot.name}</span>
              <span className="opacity-80 flex-shrink-0">→</span>
            </div>
          ) : (
            <>
              <div
                className="px-3 py-1.5 text-white text-xs font-bold cursor-pointer active:opacity-70 flex items-center justify-between gap-1"
                style={{ background: spot.color }}
                onClick={onItemClick}
                onTouchEnd={onItemClick}
              >
                <span className="truncate">{spot.name}</span>
                <span className="opacity-80 flex-shrink-0 text-xs">→</span>
              </div>
              <ul>
                {items.map(item => (
                  <li
                    key={item.id}
                    className={`px-3 py-1.5 text-xs border-t border-gray-100 cursor-pointer active:bg-blue-50 flex items-center gap-1.5 ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}
                    onClick={onItemClick}
                    onTouchEnd={onItemClick}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full border flex-shrink-0 ${item.checked ? 'bg-gray-300 border-gray-300' : 'border-gray-400'}`} />
                    <span className="truncate">{item.name}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="relative">
        <div
          className={`text-white font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-md ${selected ? 'ring-2 ring-white ring-offset-1' : ''} ${isDragging ? 'scale-110' : ''}`}
          style={{ background: done ? '#9ca3af' : spot.color, fontSize: 11 }}
        >
          {spot.name}
        </div>
        {spot.priority != null && (
          <span
            className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full flex items-center justify-center font-bold"
            style={{ fontSize: 9, background: PRIORITY_COLOR[spot.priority].bg, color: PRIORITY_COLOR[spot.priority].text }}
          >
            {spot.priority}
          </span>
        )}
        {spot.visitOrder != null && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-gray-300 text-gray-700 flex items-center justify-center font-bold" style={{ fontSize: 9 }}>
            {spot.visitOrder}
          </span>
        )}
      </div>
      <div className="w-2 h-2 rotate-45 -mt-1" style={{ background: done ? '#9ca3af' : spot.color }} />
    </div>
  );
}
