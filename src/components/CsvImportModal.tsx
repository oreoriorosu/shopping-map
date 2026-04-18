import { useState, useCallback } from 'react';
import { X, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { db } from '../store/db';
import { SPOT_COLORS } from './MapViewer';
import type { MapFile } from '../types';

interface Props {
  maps: MapFile[];
  selectedMapId: string | null;
  onClose: () => void;
  onDone: () => void;
}

interface ParsedRow {
  name: string;
  mapName: string | null;
  priority: 'A' | 'B' | 'C' | 'D' | null;
  genre: string | null;
  oshi: string | null;
  items: string[];
  location: string | null;
  hallName: string | null;
}

interface PreviewRow extends ParsedRow {
  resolvedMapId: string | null;
  resolvedMapName: string | null;
  error: string | null;
}

// カラム名の正規化（スプシのヘッダー揺れを吸収）
const COL_ALIASES: Record<string, string> = {
  サークル名: 'name', サークル: 'name', 名前: 'name', name: 'name', circle: 'name',
  マップ名: 'map', マップ: 'map', map: 'map',
  優先度: 'priority', priority: 'priority',
  ジャンル: 'genre', genre: 'genre',
  推し: 'oshi', oshi: 'oshi', 推しキャラ: 'oshi',
  品物: 'items', items: 'items', 購入品: 'items', 買うもの: 'items',
  場所: 'location', location: 'location',
  ホール: 'hall', hall: 'hall', ホール名: 'hall',
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
    // サークル名列がなければ場所をname代替として使う
    const name = get('name') || get('location');
    const rawItems = get('items');
    return {
      name,
      mapName: get('map') || null,
      priority: parsePriority(get('priority')),
      genre: get('genre') || null,
      oshi: get('oshi') || null,
      items: rawItems ? rawItems.split(/[,、，]/).map(s => s.trim()).filter(Boolean) : [],
      location: get('location') || null,
      hallName: get('hall') || null,
    };
  }).filter(r => r.name);
}

// 既存スポット数を考慮してグリッド座標を計算（左上から右→下）
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

