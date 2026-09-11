-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OPERATOR', 'PARTICIPANT', 'CLIENT');

-- CreateEnum
CREATE TYPE "MissionCategory" AS ENUM ('VISIT', 'SNS', 'REVIEW', 'VIDEO');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'REVIEWING', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SnsType" AS ENUM ('INSTAGRAM', 'YOUTUBE', 'TIKTOK', 'NAVER_BLOG', 'KAKAO', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MISSION_OPEN', 'APPLICATION_RESULT', 'SUBMISSION_FEEDBACK', 'PAYOUT_COMPLETED', 'MISSION_DEADLINE', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "profileImage" VARCHAR(2048),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bio" TEXT,
    "regionSi" VARCHAR(50) NOT NULL,
    "regionGu" VARCHAR(50) NOT NULL,
    "regionDong" VARCHAR(50),
    "totalEarned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "missionCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sns_accounts" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "platform" "SnsType" NOT NULL,
    "handle" VARCHAR(200) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "followerCount" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sns_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "businessName" VARCHAR(200) NOT NULL,
    "businessNumber" VARCHAR(20),
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "address" VARCHAR(500) NOT NULL,
    "regionSi" VARCHAR(50) NOT NULL,
    "regionGu" VARCHAR(50) NOT NULL,
    "regionDong" VARCHAR(50),
    "contactEmail" VARCHAR(320),
    "contactPhone" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "department" VARCHAR(100),
    "position" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" UUID NOT NULL,
    "clientProfileId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "MissionCategory" NOT NULL,
    "status" "MissionStatus" NOT NULL DEFAULT 'DRAFT',
    "regionSi" VARCHAR(50) NOT NULL,
    "regionGu" VARCHAR(50) NOT NULL,
    "regionDong" VARCHAR(50),
    "maxParticipants" INTEGER NOT NULL DEFAULT 1,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "rewardAmount" DECIMAL(12,2) NOT NULL,
    "rewardDescription" TEXT,
    "requirements" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "submissionDeadline" TIMESTAMP(3) NOT NULL,
    "thumbnailUrl" VARCHAR(2048),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_tags" (
    "missionId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_tags_pkey" PRIMARY KEY ("missionId","tagId")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "reviewerId" UUID,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "reviewerId" UUID,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "contentUrl" VARCHAR(2048),
    "mediaUrls" VARCHAR(2048)[],
    "description" TEXT,
    "snsPostUrl" VARCHAR(2048),
    "reviewNote" TEXT,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "maxRevisions" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "bankName" VARCHAR(50),
    "bankAccount" VARCHAR(50),
    "accountHolder" VARCHAR(50),
    "externalTxId" VARCHAR(200),
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "resourceId" UUID,
    "resourceType" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "targetTable" VARCHAR(100) NOT NULL,
    "targetId" UUID NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_isActive_role_idx" ON "users"("isActive", "role");

-- CreateIndex
CREATE UNIQUE INDEX "participant_profiles_userId_key" ON "participant_profiles"("userId");

-- CreateIndex
CREATE INDEX "participant_profiles_regionSi_regionGu_idx" ON "participant_profiles"("regionSi", "regionGu");

-- CreateIndex
CREATE UNIQUE INDEX "sns_accounts_profileId_platform_key" ON "sns_accounts"("profileId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_userId_key" ON "client_profiles"("userId");

-- CreateIndex
CREATE INDEX "client_profiles_regionSi_regionGu_idx" ON "client_profiles"("regionSi", "regionGu");

-- CreateIndex
CREATE UNIQUE INDEX "operator_profiles_userId_key" ON "operator_profiles"("userId");

-- CreateIndex
CREATE INDEX "missions_status_isVisible_idx" ON "missions"("status", "isVisible");

-- CreateIndex
CREATE INDEX "missions_regionSi_regionGu_status_idx" ON "missions"("regionSi", "regionGu", "status");

-- CreateIndex
CREATE INDEX "missions_category_status_idx" ON "missions"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "applications_missionId_status_idx" ON "applications"("missionId", "status");

-- CreateIndex
CREATE INDEX "applications_participantId_status_idx" ON "applications"("participantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "applications_missionId_participantId_key" ON "applications"("missionId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_applicationId_key" ON "submissions"("applicationId");

-- CreateIndex
CREATE INDEX "submissions_missionId_status_idx" ON "submissions"("missionId", "status");

-- CreateIndex
CREATE INDEX "submissions_participantId_status_idx" ON "submissions"("participantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_submissionId_key" ON "payouts"("submissionId");

-- CreateIndex
CREATE INDEX "payouts_participantId_status_idx" ON "payouts"("participantId", "status");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "participant_profiles" ADD CONSTRAINT "participant_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sns_accounts" ADD CONSTRAINT "sns_accounts_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "participant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_profiles" ADD CONSTRAINT "operator_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_tags" ADD CONSTRAINT "mission_tags_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_tags" ADD CONSTRAINT "mission_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "operator_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "operator_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
