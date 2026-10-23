-- 회원가입 약관·개인정보 동의 기록

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('AGE_14', 'TERMS', 'PRIVACY', 'MARKETING');

-- CreateTable
CREATE TABLE "user_consents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "agreed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_consents_userId_type_idx" ON "user_consents"("userId", "type");

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase PostgREST(anon 키)로 노출되지 않게 RLS를 켠다 (정책 없음 = 앱만 접근)
ALTER TABLE "user_consents" ENABLE ROW LEVEL SECURITY;
