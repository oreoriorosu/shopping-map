# E2Eテスト設計方針（Playwright）

## ディレクトリ

```
e2e/
├── helpers/db.ts       # resetDb() — IndexedDB削除 + リロード
├── helpers/actions.ts  # addMap / addSpot / addItem / goToListTab / goToMapTab
├── fixtures/test-map.pdf
└── *.spec.ts
```

## 原則

- 各テストは `beforeEach` で `resetDb()` を呼び独立して実行する
- UI操作は `helpers/actions.ts` に集約し、spec側は意図だけ書く
- テストしない範囲: ドラッグ並び替え・アニメーション・CSS・PDF描画品質

## セレクタ

クラス名はリファクタリングで変わりやすいため、コードを直接確認すること。
`data-testid` を付けると安定する（未整備）。

リファクタリングでUIのクラス名が変わった場合は `helpers/actions.ts` を合わせて更新する。
