Supabaseのマイグレーションを作成・適用します。

## 引数

`$ARGUMENTS` にマイグレーションの内容や目的を指定してください。
例: `/migrate eventsテーブルにindexを追加`

## 手順

1. `app/supabase/migrations/` の既存ファイルを確認して現在のスキーマを把握する
2. タイムスタンプ付きのファイル名（`YYYYMMDDHHMMSS_説明.sql`）でマイグレーションファイルを作成する
3. SQLの内容を説明してユーザーに確認を求める
4. 承認後に `cd app && npx supabase db push` を実行する
5. 成功したらマイグレーション内容を `docs/adr.md` に記録が必要か確認する

## 注意

- RLSを外すようなマイグレーションは必ず警告する
- `service_role` に権限を付与するSQLは拒否する
