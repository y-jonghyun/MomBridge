-- CreateEnum
CREATE TYPE "BusinessCategory" AS ENUM ('FOOD', 'CAFE', 'KIDS', 'BEAUTY', 'LIVING', 'ETC');

-- CreateEnum
CREATE TYPE "MomTimeTag" AS ENUM ('WEEKDAY_DAY', 'WEEKEND_OK', 'KID_FRIENDLY', 'AT_HOME');

-- AlterTable
ALTER TABLE "missions" ADD COLUMN     "announceDate" TIMESTAMP(3),
ADD COLUMN     "businessCategory" "BusinessCategory",
ADD COLUMN     "momTags" "MomTimeTag"[],
ADD COLUMN     "visitHours" VARCHAR(100);

-- CreateTable
CREATE TABLE "mission_images" (
    "id" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "storagePath" VARCHAR(512) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mission_images_missionId_sortOrder_idx" ON "mission_images"("missionId", "sortOrder");

-- CreateIndex
CREATE INDEX "bookmarks_participantId_createdAt_idx" ON "bookmarks"("participantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_participantId_missionId_key" ON "bookmarks"("participantId", "missionId");

-- CreateIndex
CREATE INDEX "missions_businessCategory_status_idx" ON "missions"("businessCategory", "status");

-- AddForeignKey
ALTER TABLE "mission_images" ADD CONSTRAINT "mission_images_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 새 테이블에도 RLS를 켠다. 정책을 만들지 않으므로 anon·authenticated 역할은 모든 행이 막히고,
-- 앱(Prisma)은 테이블 소유자로 접속하므로 영향을 받지 않는다 (20261022100000_enable_rls_all_tables와 같은 방식).
ALTER TABLE "mission_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookmarks" ENABLE ROW LEVEL SECURITY;
