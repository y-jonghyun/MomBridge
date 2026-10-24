-- 미션마다 방문할 곳의 주소를 따로 적을 수 있게 한다.
-- 비어 있으면 화면이 고객사 프로필의 주소를 대신 보여 준다 (추가만 하므로 기존 미션은 그대로).

-- AlterTable
ALTER TABLE "missions" ADD COLUMN "visitAddress" VARCHAR(500);
