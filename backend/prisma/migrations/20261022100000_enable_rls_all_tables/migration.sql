-- public 스키마의 모든 테이블에 RLS를 켠다 (정책은 만들지 않음 = anon·authenticated 역할은 모든 행 차단).
-- 기존 테이블은 Supabase에서 직접 켜 두었고, 20261021100000_keyword_tracking_reports로 만든 8개만 빠져 있었다.
-- 앱(Prisma)은 테이블 소유자(postgres)로 접속하므로 RLS의 영향을 받지 않는다 (FORCE ROW LEVEL SECURITY는 쓰지 않음).
-- 이미 켜진 테이블은 건너뛴다 → 운영에서는 8개 테이블에만 ALTER가 실행된다.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;
