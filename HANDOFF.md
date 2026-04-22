# 引き継ぎ — shopping-map

最終更新: 2026-04-22

---

## この会話でやったこと（完了済み）

| 作業 | 詳細 |
|------|------|
| CLAUDE.md 削減 | 273行 → 75行。Todoファーストルールを最上部に配置。重複・哲学的記述を削除 |
| serena 登録 | `/home/dev/projects/shopping-map` をプロジェクトとして登録 |
| serena memory 追加 | `coding/refactoring`（hook抽出方針）、`coding/e2e-tests`（テスト設計） |

---

## 次に触るタイミングでやること

### 2. MapViewer.tsx hook抽出

**503行の単一コンポーネント**。serenaで読めるが本体が大きく効果が限定的。
触る際に関心事ごとにhookを切り出す（コミットを分ける: `refactor:` → `feat:`）。

| hook | 内容 | 行数の目安 |
|------|------|-----------|
| `usePdfRenderer` | PDF読み込み・canvas描画・ページ切替 | ~80行 |
| `usePinDrag` | draggingSpotId / draggingPos / タッチ判定 | ~40行 |
| `useMapTransform` | pendingTransformRef / savedTransformRef / doCenterOnSpot | ~30行 |

抽出後は MapViewer.tsx が ~200行になり serena の効果が最大化される。

### 3. CsvImportModal.tsx パース分離

**541行**。CSVパース・バリデーション・UIが混在。

- `src/utils/csvParser.ts` に `parseAndValidateCsv()` などを純粋関数として切り出す
- モーダル本体が ~250行になる
- 純粋関数になるためユニットテストも書きやすい

### 4. E2Eテスト data-testid 整備

現状のセレクタはCSSクラス名に依存しており、UIリファクタで壊れやすい。
`data-testid` を主要UI要素に付与することで安定化できる。

対象: ピンラベル、スポット名、チェックボタン、売切ボタン、タブボタン

---

## 現在の技術的負債（把握済み）

| ファイル | 行数 | 問題 |
|---------|------|------|
| `CsvImportModal.tsx` | 541 | パース・バリデーション・UIが混在 |
| `MapViewer.tsx` | 503 | PDF描画・transform・ドラッグ・タッチ・ポップアップが1関数 |
| `AddSpotModal.tsx` | 372 | フォーム状態管理がコンポーネント内に集中 |
| E2Eセレクタ | — | クラス名依存、data-testid未整備 |

---

## 現在の環境・設定状態

- **serena**: shopping-map プロジェクト登録済み。各作業前に `get_symbols_overview` で絞り込む
- **CLAUDE.md**: 最小化済み。Todoファースト・ワークフロー・制約のみ
- **本番**: https://shopping.deen-dev.com（port 8091）
- **テスト用コンテナ**: `PORT=8092 docker compose -p shopping-map-dev up -d --build`
