import { useState, useCallback } from 'react';
import { X, Upload, AlertCircle, CheckCircle2, MapPin } from 'lucide-react';
import { db } from '../store/db';
import type { MapFile, Spot } from '../types';

interface Props {
  maps: MapFile[];
  selectedMapId: string | null;
  onClose: () => void;
  onDone: () => void;
}

// ---- スポットインポート用 ----

interface ParsedRow {
  name: string;
  mapName: string | null;
  priority: 'A' | 'B' | 'C' | 'D' | null;
  genre: string | null;
  tags: string | null;
  items: string[];
  location: string | null;
  hallName: string | null;
}

interface PreviewRow extends ParsedRow {
  resolvedMapId: string | null;
  resolvedMapName: string | null;
  error: string | null;
  needsHallMapping: boolean;
}

// ---- 商品インポート用 ----

interface ParsedItemRow {
  location: string;
  itemName: string;
  genre: string | null;
  price: number | null;
}

interface PreviewItemRow extends ParsedItemRow {
  resolvedSpot: Spot | null;
  resolvedItemName: string;
  error: string | null;
}

// カラム名の正規化（スプシのヘッダー揺れを吸収）
const COL_ALIASES: Record<string, string> = {
  サークル名: 'name', サークル: 'name', 名前: 'name', name: 'name', circle: 'name',
  マップ名: 'map', マップ: 'map', map: 'map',
  優先度: 'priority', priority: 'priority',
  ジャンル: 'genre', genre: 'genre',
  タグ: 'tags', tags: 'tags', 推し: 'tags', oshi: 'tags', 推しキャラ: 'tags',
  品物: 'items', items: 'items', 購入品: 'items', 買うもの: 'items',
  場所: 'location', location: 'location',
  ホール: 'hall', hall: 'hall', ホール名: 'hall',
  商品名: 'itemName', 商品: 'itemName', item: 'itemName',
  金額: 'price', 価格: 'price', price: 'price',
};

function normalizeKey(raw: string): string {
  return COL_ALIASES[raw.trim()] ?? '';
}

function detectSep(line: string): string {
  return line.includes('\t') ? '\t' : ',';
}

function parsePriority(raw: string): 'A' | 'B' | 'C' | 'D' | null {
  const v = raw.trim().toUpperCase();
  if (v === 'A' || v === 'B' || v === 'C' || v === 'D') return v;
  return null;
}

function parseText(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const sep = detectSep(lines[0]);
  const headers = lines[0].split(sep).map(h => normalizeKey(h));
  const hasName = headers.includes('name');
  const hasLocation = headers.includes('location');
  if (!hasName && !hasLocation) return [];

  return lines.slice(1).map(line => {
    const cols = line.split(sep);
    const get = (key: string) => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? (cols[idx] ?? '').trim() : '';
    };
    const name = get('name') || get('location');
    const rawItems = get('items');
    return {
      name,
      mapName: get('map') || null,
      priority: parsePriority(get('priority')),
      genre: get('genre') || null,
      tags: get('tags') || null,
      items: rawItems ? rawItems.split(/[,、，]/).map(s => s.trim()).filter(Boolean) : [],
      location: get('location') || null,
      hallName: get('hall') || null,
    };
  }).filter(r => r.name);
}

function parseItemText(text: string): ParsedItemRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const sep = detectSep(lines[0]);
  const headers = lines[0].split(sep).map(h => normalizeKey(h));
  if (!headers.includes('location')) return [];

  return lines.slice(1).map(line => {
    const cols = line.split(sep);
    const get = (key: string) => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? (cols[idx] ?? '').trim() : '';
    };
    const rawPrice = get('price').replace(/[^0-9]/g, '');
    return {
      location: get('location'),
      itemName: get('itemName'),
      genre: get('genre') || null,
      price: rawPrice ? parseInt(rawPrice, 10) : null,
    };
  }).filter(r => r.location);
}

function gridPin(index: number, existingCount: number) {
  const cols = 5;
  const colW = 0.12;
  const rowH = 0.10;
  const startX = 0.05;
  const startY = 0.04;
  const n = existingCount + index;
  return {
    x: startX + (n % cols) * colW,
    y: startY + Math.floor(n / cols) * rowH,
    page: 1,
  };
}

type Mode = 'spot' | 'item';

