-- events テーブルに user_id を追加
ALTER TABLE "public"."events"
  ADD COLUMN "user_id" uuid REFERENCES auth.users(id) DEFAULT auth.uid();

-- 既存のRLSポリシーを削除
DROP POLICY IF EXISTS "allow authenticated insert" ON "public"."events";
DROP POLICY IF EXISTS "allow authenticated select" ON "public"."events";
DROP POLICY IF EXISTS "allow authenticated insert" ON "storage"."objects";
DROP POLICY IF EXISTS "allow authenticated select" ON "storage"."objects";

-- events: 自分のデータのみ
CREATE POLICY "users insert own events" ON "public"."events"
  FOR INSERT TO "authenticated"
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users select own events" ON "public"."events"
  FOR SELECT TO "authenticated"
  USING (auth.uid() = user_id);

-- storage: 自分のフォルダ（{user_id}/filename）のみ
CREATE POLICY "users insert own files" ON "storage"."objects"
  FOR INSERT TO "authenticated"
  WITH CHECK (bucket_id = 'captures' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users select own files" ON "storage"."objects"
  FOR SELECT TO "authenticated"
  USING (bucket_id = 'captures' AND (storage.foldername(name))[1] = auth.uid()::text);
