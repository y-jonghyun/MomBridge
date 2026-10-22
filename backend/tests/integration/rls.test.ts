import { describeDb, prisma } from '../helpers/db';

// Supabase는 public 스키마를 PostgREST(anon 키)로 노출한다. RLS가 꺼진 테이블은 anon으로 읽고 쓸 수 있으므로
// 새 테이블을 만드는 마이그레이션에는 반드시 ENABLE ROW LEVEL SECURITY를 함께 넣어야 한다.
describeDb('RLS', () => {
  it('is enabled on every table in the public schema', async () => {
    const rows = await prisma.$queryRaw<{ relname: string }[]>`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
      ORDER BY 1`;
    expect(rows.map(r => r.relname)).toEqual([]);
  });

  it('blocks a non-owner role without policies while the app (owner) keeps full access', async () => {
    // anon 역할 흉내: 권한(GRANT)은 있어도 정책이 없으면 0행
    await prisma.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_test_anon') THEN CREATE ROLE rls_test_anon NOLOGIN; END IF;
    END $$`);
    await prisma.$executeRawUnsafe('GRANT rls_test_anon TO CURRENT_USER');
    await prisma.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO rls_test_anon');
    await prisma.$executeRawUnsafe('GRANT SELECT, INSERT ON platform_settings TO rls_test_anon');
    await prisma.platformSetting.upsert({
      where: { key: 'rls.test' }, update: { value: 1 }, create: { key: 'rls.test', value: 1 },
    });

    const asAnon = await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE rls_test_anon');
      return tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM platform_settings`;
    });
    expect(Number(asAnon[0].n)).toBe(0);
    await expect(prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE rls_test_anon');
      await tx.$executeRawUnsafe(`INSERT INTO platform_settings (key, value, "updatedAt") VALUES ('rls.anon', '1', now())`);
    })).rejects.toThrow(/row-level security/);

    expect(await prisma.platformSetting.findUnique({ where: { key: 'rls.test' } })).not.toBeNull();
    await prisma.platformSetting.delete({ where: { key: 'rls.test' } });
  });
});
