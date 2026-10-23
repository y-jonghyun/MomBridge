-- 휴대폰 번호를 User로 모은다.
-- 운영 데이터가 아직 없어 옮길 값이 없다(client_profiles.contactPhone은 그대로 버린다).
-- 번호는 숫자만 저장하고, 한 번호로 두 계정을 만들지 못하게 유일 인덱스를 건다.
-- users.phone은 NULL을 허용한다 — 스크립트로 만드는 운영자 계정에는 번호가 없다.
-- (NULL은 유일 인덱스에서 서로 충돌하지 않는다)

-- AlterTable
ALTER TABLE "users" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

-- 혹시 값이 들어 있다면 숫자만 남긴다 (중복이 있으면 아래 인덱스 생성이 실패해 마이그레이션이 멈춘다)
UPDATE "users" SET "phone" = regexp_replace("phone", '[^0-9]', '', 'g') WHERE "phone" IS NOT NULL;
UPDATE "users" SET "phone" = NULL WHERE "phone" = '';

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- DropColumn
ALTER TABLE "client_profiles" DROP COLUMN "contactPhone";
