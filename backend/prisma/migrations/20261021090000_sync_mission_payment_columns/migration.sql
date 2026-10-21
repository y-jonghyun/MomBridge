-- 결제 컬럼이 schema.prisma에는 있으나 기존 마이그레이션에 누락돼 있던 드리프트 보정.
-- 운영 DB에 `prisma db push` 등으로 이미 컬럼이 추가돼 있을 수 있으므로 IF NOT EXISTS로 멱등하게 작성한다.
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "orderId" VARCHAR(200);
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "paymentKey" VARCHAR(200);
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(12,2);