export function CsvImportModal({ maps, selectedMapId, onClose, onDone }: Props) {
  const [mode, setMode] = useState<Mode>('spot');
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [allSpots, setAllSpots] = useState<Spot[]>([]);
  // ホール名 → mapId の手動マッピング
  const [hallMapOverrides, setHallMapOverrides] = useState<Record<string, string>>({});

  useState(() => {
    db.spots.toArray().then(setAllSpots);
  });

  const spotPreview: PreviewRow[] = useCallback(() => {
    if (mode !== 'spot') return [];
    const rows = parseText(text);
    return rows.map(row => {
      let resolvedMapId: string | null = null;
      let resolvedMapName: string | null = null;
      let error: string | null = null;
      let needsHallMapping = false;

      if (row.mapName) {
        // mapName が明示されている場合はそれで解決
        const found = maps.find(m => m.name === row.mapName);
        if (found) {
          resolvedMapId = found.id;
          resolvedMapName = found.name;
        } else {
          error = `マップ「${row.mapName}」が見つかりません`;
        }
      } else if (row.hallName) {
        // hallName でマップを探す
        const foundByHall = maps.find(m => m.name === row.hallName);
        if (foundByHall) {
          resolvedMapId = foundByHall.id;
          resolvedMapName = foundByHall.name;
        } else if (hallMapOverrides[row.hallName]) {
          // ユーザーが手動でマッピングを設定済み
          const overrideMap = maps.find(m => m.id === hallMapOverrides[row.hallName!]);
          if (overrideMap) {
            resolvedMapId = overrideMap.id;
            resolvedMapName = overrideMap.name;
          }
        } else {
          // マッピング未解決 → ユーザーに選択させる
          needsHallMapping = true;
        }
      } else if (selectedMapId) {
        const found = maps.find(m => m.id === selectedMapId);
        resolvedMapId = selectedMapId;
        resolvedMapName = found?.name ?? null;
      } else {
        error = 'マップ名を指定するかマップを選択してください';
      }

      return { ...row, resolvedMapId, resolvedMapName, error, needsHallMapping };
    });
  }, [text, maps, selectedMapId, mode, hallMapOverrides])();

  // 未解決のホール名一覧（重複排除）
  const unresolvedHallNames = Array.from(
    new Set(spotPreview.filter(r => r.needsHallMapping && r.hallName).map(r => r.hallName!))
  );

  const itemPreview: PreviewItemRow[] = useCallback(() => {
    if (mode !== 'item') return [];
    const rows = parseItemText(text);
    return rows.map(row => {
      const spot = allSpots.find(s => s.location === row.location) ?? null;
      const resolvedItemName = row.itemName || row.genre || row.location;
      const error = spot ? null : `場所「${row.location}」が見つかりません`;
      return { ...row, resolvedSpot: spot, resolvedItemName, error };
    });
  }, [text, allSpots, mode])();

  const validSpotRows = spotPreview.filter(r => !r.error && !r.needsHallMapping);
  const errorSpotRows = spotPreview.filter(r => r.error);
  const pendingHallRows = spotPreview.filter(r => r.needsHallMapping);
  const validItemRows = itemPreview.filter(r => !r.error);
  const errorItemRows = itemPreview.filter(r => r.error);

  const handleImport = async () => {
    if (mode === 'spot') {
      if (validSpotRows.length === 0) return;
      setImporting(true);

      const mapCounts: Record<string, number> = {};
      const mapIndexes: Record<string, number> = {};

      for (const row of validSpotRows) {
        const mid = row.resolvedMapId!;
        if (mapCounts[mid] == null) {
          mapCounts[mid] = await db.spots.where('mapId').equals(mid).count();
          mapIndexes[mid] = 0;
        }
      }

      await db.transaction('rw', db.spots, db.items, async () => {
        for (const row of validSpotRows) {
          const mid = row.resolvedMapId!;

          const spotId = crypto.randomUUID();
          await db.spots.add({
            id: spotId,
            mapId: mid,
            name: row.name,
            pin: gridPin(mapIndexes[mid], mapCounts[mid]),
            ...(row.priority ? { priority: row.priority } : {}),
            ...(row.tags ? { tags: row.tags.split(/[,、，]/).map(s => s.trim()).filter(Boolean) } : {}),
            ...(row.location ? { location: row.location } : {}),
            ...(row.hallName ? { hallName: row.hallName } : {}),
          });
          mapIndexes[mid]++;

          for (let i = 0; i < row.items.length; i++) {
            await db.items.add({
              id: crypto.randomUUID(),
              spotId,
              name: row.items[i],
              memo: '',
              checked: false,
              soldOut: false,
              order: i,
            });
          }
        }
      });

      setImportedCount(validSpotRows.length);
    } else {
      if (validItemRows.length === 0) return;
      setImporting(true);

      const spotOrderOffsets: Record<string, number> = {};
      for (const row of validItemRows) {
        const sid = row.resolvedSpot!.id;
        if (spotOrderOffsets[sid] == null) {
          spotOrderOffsets[sid] = await db.items.where('spotId').equals(sid).count();
        }
      }
      const spotOrderIndexes: Record<string, number> = {};

      await db.transaction('rw', db.items, async () => {
        for (const row of validItemRows) {
          const sid = row.resolvedSpot!.id;
          if (spotOrderIndexes[sid] == null) spotOrderIndexes[sid] = 0;
          const order = spotOrderOffsets[sid] + spotOrderIndexes[sid];
          spotOrderIndexes[sid]++;

          await db.items.add({
            id: crypto.randomUUID(),
            spotId: sid,
            name: row.resolvedItemName,
            memo: '',
            checked: false,
            soldOut: false,
            order,
            ...(row.price != null ? { price: row.price } : {}),
          });
        }
      });

      setImportedCount(validItemRows.length);
    }

    setImporting(false);
    setDone(true);
  };

  const handleModeChange = (m: Mode) => {
    setMode(m);
    setText('');
    setHallMapOverrides({});
  };

  const validCount = mode === 'spot' ? validSpotRows.length : validItemRows.length;
  const errorCount = mode === 'spot' ? errorSpotRows.length : errorItemRows.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
        <Upload size={18} className="text-blue-500" />
        <span className="font-bold text-gray-800 flex-1">CSVインポート</span>
        <button onClick={onClose} className="p-2.5 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      {done ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <CheckCircle2 size={48} className="text-green-500" />
          <p className="text-lg font-bold text-gray-800">{importedCount} 件インポートしました</p>
          <button
            onClick={onDone}
            className="mt-2 px-8 py-3 bg-blue-500 text-white rounded-xl font-bold text-sm"
          >
            閉じる
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* モード切替 */}
          <div className="flex px-4 pt-3 gap-2 shrink-0">
            <button
              onClick={() => handleModeChange('spot')}
              className={`flex-1 py-3 rounded-lg text-body font-bold transition-colors ${
                mode === 'spot' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              サークル登録
            </button>
            <button
              onClick={() => handleModeChange('item')}
              className={`flex-1 py-3 rounded-lg text-body font-bold transition-colors ${
                mode === 'item' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              商品追加
            </button>
          </div>

          {/* 貼り付けエリア */}
          <div className="px-4 pt-3 pb-2 shrink-0">
            <p className="text-xs text-gray-500 mb-1.5">
              スプレッドシートからコピーして貼り付け（タブ区切り）またはCSV
            </p>
            <textarea
              className="w-full h-32 text-xs font-mono border border-gray-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder={
                mode === 'spot'
                  ? 'サークル名\tマップ名\t優先度\tジャンル\t推し\t品物\n例：東方サークル\tコミケ101\tA\t東方\t霊夢\tステッカー,クリアファイル'
                  : '場所\t商品名\tジャンル\t金額\n例：あ01\t新刊A\t\t1000\nあ01\t\t東方\t500'
              }
              value={text}
              onChange={e => setText(e.target.value)}
              autoFocus
            />
          </div>

          {/* カラム説明 */}
          <div className="px-4 pb-2 shrink-0">
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 space-y-0.5">
              {mode === 'spot' ? (
                <>
                  <p><span className="font-bold text-gray-700">サークル名</span>（必須）&nbsp;
                    <span className="text-gray-400">マップ名 / 優先度(A〜D) / ジャンル / 推し / 品物（カンマ区切り）/ 場所 / ホール</span>（任意）</p>
                  <p className="text-gray-400">マップ名省略時は現在選択中のマップに追加。ホール名がマップ名と異なる場合は下で対応を設定</p>
                </>
              ) : (
                <>
                  <p><span className="font-bold text-gray-700">場所</span>（必須）&nbsp;
                    <span className="text-gray-400">商品名 / ジャンル / 金額</span>（任意）</p>
                  <p className="text-gray-400">商品名なし→ジャンル→場所名の順で商品名を代用。既存サークルの場所と照合</p>
                </>
              )}
            </div>
          </div>

          {/* ホール名マッピング（未解決のホール名がある場合のみ表示） */}
          {mode === 'spot' && unresolvedHallNames.length > 0 && (
            <div className="px-4 pb-2 shrink-0">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin size={16} className="text-amber-500 shrink-0" />
                  <p className="text-xs font-bold text-amber-700">ホール名とマップの対応を設定</p>
                </div>
                <div className="space-y-1.5">
                  {unresolvedHallNames.map(hallName => (
                    <div key={hallName} className="flex items-center gap-2">
                      <span className="text-xs text-gray-700 font-medium shrink-0 min-w-[4rem]">{hallName}</span>
                      <span className="text-xs text-gray-400 shrink-0">→</span>
                      <select
                        className="flex-1 text-body border border-gray-300 rounded px-2 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                        value={hallMapOverrides[hallName] ?? ''}
                        onChange={e => setHallMapOverrides(prev => ({
                          ...prev,
                          [hallName]: e.target.value,
                        }))}
                      >
                        <option value="">マップを選択...</option>
                        {maps.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-1.5">
                  {pendingHallRows.length} 件が未割り当て（マップを選択するとインポート可能になります）
                </p>
              </div>
            </div>
          )}

          {/* プレビュー */}
          {(mode === 'spot' ? spotPreview : itemPreview).length > 0 && (
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              <p className="text-xs font-bold text-gray-600 mb-1.5">
                プレビュー（{validCount} 件インポート可
                {pendingHallRows.length > 0 && <span className="text-amber-500">、{pendingHallRows.length} 件マップ未設定</span>}
                {errorCount > 0 && <span className="text-red-500">、{errorCount} 件エラー</span>}）
              </p>
              <div className="space-y-1">
                {mode === 'spot'
                  ? spotPreview.map((row, i) => (
                    <div
                      key={i}
                      className={`rounded-lg px-3 py-2 text-xs flex items-start gap-2 ${
                        row.error
                          ? 'bg-red-50 border border-red-200'
                          : row.needsHallMapping
                            ? 'bg-amber-50 border border-amber-200'
                            : 'bg-green-50 border border-green-100'
                      }`}
                    >
                      {row.error
                        ? <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                        : row.needsHallMapping
                          ? <MapPin size={16} className="text-amber-400 mt-0.5 shrink-0" />
                          : <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-gray-800">{row.name}</span>
                          {row.priority && (
                            <span className="px-1 rounded text-white font-bold" style={{ fontSize: 10, background: { A: '#ef4444', B: '#fb923c', C: '#facc15', D: '#9ca3af' }[row.priority] }}>
                              {row.priority}
                            </span>
                          )}
                          {row.hallName && (
                            <span className="text-gray-400 text-[10px]">ホール:{row.hallName}</span>
                          )}
                          {row.resolvedMapName && <span className="text-gray-400">→ {row.resolvedMapName}</span>}
                        </div>
                        {(row.genre || row.tags) && (
                          <p className="text-gray-500 mt-0.5 truncate">
                            {[row.genre && `${row.genre}`, row.tags && `タグ:${row.tags}`].filter(Boolean).join('　')}
                          </p>
                        )}
                        {row.items.length > 0 && (
                          <p className="text-gray-500 mt-0.5 truncate">{row.items.join('、')}</p>
                        )}
                        {row.error && <p className="text-red-500 mt-0.5">{row.error}</p>}
                        {row.needsHallMapping && <p className="text-amber-500 mt-0.5">上でマップを選択してください</p>}
                      </div>
                    </div>
                  ))
                  : itemPreview.map((row, i) => (
                    <div
                      key={i}
                      className={`rounded-lg px-3 py-2 text-xs flex items-start gap-2 ${row.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-100'}`}
                    >
                      {row.error
                        ? <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                        : <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-gray-500">{row.location}</span>
                          <span className="text-gray-300">→</span>
                          <span className="font-bold text-gray-800">{row.resolvedItemName}</span>
                          {row.resolvedSpot && (
                            <span className="text-gray-400 truncate">({row.resolvedSpot.name})</span>
                          )}
                          {row.price != null && (
                            <span className="text-gray-500 shrink-0">¥{row.price.toLocaleString()}</span>
                          )}
                        </div>
                        {row.error && <p className="text-red-500 mt-0.5">{row.error}</p>}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* インポートボタン */}
          <div className="px-4 py-3 border-t border-gray-100 shrink-0">
            <button
              onClick={handleImport}
              disabled={validCount === 0 || importing}
              className="w-full py-3 bg-blue-500 disabled:bg-gray-300 text-white font-bold rounded-xl text-sm active:bg-blue-600"
            >
              {importing ? 'インポート中...' : `${validCount} 件をインポート`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
