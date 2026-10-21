-- 키워드 추천 · 추적 링크 · 클릭 집계 · 리포트 공유 · 운영 설정

-- CreateEnum
CREATE TYPE "KeywordRole" AS ENUM ('MAIN', 'SUB');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('MOBILE', 'PC', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DisclosureCheck" AS ENUM ('AUTO_PASSED', 'NEEDS_MANUAL_REVIEW', 'MANUAL_CONFIRMED');

-- AlterTable
ALTER TABLE "missions" ADD COLUMN     "campaignCode" VARCHAR(12),
ADD COLUMN     "destinationUrl" VARCHAR(2048);

-- 기존 미션에 캠페인 코드(utm_campaign) 부여: 소문자 16진수 8자
UPDATE "missions" SET "campaignCode" = substr(md5(random()::text || "id"::text), 1, 8) WHERE "campaignCode" IS NULL;
ALTER TABLE "missions" ALTER COLUMN "campaignCode" SET NOT NULL;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "disclosureCheck" "DisclosureCheck",
ADD COLUMN     "disclosureConfirmNote" TEXT,
ADD COLUMN     "disclosureConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "disclosureConfirmedById" UUID,
ADD COLUMN     "postCheckResult" JSONB,
ADD COLUMN     "postCheckedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "mission_keywords" (
    "id" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "keyword" VARCHAR(100) NOT NULL,
    "role" "KeywordRole" NOT NULL,
    "monthlyPcQc" INTEGER,
    "monthlyMobileQc" INTEGER,
    "isLowVolume" BOOLEAN NOT NULL DEFAULT false,
    "compIdx" VARCHAR(10),
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_cache" (
    "cacheKey" VARCHAR(300) NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "response" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_cache_pkey" PRIMARY KEY ("cacheKey")
);

-- CreateTable
CREATE TABLE "tracking_links" (
    "id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "applicationId" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "tracking_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_events" (
    "id" BIGSERIAL NOT NULL,
    "linkId" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dayKey" DATE NOT NULL,
    "refererDomain" VARCHAR(255),
    "device" "DeviceType" NOT NULL,
    "isBot" BOOLEAN NOT NULL,
    "botRule" VARCHAR(50),
    "isUnique" BOOLEAN NOT NULL,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_daily_visitors" (
    "linkId" UUID NOT NULL,
    "dayKey" DATE NOT NULL,
    "visitorHash" CHAR(64) NOT NULL,

    CONSTRAINT "click_daily_visitors_pkey" PRIMARY KEY ("linkId","dayKey","visitorHash")
);

-- CreateTable
CREATE TABLE "click_daily" (
    "linkId" UUID NOT NULL,
    "dayKey" DATE NOT NULL,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "mobileClicks" INTEGER NOT NULL DEFAULT 0,
    "pcClicks" INTEGER NOT NULL DEFAULT 0,
    "unknownClicks" INTEGER NOT NULL DEFAULT 0,
    "botClicks" INTEGER NOT NULL DEFAULT 0,
    "referers" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "click_daily_pkey" PRIMARY KEY ("linkId","dayKey")
);

-- CreateTable
CREATE TABLE "report_share_links" (
    "id" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "createdBy" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "mission_keywords_missionId_role_idx" ON "mission_keywords"("missionId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "mission_keywords_missionId_keyword_key" ON "mission_keywords"("missionId", "keyword");

-- CreateIndex
CREATE INDEX "keyword_cache_expiresAt_idx" ON "keyword_cache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_links_code_key" ON "tracking_links"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_links_applicationId_key" ON "tracking_links"("applicationId");

-- CreateIndex
CREATE INDEX "tracking_links_missionId_idx" ON "tracking_links"("missionId");

-- CreateIndex
CREATE INDEX "tracking_links_participantId_idx" ON "tracking_links"("participantId");

-- CreateIndex
CREATE INDEX "click_events_linkId_dayKey_idx" ON "click_events"("linkId", "dayKey");

-- CreateIndex
CREATE INDEX "click_events_dayKey_idx" ON "click_events"("dayKey");

-- CreateIndex
CREATE INDEX "click_daily_visitors_dayKey_idx" ON "click_daily_visitors"("dayKey");

-- CreateIndex
CREATE INDEX "click_daily_dayKey_idx" ON "click_daily"("dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "report_share_links_tokenHash_key" ON "report_share_links"("tokenHash");

-- CreateIndex
CREATE INDEX "report_share_links_missionId_idx" ON "report_share_links"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "missions_campaignCode_key" ON "missions"("campaignCode");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_disclosureConfirmedById_fkey" FOREIGN KEY ("disclosureConfirmedById") REFERENCES "operator_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_keywords" ADD CONSTRAINT "mission_keywords_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_links" ADD CONSTRAINT "tracking_links_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_links" ADD CONSTRAINT "tracking_links_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "tracking_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_daily" ADD CONSTRAINT "click_daily_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "tracking_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_share_links" ADD CONSTRAINT "report_share_links_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 캠페인당 메인 키워드는 1개
CREATE UNIQUE INDEX "mission_keywords_one_main_per_mission" ON "mission_keywords"("missionId") WHERE "role" = 'MAIN';
