-- events テーブルのRLSをanonからauthenticatedに変更
DROP POLICY IF EXISTS "allow anon insert" ON "public"."events";
DROP POLICY IF EXISTS "allow anon select" ON "public"."events";

CREATE POLICY "allow authenticated insert" ON "public"."events"
  FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "allow authenticated select" ON "public"."events"
  FOR SELECT TO "authenticated" USING (true);

-- storage.objects（captures）のRLSをanonからauthenticatedに変更
DROP POLICY IF EXISTS "allow anon insert" ON "storage"."objects";
DROP POLICY IF EXISTS "allow anon select" ON "storage"."objects";

CREATE POLICY "allow authenticated insert" ON "storage"."objects"
  FOR INSERT TO "authenticated" WITH CHECK (bucket_id = 'captures');

CREATE POLICY "allow authenticated select" ON "storage"."objects"
  FOR SELECT TO "authenticated" USING (bucket_id = 'captures');
