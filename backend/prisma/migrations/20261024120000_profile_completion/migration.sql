-- 프로필 완성에 필요한 칸을 더한다. 전부 추가만 하므로 기존 데이터는 그대로다.
-- (참여자 자녀 연령대, 고객사 업종)

-- CreateEnum
CREATE TYPE "ChildAgeGroup" AS ENUM ('INFANT', 'TODDLER', 'ELEMENTARY', 'NONE');

-- AlterTable
ALTER TABLE "participant_profiles" ADD COLUMN "childAgeGroups" "ChildAgeGroup"[];

-- AlterTable
ALTER TABLE "client_profiles" ADD COLUMN "businessCategory" "BusinessCategory";
