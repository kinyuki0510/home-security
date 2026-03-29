# SENTINEL Home Security

自宅カメラ映像をAIで解析するホームセキュリティアプリ。個人用・1人開発。

## 技術スタック

| 役割 | 技術 |
|------|------|
| フロントエンド | React + Vite（`app/src/`） |
| APIハンドラ | Vercel Functions（`app/api/`） |
| DB・Storage・Auth | Supabase |
| AI解析 | Anthropic claude-haiku-4-5-20251001 |
| デプロイ | Vercel（`main`ブランチへのpushで自動） |

## よく使うコマンド

```bash
cd app
npm run dev        # ローカル開発
npm test           # テスト
npm run lint       # lint
npm run build      # ビルド確認

npx supabase db push   # マイグレーション適用

bash scripts/security-check.sh  # セキュリティチェック
```

## アーキテクチャの要点

- フロントは `/api/anthropic` を叩く（本番はVercel Function、ローカルはViteプロキシ経由）
- Supabase anon keyはフロントに露出するが設計上許容（RLSで保護）
- `VITE_` プレフィックスの変数はバンドルに埋め込まれブラウザから見える
- `VITE_` なしの変数はサーバーサイド専用（Vercel Functionのみ）

## セキュリティルール（絶対に破らないこと）

- `service_role key` をフロントに置かない
- Anthropic API keyを `VITE_` 変数にしない
- RLSなしでテーブルを公開しない
- フロントでのバリデーションをセキュリティとして扱わない（サーバー側で必ず検証）
- `/api/anthropic` への変更はJWT検証・safeBodyを維持する

## 環境変数

| 変数名 | 場所 | 用途 |
|--------|------|------|
| `VITE_SUPABASE_URL` | Vercel（全環境） | フロントのSupabase接続 |
| `VITE_SUPABASE_KEY` | Vercel（全環境） | フロントのSupabase anon key |
| `SUPABASE_URL` | Vercel（本番） | APIハンドラのJWT検証用 |
| `SUPABASE_ANON_KEY` | Vercel（本番） | APIハンドラのJWT検証用 |
| `ANTHROPIC_API_KEY` | Vercel（本番） | APIハンドラのAnthropicアクセス |
| `VITE_ANTHROPIC_API_KEY_DEV` | `.env`（ローカルのみ） | ローカル開発のみ（Vercelには設定しない） |

## DB管理

マイグレーションファイルは `app/supabase/migrations/` で管理。
変更は必ずmigrationファイルを作成してから `npx supabase db push` で適用する。
ダッシュボードで直接変更しない。

## テスト方針

- `api/anthropic.test.js` — ハンドラの正常系・異常系
- `api/security.test.js` — セキュリティ観点のテスト
- Supabaseの呼び出しは `vi.mock` でモック
- テストでは実際のAnthropicAPIを叩かない

## ブランチ・デプロイ

- `main` → 本番（Vercel自動デプロイ）
- `feature/*` → 開発ブランチ
- PRはmainへ

## 参照ドキュメント

- `docs/adr.md` — 設計判断の記録
- `docs/security/pentest-manual.md` — ペネトレーションテスト手順