export function CsvImportModal({ maps, selectedMapId, onClose, onDone }: Props) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const preview: PreviewRow[] = useCallback(() => {
    const rows = parseText(text);
    return rows.map(row => {
      const targetMapName = row.mapName;
      let resolvedMapId: string | null = null;
      let resolvedMapName: string | null = null;
      let error: string | null = null;

      // マップ名列 → ホール名列 → 選択中マップ の順で照合
      const mapKey = targetMapName ?? row.hallName;
      if (mapKey) {
        const found = maps.find(m => m.name === mapKey);
        if (found) { resolvedMapId = found.id; resolvedMapName = found.name; }
        else if (targetMapName) error = `マップ「${mapKey}」が見つかりません`;
        // ホール名で一致しなければ選択中マップにフォールバック
        else if (selectedMapId) {
          const fallback = maps.find(m => m.id === selectedMapId);
          resolvedMapId = selectedMapId;
          resolvedMapName = fallback?.name ?? null;
        } else {
          error = 'マップ名を指定するかマップを選択してください';
        }
      } else if (selectedMapId) {
        const found = maps.find(m => m.id === selectedMapId);
        resolvedMapId = selectedMapId;
        resolvedMapName = found?.name ?? null;
      } else {
        error = 'マップ名を指定するかマップを選択してください';
      }

      return { ...row, resolvedMapId, resolvedMapName, error };
    });
  }, [text, maps, selectedMapId])();

  const validRows = preview.filter(r => !r.error);
  const errorRows = preview.filter(r => r.error);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);

    // マップIDごとに既存スポット数をキャッシュ
    const mapCounts: Record<string, number> = {};
    const mapIndexes: Record<string, number> = {};

    for (const row of validRows) {
      const mid = row.resolvedMapId!;
      if (mapCounts[mid] == null) {
        mapCounts[mid] = await db.spots.where('mapId').equals(mid).count();
        mapIndexes[mid] = 0;
      }
    }

    // マップIDごとの使用済み色インデックス
    const colorIndexes: Record<string, number> = {};

    await db.transaction('rw', db.spots, db.items, async () => {
      for (const row of validRows) {
        const mid = row.resolvedMapId!;
        const colorIdx = colorIndexes[mid] ?? 0;
        const color = SPOT_COLORS[colorIdx % SPOT_COLORS.length];
        colorIndexes[mid] = colorIdx + 1;

        const spotId = crypto.randomUUID();
        await db.spots.add({
          id: spotId,
          mapId: mid,
          name: row.name,
          color,
          pin: gridPin(mapIndexes[mid], mapCounts[mid]),
          ...(row.priority ? { priority: row.priority } : {}),
          ...(row.genre ? { genre: row.genre } : {}),
          ...(row.oshi ? { oshi: row.oshi } : {}),
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

    setImportedCount(validRows.length);
    setImporting(false);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
        <Upload size={18} className="text-blue-500" />
        <span className="font-bold text-gray-800 flex-1">CSVインポート</span>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      {done ? (
        /* 完了画面 */
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
          {/* 貼り付けエリア */}
          <div className="px-4 pt-3 pb-2 shrink-0">
            <p className="text-xs text-gray-500 mb-1.5">
              スプレッドシートからコピーしてここに貼り付け（タブ区切り）またはCSVを貼り付け
            </p>
            <textarea
              className="w-full h-32 text-xs font-mono border border-gray-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder={"サークル名\tマップ名\t優先度\tジャンル\t推し\t品物\n例：東方永夜抄サークル\tコミケ101\tA\t東方\t霊夢\tステッカー,クリアファイル"}
              value={text}
              onChange={e => setText(e.target.value)}
              autoFocus
            />
          </div>

          {/* カラム説明 */}
          <div className="px-4 pb-2 shrink-0">
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 space-y-0.5">
              <p><span className="font-bold text-gray-700">サークル名</span>（必須）&nbsp;
                <span className="text-gray-400">マップ名 / 優先度(A〜D) / ジャンル / 推し / 品物（カンマ区切り）/ 場所 / ホール</span>（任意）</p>
              <p className="text-gray-400">マップ名省略時は現在選択中のマップに追加</p>
            </div>
          </div>

          {/* プレビュー */}
          {preview.length > 0 && (
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              <p className="text-xs font-bold text-gray-600 mb-1.5">
                プレビュー（{validRows.length} 件インポート可
                {errorRows.length > 0 && <span className="text-red-500">、{errorRows.length} 件エラー</span>}）
              </p>
              <div className="space-y-1">
                {preview.map((row, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 text-xs flex items-start gap-2 ${row.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-100'}`}
                  >
                    {row.error
                      ? <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
                      : <CheckCircle2 size={13} className="text-green-500 mt-0.5 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-800">{row.name}</span>
                        {row.priority && (
                          <span className="px-1 rounded text-white font-bold" style={{ fontSize: 10, background: { A: '#ef4444', B: '#fb923c', C: '#facc15', D: '#9ca3af' }[row.priority] }}>
                            {row.priority}
                          </span>
                        )}
                        {row.resolvedMapName && <span className="text-gray-400">→ {row.resolvedMapName}</span>}
                      </div>
                      {(row.genre || row.oshi) && (
                        <p className="text-gray-500 mt-0.5 truncate">
                          {[row.genre && `${row.genre}`, row.oshi && `推し:${row.oshi}`].filter(Boolean).join('　')}
                        </p>
                      )}
                      {row.items.length > 0 && (
                        <p className="text-gray-500 mt-0.5 truncate">{row.items.join('、')}</p>
                      )}
                      {row.error && <p className="text-red-500 mt-0.5">{row.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* インポートボタン */}
          <div className="px-4 py-3 border-t border-gray-100 shrink-0">
            <button
              onClick={handleImport}
              disabled={validRows.length === 0 || importing}
              className="w-full py-3 bg-blue-500 disabled:bg-gray-300 text-white font-bold rounded-xl text-sm active:bg-blue-600"
            >
              {importing ? 'インポート中...' : `${validRows.length} 件をインポート`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
