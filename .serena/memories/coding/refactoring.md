# リファクタリング方針

## 基本姿勢：問題駆動

「コードを見て改善点を探す」のではなく、具体的な問題を起点にする。
- 変更しようとしたとき不便だった
- 同じ場所を何度も直した
- 副作用の依存関係が追いにくかった

## 推奨する順序

1. 重複削除 — リスクゼロ
2. ファイル分割 — 責務を変えずに視認性だけ改善
3. 責務分解（hook抽出など） — 上記をやった後、痛みを感じたら

## MapViewer.tsx のhook抽出

503行の単一コンポーネント。触る箇所が追いにくいと感じたら、**その関心事だけ**をhookに抽出してから実装する。

抽出候補：
- `usePdfRenderer` — PDF読み込み・canvas描画・ページ切替
- `usePinDrag` — draggingSpotId / draggingPos / タッチ判定ロジック
- `useMapTransform` — pendingTransformRef / savedTransformRef / doCenterOnSpot

抽出する場合はコミットを必ず分ける：
```
1コミット目: refactor: usePinDrag を抽出（動作変更なし）
2コミット目: feat: ドラッグ挙動を〇〇に変更
```

## CsvImportModal.tsx（541行）

CSVパース・バリデーション・UIが混在。分離候補：
- `utils/csvParser.ts` — parseAndValidateCsv() などの純粋関数
