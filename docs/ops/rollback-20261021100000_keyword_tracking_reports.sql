-- 되돌리기 SQL: 마이그레이션 20261021100000_keyword_tracking_reports
-- 자동 실행되지 않는다. 정말 필요할 때만, 백업 후 Session pooler/직접 연결(5432)로 수동 실행한다.
-- 주의: 키워드·추적 링크·클릭·리포트 공유·운영 설정·리뷰 확인 결과 데이터가 모두 삭제된다.
--
-- 대부분의 경우 이 SQL은 필요 없다. 새 컬럼·테이블은 이전 버전 코드와 함께 써도 문제가 없으므로
-- (campaignCode에는 DB 기본값이 있음) 장애 시에는 Render에서 이전 배포로 Rollback만 하면 된다.
--
-- 실행 후 Prisma 기록도 지운다(맨 아래). 그러지 않으면 다음 migrate deploy가 이 마이그레이션을 다시 적용하지 않는다.

BEGIN;

DROP TABLE IF EXISTS "click_daily";
DROP TABLE IF EXISTS "click_daily_visitors";
DROP TABLE IF EXISTS "click_events";
DROP TABLE IF EXISTS "tracking_links";
DROP TABLE IF EXISTS "report_share_links";
DROP TABLE IF EXISTS "mission_keywords";
DROP TABLE IF EXISTS "keyword_cache";
DROP TABLE IF EXISTS "platform_settings";

ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_disclosureConfirmedById_fkey";
ALTER TABLE "submissions"
  DROP COLUMN IF EXISTS "disclosureCheck",
  DROP COLUMN IF EXISTS "disclosureConfirmNote",
  DROP COLUMN IF EXISTS "disclosureConfirmedAt",
  DROP COLUMN IF EXISTS "disclosureConfirmedById",
  DROP COLUMN IF EXISTS "postCheckResult",
  DROP COLUMN IF EXISTS "postCheckedAt";

DROP INDEX IF EXISTS "missions_campaignCode_key";
ALTER TABLE "missions"
  DROP COLUMN IF EXISTS "campaignCode",
  DROP COLUMN IF EXISTS "destinationUrl";

DROP TYPE IF EXISTS "DisclosureCheck";
DROP TYPE IF EXISTS "DeviceType";
DROP TYPE IF EXISTS "KeywordRole";

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261021100000_keyword_tracking_reports';

COMMIT;
