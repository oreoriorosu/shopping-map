import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Pencil, SlidersHorizontal } from 'lucide-react';
import { updateSpot } from '../hooks/useDb';
import { SpotPin } from './SpotPin';
import type { Spot, ShoppingItem, Genre } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export const GENRE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

const FILTER_BTN_COLOR: Record<string, { bg: string; text: string }> = {
  A: { bg: '#1e293b', text: '#fff' },
  B: { bg: '#475569', text: '#fff' },
  C: { bg: '#94a3b8', text: '#fff' },
  D: { bg: '#cbd5e1', text: '#475569' },
};

export function spotColor(spot: Spot, genres: Genre[], done: boolean): string {
  if (done) return '#9ca3af';
  return genres.find(g => g.id === spot.genreId)?.color ?? '#6b7280';
}

interface TransformState { scale: number; posX: number; posY: number }

interface Props {
  pdfBlob: Blob;
  fileType?: 'pdf' | 'image';
  spots: Spot[];
  genres: Genre[];
  selectedSpotId: string | null;
  placingPin: boolean;
  pendingPinPos?: { x: number; y: number } | null;
  onPinPlace: (x: number, y: number) => void;
  onSpotClick: (spotId: string) => void;
  doneSpotIds?: Set<string>;
  savedTransform?: TransformState;
  onTransformChange?: (t: TransformState) => void;
  itemsBySpot?: Record<string, ShoppingItem[]>;
  filterPriorities?: Set<string>;
  filterTags?: Set<string>;
  allTags?: string[];
  hideDone?: boolean;
  onFilterPriorityToggle?: (p: 'A' | 'B' | 'C' | 'D') => void;
  onFilterTagToggle?: (tag: string) => void;
  onHideDoneToggle?: () => void;
  openPopupSpotId?: { id: string; nonce: number } | null;
}

interface Pos { x: number; y: number }

const BASE_RENDER_SCALE = 2.0;

