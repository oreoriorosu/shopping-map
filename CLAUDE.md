# CLAUDE.md — shopping-map

---

> ## ⚠️ 作業前に必ずTodoを作成する
>
> **調査・実装・リファクタリング・何であっても、最初の行動は TaskCreate。**
> コードを読む前、コマンドを叩く前、考える前に作る。
> これが守れていない場合は作業を中断してTodoを先に作ること。

---

## 機能開発ワークフロー

1. **Step 0**: TaskCreate でTodo作成（**最初。例外なし。**）
2. **Step 1**: `git worktree add ~/projects/shopping-map-XXX feature/XXX` → `npm install`
3. **Step 2**: worktreeで開発 → `npm run build` でエラー確認
4. **Step 3**: `git rebase origin/main` → `git merge --no-ff` → `git worktree remove`
5. **Step 4**: `git push origin main` → Cloudflare Pages が自動ビルド＆デプロイ（約1〜2分）
6. **Step 5**: デプロイ完了をCloudflare Pagesのダッシュボードで確認

**本番URL**: Cloudflare Pagesのダッシュボードで確認（`*.pages.dev` または独自ドメイン）  
**デプロイ状況確認**: Cloudflare Dashboard → Workers & Pages → shopping-map

### ローカル動作確認（本番デプロイ前）

```bash
npm run build && npm run preview   # dist/ をローカルプレビュー
```

---

## プロジェクト概要

PDFマップ + 買い物リストのモバイルWebアプリ。IndexedDB（Dexie.js）にローカル保存。バックエンドなし。

**ホスティング**: Cloudflare Pages（無料静的ホスティング）  
**リポジトリ**: https://github.com/oreoriorosu/shopping-map

## 技術スタック

React 19 + TypeScript + Vite / Tailwind CSS v4 / pdfjs-dist / react-zoom-pan-pinch / Dexie.js / Cloudflare Pages

## ディレクトリ構成

```
src/
├── App.tsx / constants.ts / types/index.ts / store/db.ts
├── hooks/useDb.ts（DB CRUD）/ hooks/useBlobUrl.ts
└── components/
    ├── MapViewer.tsx       # PDFビュー + ピン操作（503行・大）
    ├── ShoppingPanel.tsx / SpotSection.tsx / ItemRow.tsx / SpotPin.tsx
    ├── MapSelector.tsx / AddSpotModal.tsx / CsvImportModal.tsx
    └── HelpModal.tsx / ImageModal.tsx / SettingsScreen.tsx
```

## データモデル

```typescript
MapFile      { id, name, blob, fileType?, createdAt, order? }
Spot         { id, mapId, name, pin:{x,y,page}, priority?, genreId?, hallName?, location?, tags?, image?, visitOrder?, checked? }
ShoppingItem { id, spotId, name, memo, checked, soldOut, price?, order }
Genre        { id, name, color }
```

## コードを読む前に（serena）

ファイル全体を読む前に serena で絞り込む：

```
get_symbols_overview: relative_path="hooks/useDb.ts"
find_symbol: name_path="addItem", include_body=true
find_referencing_symbols: symbol_name="ShoppingPanel"
find_symbol: name_path="Props", relative_path="components/MapViewer.tsx", include_body=true
```

## E2Eテスト

```bash
npm run dev &        # 先に起動（webServer自動起動は不安定）
npm run test:e2e
```

`e2e/helpers/` に `resetDb()` と `actions.ts` がある。各テストは `beforeEach` で `resetDb()` を呼ぶ。

## 制約（変えてはいけないこと）

- `store/db.ts` のスキーマ変更時は `db.version()` を上げる
- ピンの座標は 0〜1 の正規化座標
- `BASE_RENDER_SCALE = 2.0` 固定（動的再レンダリングしない）
- ポート 8091 は（過去の）Docker本番用（現在はCloudflare Pagesにて稼働）
