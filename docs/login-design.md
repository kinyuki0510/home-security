# ログイン機能 設計方針

## 概要

Magic Link方式（メールアドレス入力→メールのリンクをクリック→ログイン完了）でSupabase Authを使って実装する。

## なぜログインが必要か

現状はanonキーでSupabaseにアクセスしているため、URLを知った人が画像・履歴を閲覧できる状態。ログイン実装でauthenticatedユーザーのみに絞ることで根本解決する。

→ 詳細はADR-003参照

## なぜMagic Linkか

- パスワード管理不要
- iPhoneからメールリンク1タップでログイン可能
- Supabase Authが全部やってくれるので実装量が少ない

## アーキテクチャ

### 現在

```
ブラウザ（anon）→ Supabase（RLS: anonを許可）
```

### ログイン実装後

```
ブラウザ → Supabase Auth（Magic Link認証）
                ↓
           セッショントークン発行
                ↓
ブラウザ（authenticated）→ Supabase（RLS: authenticatedのみ許可）
```

### フロントの変更

- ログイン画面を追加（メールアドレス入力のみ）
- 未ログイン時はカメラ画面を表示しない
- Supabase Authのセッションを使ってAPIリクエスト

### RLSの変更

```sql
-- 現在
CREATE POLICY "allow anon insert" ON "public"."events" FOR INSERT TO "anon" WITH CHECK (true);
CREATE POLICY "allow anon select" ON "public"."events" FOR SELECT TO "anon" USING (true);

-- 変更後
CREATE POLICY "allow authenticated insert" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "allow authenticated select" ON "public"."events" FOR SELECT TO "authenticated" USING (true);
```

StorageのRLSも同様に変更する。

## 実装の変更箇所

| ファイル | 変更内容 |
|---------|---------|
| `src/App.jsx` | ログイン画面の追加、認証状態の管理 |
| `supabase/migrations/` | RLSポリシーをauthenticatedに変更するmigrationを追加 |

## 注意点

- Supabase AuthのMagic LinkはSupabaseダッシュボードでメール設定が必要
- ログイン後のリダイレクト先URLをSupabaseに登録する必要がある（本番URL）
- `anonキー` は引き続きフロントに存在するが、RLSでanonを拒否するため実害がなくなる
