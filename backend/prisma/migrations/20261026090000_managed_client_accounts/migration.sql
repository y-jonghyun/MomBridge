-- 운영자가 대신 만든 가게 계정 표시 (추가만 한다. 기존 행은 모두 false)
ALTER TABLE "users" ADD COLUMN "managedByOperator" BOOLEAN NOT NULL DEFAULT false;
