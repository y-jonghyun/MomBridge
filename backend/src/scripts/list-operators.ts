/**
 * 운영자 계정 목록 (읽기 전용).
 *
 *   npm run build
 *   DATABASE_URL=... npm run operator:list
 */
import { prisma } from '../config/database';

async function main() {
  const dbHost = (() => { try { return new URL(process.env.DATABASE_URL ?? '').host; } catch { return '(알 수 없음)'; } })();
  const operators = await prisma.user.findMany({
    where: { role: 'OPERATOR' },
    select: { email: true, name: true, isActive: true, createdAt: true, lastLoginAt: true, deletedAt: true, operatorProfile: { select: { id: true } } },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`대상 DB: ${dbHost} · 운영자 ${operators.length}명`);
  console.table(operators.map(o => ({
    email: o.email,
    name: o.name,
    active: o.isActive && !o.deletedAt,
    profile: o.operatorProfile ? 'O' : 'X (프로필 없음)',
    createdAt: o.createdAt.toISOString().slice(0, 16).replace('T', ' '),
    lastLoginAt: o.lastLoginAt ? o.lastLoginAt.toISOString().slice(0, 16).replace('T', ' ') : '-',
  })));
}

main()
  .catch(err => { console.error(`실패: ${(err as Error).message}`); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
