-- 운영 DB에 기록 없이 생겨 있던 두 가지를 스키마·마이그레이션에 기록한다 (운영 DB는 바꾸지 않음).
-- 운영: paidAt은 이미 TIMESTAMP(6), notifications_created 인덱스도 이미 있음 → 아래 두 문은 아무 일도 하지 않는다.
-- 새로 만드는 DB(로컬·CI)에서만 실제로 적용된다.

-- paidAt 정밀도 3 → 6. 이미 6이면 ALTER 자체를 실행하지 않아 테이블 잠금도 없다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'missions'
      AND column_name = 'paidAt' AND datetime_precision <> 6
  ) THEN
    ALTER TABLE "missions" ALTER COLUMN "paidAt" SET DATA TYPE TIMESTAMP(6);
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_created" ON "notifications"("createdAt" DESC);
