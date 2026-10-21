import { prisma } from '../../src/config/database';

/** DB가 없으면 통합 테스트를 건너뛴다 (CI는 Postgres 서비스로 항상 실행) */
export const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

export async function resetDb(): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map(r => `"public"."${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export { prisma };
