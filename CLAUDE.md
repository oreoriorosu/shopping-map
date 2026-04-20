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

## リファクタリング方針

### 基本姿勢：問題駆動で進める

「コードを見て改善点を探す」のではなく、具体的な問題を起点にする。

- 変更しようとしたとき不便だった
- 同じ場所を何度も直した
- 副作用の依存関係が追いにくかった

### 推奨する順序

1. **重複削除** — リスクゼロ、確実に価値あり
2. **ファイル分割** — 責務を変えずに視認性だけ改善
3. **責務分解（hook抽出など）** — 上記をやった後、痛みを感じたら

### 機能改修時の進め方

`MapViewer.tsx` はPDFロード・transform管理・ピン配置・ドラッグ・ポップアップなど複数の関心事が混在している。改修時に触る箇所が追いにくいと感じたら、**その関心事だけ**をhookに抽出してから実装する（必須ではなく判断次第）。

切り出す場合はコミットを分ける：

```
1コミット目: refactor: usePinDrag を抽出（動作変更なし）
2コミット目: feat: ドラッグ挙動を〇〇に変更
```

---

## 機能開発ワークフロー（新規依頼時の手順）

**ユーザーから「〇〇機能を作って」と依頼が来たら、以下の手順で進める。**

> ⚠️ **長考後に手順を忘れやすい。必ずStep 0からやり直すこと。**

### Step 0: Todoを作成してから作業開始【最初に必ずやること】

コードに触れる前に、TaskCreateツールでTodoを作成する。

```
例:
- [ ] worktree + ブランチ作成
- [ ] types/index.ts 更新
- [ ] store/db.ts バージョンアップ
- [ ] hooks/useDb.ts 更新
- [ ] コンポーネント改修
- [ ] npm run build でエラー確認
- [ ] rebase + mainマージ
- [ ] docker compose up --build
- [ ] git push
```

Todoを作成したら、各タスクを完了するたびに `TaskUpdate` でステータスを更新する。

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

## ワークフロー チェックリスト（再掲）

> 迷ったらここを見る。Step 0 から順番に実行。

1. **Step 0**: TaskCreate でTodo作成 ← **コードより先**
2. **Step 1**: `git worktree add` でブランチ＆worktree作成、`npm install`
3. **Step 2**: worktreeで開発、`npm run build` でエラー確認
4. **Step 3**: `git rebase origin/main` → `git merge --no-ff` → `git worktree remove`
5. **Step 4**: `docker compose up -d --build` → ブラウザ確認
6. **Step 5**: `git push origin main`

---

## E2Eテスト（Playwright）

### 概要

`e2e/` ディレクトリに Playwright テストを配置。
ブラウザ上で実際にUIを操作し、主要ユーザーフローが壊れていないことを確認する。

```
e2e/
├── helpers/
│   ├── db.ts          # resetDb() — IndexedDB削除 + リロード
│   └── actions.ts     # addMap / addSpot / addItem / goToListTab / goToMapTab
├── fixtures/
│   └── test-map.pdf   # テスト用最小PDF（1ページ）
├── map-setup.spec.ts   # マップ追加・FAB表示
├── spot-pinning.spec.ts # スポット追加・ピン配置・バナー・優先度バッジ
├── shopping.spec.ts    # 商品追加・チェック・売切・進捗・価格
└── navigation.spec.ts  # タブ切替・ピンアイコン・ポップアップ・ハイライト
```

### 実行方法

```bash
# Viteを先に起動（テスト実行中は維持する）
npm run dev &

# 全テスト実行
npm run test:e2e

# インタラクティブUI
npm run test:e2e:ui
```

> **webServer自動起動について**: `playwright.config.ts` に `webServer` 設定があるが、
> 起動タイミングの問題でViteが途中停止することがある。
> 確実に実行するには手動で `npm run dev` を先に起動すること。

### テストの設計方針

| 原則 | 内容 |
|------|------|
| 各テスト独立 | `beforeEach` で `resetDb()` を呼び、IndexedDBをクリア |
| helpers 集約 | UI操作は `helpers/actions.ts` に集約し、spec側は意図だけ書く |
| テストしない範囲 | ドラッグ並び替え・アニメーション・CSS・PDF描画品質 |

### セレクタの注意点

マップのピンラベルとリストのスポット名は同じテキストを持つため、セレクタで区別が必要：

| 要素 | セレクタ |
|------|---------|
| リストのスポット名 | `span.font-medium.truncate` |
| マップのピンラベル | `div.text-white.font-bold` |
| アイテムのチェックボタン | `button.w-5.h-5.rounded-full` |
| アイテムの売切ボタン | `button.text-xs` |

> リファクタリングでUIのクラス名が変わる場合は `helpers/actions.ts` を合わせて更新すること。
> `data-testid` を付けると更に安定する。

---

## よく使うコマンド

```bash
# ビルド確認
npm run build

# 型チェックのみ
npx tsc --noEmit

# E2Eテスト（Viteを先に起動すること）
npm run dev &
npm run test:e2e

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
