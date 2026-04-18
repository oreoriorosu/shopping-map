# CLAUDE.md — shopping-map

## プロジェクト概要

PDFマップ + 買い物リストのモバイルWebアプリ。
データはブラウザのIndexedDB（Dexie.js）にローカル保存。バックエンドなし。

- **URL**: https://shopping.deen-dev.com
- **ポート**: 8091
- **リポジトリ**: https://github.com/oreoriorosu/shopping-map

## 技術スタック

| 役割 | 技術 |
|------|------|
| フロントエンド | React 19 + TypeScript + Vite |
| スタイル | Tailwind CSS v4 |
| PDFレンダリング | pdfjs-dist（ベクターPDF、高ズーム） |
| ズーム/パン | react-zoom-pan-pinch |
| ローカルDB | Dexie.js（IndexedDB） |
| 配信 | nginx（Docker） |

## ディレクトリ構成

```
src/
├── App.tsx                 # ルートコンポーネント、タブ切替
├── components/
│   ├── MapViewer.tsx       # PDFビュー + ピン操作
│   ├── ShoppingPanel.tsx   # 買い物リスト
│   ├── MapSelector.tsx     # マップ選択ドロップダウン
│   └── AddSpotModal.tsx    # 店舗追加モーダル
├── hooks/useDb.ts          # DB CRUD操作
├── store/db.ts             # Dexie スキーマ定義
└── types/index.ts          # 型定義（MapFile, Spot, ShoppingItem）
```

## データモデル

```typescript
MapFile   { id, name, blob, createdAt }          // PDFファイル
Spot      { id, mapId, name, color, pin:{x,y,page} } // ピン（0-1正規化座標）
ShoppingItem { id, spotId, name, memo, checked, order }
```

---

## 機能開発ワークフロー（新規依頼時の手順）

**ユーザーから「〇〇機能を作って」と依頼が来たら、以下の手順で進める。**

### Step 1: worktree + ブランチ作成

```bash
# メインブランチを最新化
cd ~/projects/shopping-map && git fetch origin && git pull

# フィーチャーブランチ名を決める（例: feature/spot-memo）
BRANCH=feature/xxx

# worktreeを作成（~/projects/ 配下に並列で展開）
git worktree add ~/projects/shopping-map-${BRANCH#feature/} $BRANCH
cd ~/projects/shopping-map-${BRANCH#feature/}
npm install
```

> worktreeは同じgit履歴を共有し、ファイルシステムは独立。
> 複数機能を並行開発しても競合しない。

### Step 2: 開発

- コンポーネント変更 → `npm run build` でエラー確認
- ビルドが通ったら動作確認（ブラウザで確認する場合は別ポートでDockerを立てる）

```bash
# 別ポートでテスト用コンテナを起動する場合
PORT=8092 docker compose -p shopping-map-dev up -d --build
# （docker-compose.ymlのポートをオーバーライド）
```

### Step 3: テスト準備（rebase + マージ）

開発完了後、mainの最新変更を取り込んでからマージする。

```bash
# worktreeのブランチでmainにrebase
cd ~/projects/shopping-map-${BRANCH#feature/}
git fetch origin
git rebase origin/main

# コンフリクトがあれば解消してから続行
# git rebase --continue

# mainにマージ
cd ~/projects/shopping-map
git merge --no-ff $BRANCH -m "feat: 〇〇機能を追加"

# worktreeを削除
git worktree remove ~/projects/shopping-map-${BRANCH#feature/}
git branch -d $BRANCH
```

### Step 4: デプロイ & テスト

```bash
cd ~/projects/shopping-map
docker compose up -d --build
```

ブラウザで https://shopping.deen-dev.com を確認。

### Step 5: GitHubにプッシュ

```bash
git push origin main
```

---

## よく使うコマンド

```bash
# ビルド確認
npm run build

# 型チェックのみ
npx tsc --noEmit

# worktree一覧
git worktree list

# 本番デプロイ
docker compose up -d --build

# ログ確認
docker compose logs -f
```

## 注意事項

- `src/store/db.ts` のスキーマを変更する場合は `db.version()` を上げる
- ピンの座標は 0〜1 の正規化座標（PDFページサイズに依存しない）
- `BASE_RENDER_SCALE = 2.0` 固定（動的再レンダリングは実装しない）
- ポート 8091 は本番用。開発・テスト用は別ポートを使う
