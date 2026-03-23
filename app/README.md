# SENTINEL//AI

iPhoneを監視カメラとして使うAIセキュリティシステム。
カメラ映像をClaude Vision APIで解析し、Supabaseに保存する。

## 構成

- **フレームワーク**: Vite + React
- **AI解析**: Claude Vision API（claude-haiku-4-5）
- **DB・Storage**: Supabase
- **デプロイ**: Vercel

## 各技術の役割

| 技術 | 役割 |
|------|------|
| React | UIを作るライブラリ。コンポーネントやJSXで画面を記述する |
| Vite | ビルドツール。JSXをブラウザが読めるJSに変換する。開発時はホットリロードやプロキシも担当 |
| Vercel | ホスティング。git pushで自動デプロイ。Viteのビルドも内部で実行する |
| Supabase | DB・Storage・認証のバックエンド。PostgreSQL + S3互換ストレージ |

---

## 初回セットアップ

### 1. 依存インストール

```bash
cd app
npm install
```

### 2. Supabase CLIのインストール

```bash
npm install supabase --save-dev
npx supabase login
npx supabase link --project-ref 【Project ID】  # SupabaseダッシュボードのURLから確認
```

### 3. DBスキーマをSupabaseに反映

初回は migration の適用記録をリセットする必要がある：

```sql
-- SupabaseダッシュボードのSQL Editorで実行
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260323034309';
```

```bash
npx supabase db push
```

### 4. Storageバケットを手動作成

Supabaseダッシュボード → Storage → 「New bucket」から：

- 名前: `captures`
- Public: OFF（プライベート）

### 5. Vercel CLIのインストール・紐付け

```bash
npm install -g vercel
vercel login
vercel link  # プロジェクトを選択し、環境変数を .env.local に取得
```

### 6. 環境変数の設定

`vercel link` で `.env.local` が自動生成される。不足している場合は追加：

```bash
vercel env add VITE_ANTHROPIC_API_KEY_DEV   # ローカル開発用AnthropicキーのVITE変数
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_KEY
```

ローカル用の環境変数：

| 変数名 | 説明 |
|--------|------|
| `VITE_ANTHROPIC_API_KEY_DEV` | ローカル開発用AnthropicキーのAPIキー（本番とは別に発行する） |
| `VITE_SUPABASE_URL` | SupabaseのProject URL |
| `VITE_SUPABASE_KEY` | SupabaseのPublishable Key |

---

## ローカル開発

```bash
nvm use
npm run dev
# → http://localhost:5173
```

CORSは `vite.config.js` のプロキシが処理するため、ローカルでは `api/anthropic.js` は使われない。

---

## デプロイフロー

```
コード変更
  ↓
npx supabase db push   # DBスキーマの変更をSupabaseに反映（変更がある場合のみ）
  ↓
git push origin main   # VercelがViteビルドを自動実行してデプロイ
```

環境変数の変更時のみ：
```bash
vercel env add XXXX
```

本番（Vercel）の環境変数：

| 変数名 | 説明 |
|--------|------|
| `ANTHROPIC_API_KEY` | AnthropicのAPIキー（サーバー側・本番用） |
| `VITE_SUPABASE_URL` | SupabaseのProject URL |
| `VITE_SUPABASE_KEY` | SupabaseのPublishable Key |

---

## npm run の仕組み

`package.json` の `scripts` に定義されたコマンドが `npm run` で実行される。

```json
"scripts": {
  "dev":   "vite",       // 開発サーバー起動
  "build": "vite build"  // 本番用ビルド
}
```

### モードによる挙動の違い

| コマンド | Viteのモード | プロキシ | 用途 |
|---------|------------|---------|------|
| `npm run dev` | development | 有効 | ローカル開発 |
| `npm run build` | production | 無効 | Vercelへのデプロイ |

### なぜ同じコード（App.jsx）でローカルと本番の動きが変わるか

App.jsxは常に `/api/anthropic` にPOSTするだけ。その受け手が環境によって変わる：

```
ローカル（npm run dev）:
  /api/anthropic → Viteプロキシ → Anthropic API
  ※ プロキシはViteサーバーが生きている間だけ有効

本番（npm run build → Vercel）:
  /api/anthropic → Vercel Function（api/anthropic.js）→ Anthropic API
  ※ ビルド後はViteサーバーは存在しない
```

### 環境変数の仕組み（VITE_プレフィックス）

`VITE_` で始まる環境変数は**ビルド時にJSに値が焼き込まれる**。

```javascript
// コード上はこう書く
import.meta.env.VITE_SUPABASE_URL

// ビルド後は実際の値に置き換わる
"https://xxxx.supabase.co"
```

Node.jsの `process.env` は実行時に読むが、`import.meta.env` はビルド時に埋め込まれる点が異なる。
`VITE_` のないもの（`ANTHROPIC_API_KEY` など）はビルド後のJSには含まれず、サーバー側（Vercel Function）でのみ参照できる。

---

## スキーマ変更の手順

```bash
npx supabase migration new 【変更内容の名前】
# → supabase/migrations/タイムスタンプ_名前.sql が生成される
# → SQLを書いて保存
npx supabase db push
```
