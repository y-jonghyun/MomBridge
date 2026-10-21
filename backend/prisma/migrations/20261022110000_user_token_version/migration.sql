-- 리프레시 토큰 무효화용 버전. 기본값이 있어 기존 행은 0이 되고, 이전 버전 코드도 그대로 동작한다.
-- AlterTable
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