export function MapViewer({ pdfBlob, fileType, spots, genres, selectedSpotId, placingPin, pendingPinPos, onPinPlace, onSpotClick, doneSpotIds, savedTransform, onTransformChange, itemsBySpot, filterPriorities, filterTags, allTags, hideDone, onFilterPriorityToggle, onFilterTagToggle, onHideDoneToggle, openPopupSpotId }: Props) {
  const isImage = fileType === 'image';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformAreaRef = useRef<HTMLDivElement>(null);

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
  const touchStartPos = useRef<{ clientX: number; clientY: number } | null>(null);
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
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // リストからのナビゲーション：ポップアップ自動オープン＋ピンへセンタリング
  const pendingCenterRef = useRef<Spot | null>(null);

  const doCenterOnSpot = useCallback((spot: Spot, ps: { width: number; height: number }) => {
    const w = window.innerWidth;
    const h = window.innerHeight - 120;
    const targetScale = Math.max(transformRef.current?.instance.getContext().state.scale ?? 1, 2.5);
    const posX = w / 2 - spot.pin.x * ps.width * targetScale;
    const posY = h / 2 - spot.pin.y * ps.height * targetScale;
    transformRef.current?.setTransform(posX, posY, targetScale, 400);
  }, []);

  // spots更新を待ってポップアップ・ページ切替・センタリングを実行
  useEffect(() => {
    if (!openPopupSpotId) return;
    const spot = spots.find(s => s.id === openPopupSpotId.id);
    if (!spot) return; // 別マップのspots未更新時は次のspots変化で再試行
    setPopupSpotId(spot.id);
    setPage(spot.pin.page);
    if (spot.pin.page === page && pageSize.width > 0) {
      doCenterOnSpot(spot, pageSize);
    } else {
      pendingCenterRef.current = spot; // pageSize確定後に実行
    }
  }, [openPopupSpotId, spots]); // eslint-disable-line react-hooks/exhaustive-deps

  // ページ切替・PDFリロード後にセンタリング実行
  useEffect(() => {
    const spot = pendingCenterRef.current;
    if (!spot || pageSize.width === 0 || spot.pin.page !== page) return;
    pendingCenterRef.current = null;
    doCenterOnSpot(spot, pageSize);
  }, [pageSize, page, doCenterOnSpot]);

  // ピン編集モード
  const [editMode, setEditMode] = useState(false);

  // 画像モーダル
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);

  // ─── 画像マップ用 ObjectURL ───────────────────────────────────
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(pdfBlob);
    setImgUrl(url);
    setTotalPages(1);
    setPage(1);
    pendingTransformRef.current = savedTransformRef.current ?? 'reset';
    return () => URL.revokeObjectURL(url);
  }, [pdfBlob, isImage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── PDF load ────────────────────────────────────────────────
  useEffect(() => {
    if (isImage) return;
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
  }, [pdfBlob, isImage]);

  // ─── Apply pending transform after pageSize updates ──────────
  useEffect(() => {
    if (pageSize.width === 0 || pendingTransformRef.current === null) return;
    const t = pendingTransformRef.current;
    pendingTransformRef.current = null;
    requestAnimationFrame(() => {
      const ref = transformRef.current;
      if (!ref) return;
      if (t === 'reset') {
        const wrapper = ref.instance.wrapperComponent;
        const ww = wrapper?.offsetWidth ?? 0;
        const wh = wrapper?.offsetHeight ?? 0;
        if (ww > 0 && wh > 0) {
          const fitScale = Math.min(ww / pageSize.width, wh / pageSize.height);
          ref.setTransform(
            (ww - pageSize.width * fitScale) / 2,
            (wh - pageSize.height * fitScale) / 2,
            fitScale,
            0,
          );
        } else {
          ref.resetTransform(0);
        }
      } else {
        ref.setTransform(t.posX, t.posY, t.scale, 0);
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
    const el = isImage ? imgRef.current : canvasRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, [isImage]);

  // ─── ピン移動 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!draggingSpotId) return;
    const onMove = (e: TouchEvent) => {
      const pos = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY);
      if (pos) setDraggingPos(pos);
    };
    const onEnd = async () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
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

  // マップエリア外のピンチを TransformWrapper に届かせない
  // passive:false + capture で react-zoom-pan-pinch の bubble listener より先に実行し、
  // 全指がマップ内にない場合は stopImmediatePropagation で伝播を止める
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: Event) => {
      const te = e as TouchEvent;
      if (te.touches.length < 2) return;
      const area = transformAreaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      const allInArea = Array.from(te.touches).every(
        t => t.clientX >= rect.left && t.clientX <= rect.right &&
             t.clientY >= rect.top  && t.clientY <= rect.bottom
      );
      if (!allInArea) e.stopImmediatePropagation();
    };
    container.addEventListener('touchstart', handler, { capture: true, passive: false });
    return () => container.removeEventListener('touchstart', handler, { capture: true });
  }, []);

  // ─── ピン配置タッチハンドラ ───────────────────────────────────
  const TAP_THRESHOLD = 10; // px — これ以下の移動はタップと判定

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!placingPin || e.touches.length !== 1) return;
    touchStartPos.current = { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
  }, [placingPin]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!placingPin) {
      if (popupSpotId) setPopupSpotId(null);
      return;
    }
    const start = touchStartPos.current;
    touchStartPos.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.clientX;
    const dy = touch.clientY - start.clientY;
    if (Math.sqrt(dx * dx + dy * dy) > TAP_THRESHOLD) return; // スクロール操作
    const pos = getCanvasPos(touch.clientX, touch.clientY);
    if (pos) {
      // ピン位置を画面上部へスクロール（モーダルが下半分を占めるため上1/3に配置）
      const scale = transformRef.current?.instance.getContext().state.scale ?? 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      transformRef.current?.setTransform(
        w / 2 - pos.x * pageSize.width * scale,
        h / 5 - pos.y * pageSize.height * scale,
        scale,
        300,
      );
      onPinPlace(pos.x, pos.y);
    }
    lastTouchEndTime.current = Date.now();
  }, [placingPin, getCanvasPos, onPinPlace, popupSpotId, pageSize]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (popupSpotId) {
      setPopupSpotId(null);
      return;
    }
    if (!placingPin) return;
    // touchend直後に発火する合成clickを無視する
    if (Date.now() - lastTouchEndTime.current < 500) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    if (pos) {
      const scale = transformRef.current?.instance.getContext().state.scale ?? 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      transformRef.current?.setTransform(
        w / 2 - pos.x * pageSize.width * scale,
        h / 5 - pos.y * pageSize.height * scale,
        scale,
        300,
      );
      onPinPlace(pos.x, pos.y);
    }
  }, [placingPin, getCanvasPos, onPinPlace, popupSpotId, pageSize]);

  const isPanDisabled = !!draggingSpotId;

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-gray-800">
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.3}
        maxScale={10}
        limitToBounds={!pendingPinPos}
        onTransform={(ref) => {
          setCurrentScale(ref.state.scale);
          onTransformChange?.({ scale: ref.state.scale, posX: ref.state.positionX, posY: ref.state.positionY });
        }}
        panning={{ disabled: isPanDisabled, velocityDisabled: false }}
        doubleClick={{ disabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className="flex flex-col h-full">
            {/* ツールバー */}
            {(() => {
              const filterActiveCount =
                (filterPriorities?.size ?? 0) + (hideDone ? 1 : 0) + (filterTags?.size ?? 0);
              return (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white text-body shrink-0" style={{ touchAction: 'manipulation' }}>
                  <button onClick={() => zoomOut()} className="p-2.5 bg-gray-700 rounded-lg hover:bg-gray-600"><ZoomOut size={18} /></button>
                  <button onClick={() => zoomIn()} className="p-2.5 bg-gray-700 rounded-lg hover:bg-gray-600"><ZoomIn size={18} /></button>
                  <button onClick={() => resetTransform()} className="p-2.5 bg-gray-700 rounded-lg hover:bg-gray-600"><RotateCcw size={16} /></button>
                  <button
                    onClick={() => { setEditMode(m => !m); setPopupSpotId(null); }}
                    className={`p-2.5 rounded-lg transition-colors ${editMode ? 'bg-amber-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                    title="ピン編集モード"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setShowFilterPanel(v => !v)}
                    className={`relative p-2.5 rounded-lg transition-colors ${showFilterPanel || filterActiveCount > 0 ? 'bg-blue-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                    title="フィルター"
                  >
                    <SlidersHorizontal size={16} />
                    {filterActiveCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 text-white rounded-full text-[10px] flex items-center justify-center font-bold leading-none">
                        {filterActiveCount}
                      </span>
                    )}
                  </button>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1 ml-auto">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2.5 bg-gray-700 rounded-lg disabled:opacity-30"><ChevronLeft size={18} /></button>
                      <span className="text-label w-12 text-center">{page}/{totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2.5 bg-gray-700 rounded-lg disabled:opacity-30"><ChevronRight size={18} /></button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* フィルターパネル（トグル） */}
            {showFilterPanel && (
              <div className="bg-gray-800 border-t border-gray-700 px-3 py-2 shrink-0 space-y-2" style={{ touchAction: 'manipulation' }}>
                {/* 優先度 + 済み非表示 */}
                <div className="flex items-center gap-1.5">
                  {(['A', 'B', 'C', 'D'] as const).map(p => {
                    const active = filterPriorities?.has(p) ?? false;
                    return (
                      <button
                        key={p}
                        onClick={() => onFilterPriorityToggle?.(p)}
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold transition-opacity text-label"
                        style={{
                          background: FILTER_BTN_COLOR[p].bg,
                          color: FILTER_BTN_COLOR[p].text,
                          opacity: active ? 1 : 0.35,
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <span className="text-gray-500 text-label ml-0.5">優先度</span>
                  <button
                    onClick={() => onHideDoneToggle?.()}
                    className={`ml-auto text-label px-3 py-1.5 rounded-full transition-colors ${hideDone ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-300'}`}
                  >
                    済み非表示
                  </button>
                </div>
                {/* タグ */}
                {(allTags?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    {allTags!.map(tag => {
                      const active = filterTags?.has(tag) ?? false;
                      return (
                        <button
                          key={tag}
                          onClick={() => onFilterTagToggle?.(tag)}
                          className={`shrink-0 text-label px-2.5 py-1 rounded-full transition-colors whitespace-nowrap ${
                            active ? 'bg-purple-500 text-white' : 'bg-gray-600 text-gray-300'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div ref={transformAreaRef} style={{ flex: 1, overflow: 'hidden' }}>
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%', overflow: 'hidden' }}
              contentStyle={{ position: 'relative', cursor: placingPin ? 'crosshair' : 'grab' }}
            >
              {isImage ? (
                <img
                  ref={imgRef}
                  src={imgUrl ?? ''}
                  alt=""
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setPageSize({ width: img.naturalWidth, height: img.naturalHeight });
                  }}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onClick={handleClick}
                  style={{ display: 'block', userSelect: 'none' }}
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onClick={handleClick}
                />
              )}

              {pageSize.width > 0 && spots
                .filter(s => s.pin.page === page)
                .map(spot => {
                  const isDragging = spot.id === draggingSpotId;
                  const pos = isDragging && draggingPos ? draggingPos : spot.pin;
                  const done = doneSpotIds?.has(spot.id) ?? false;
                  return (
                    <SpotPin
                      key={spot.id}
                      spot={spot}
                      pinColor={spotColor(spot, genres, done)}
                      popupHeaderColor={genres.find(g => g.id === spot.genreId)?.color ?? '#6b7280'}
                      pos={pos}
                      pageSize={pageSize}
                      scale={currentScale}
                      selected={spot.id === selectedSpotId}
                      isDragging={isDragging}
                      done={done}
                      popupOpen={spot.id === popupSpotId}
                      items={itemsBySpot?.[spot.id] ?? []}
                      editMode={editMode}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (placingPin || editMode) return;
                        setPopupSpotId(prev => prev === spot.id ? null : spot.id);
                      }}
                      onItemClick={(e) => {
                        e.stopPropagation();
                        setPopupSpotId(null);
                        onSpotClick(spot.id);
                      }}
                      onLongPress={() => {
                        if (!editMode) return;
                        navigator.vibrate?.(30);
                        setDraggingSpotId(spot.id);
                        setDraggingPos(spot.pin);
                      }}
                      onImageClick={(url) => setImageModalUrl(url)}
                    />
                  );
                })}

              {pendingPinPos && pageSize.width > 0 && (
                <div
                  className="absolute pointer-events-none flex flex-col items-center"
                  style={{
                    left: pendingPinPos.x * pageSize.width,
                    top: pendingPinPos.y * pageSize.height,
                    transform: `translate(-50%, -100%) scale(${Math.pow(currentScale, -0.6)})`,
                    transformOrigin: 'center bottom',
                    zIndex: 30,
                  }}
                >
                  <div className="w-5 h-5 rounded-full bg-blue-500 ring-2 ring-white shadow-lg" />
                  <div className="w-0.5 h-3 bg-blue-500" />
                </div>
              )}
            </TransformComponent>
            </div>
          </div>
        )}
      </TransformWrapper>
      {imageModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setImageModalUrl(null)}
          onTouchEnd={() => setImageModalUrl(null)}
        >
          <img src={imageModalUrl} alt="お品書き" className="max-w-full max-h-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}

