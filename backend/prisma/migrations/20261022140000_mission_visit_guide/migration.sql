-- 미션별 방문·예약 안내 (상세 화면의 고정 문구를 대신함). NULL 허용이라 기존 미션·이전 코드에 영향 없음
-- AlterTable
ALTER TABLE "missions" ADD COLUMN "visitGuide" TEXT;
