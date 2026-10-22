/**
 * 운영자 계정 생성 (회원가입 API로는 운영자를 만들 수 없다).
 *
 *   npm run build
 *   DATABASE_URL=... npm run operator:create -- --email ops@example.com --name 홍길동 [--department 운영팀]
 *
 * 비밀번호는 실행 중에 화면에 표시되지 않는 프롬프트로 두 번 입력받는다 (셸 기록에 남지 않게 인자로 받지 않음).
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { findUserByEmail, normalizeEmail } from '../modules/auth/auth.service';
import { askHidden, parseArgs } from './cli';

const MIN_PASSWORD = 10;

export async function createOperator(input: { email: string; name: string; password: string; department?: string }) {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('올바른 이메일이 아닙니다');
  if (!input.name.trim()) throw new Error('이름을 입력하세요');
  if (input.password.length < MIN_PASSWORD) throw new Error(`운영자 비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다`);
  if (await findUserByEmail(email)) throw new Error('이미 있는 이메일입니다 (기존 계정은 바꾸지 않습니다)');

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  return prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash,
      role: 'OPERATOR',
      isVerified: true,
      operatorProfile: { create: { department: input.department?.trim() || null } },
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = typeof args.email === 'string' ? args.email : '';
  const name = typeof args.name === 'string' ? args.name : '';
  if (!email || !name) {
    console.error('사용법: npm run operator:create -- --email <이메일> --name <이름> [--department <부서>]');
    process.exit(2);
  }
  const dbHost = (() => { try { return new URL(process.env.DATABASE_URL ?? '').host; } catch { return '(알 수 없음)'; } })();
  console.log(`대상 DB: ${dbHost}`);

  const password = await askHidden('비밀번호: ');
  const again = await askHidden('비밀번호 확인: ');
  if (password !== again) { console.error('비밀번호가 일치하지 않습니다'); process.exit(1); }

  const user = await createOperator({ email, name, password, department: typeof args.department === 'string' ? args.department : undefined });
  console.log(`운영자 계정을 만들었습니다: ${user.email} (${user.name}) id=${user.id}`);
}

if (require.main === module) {
  main()
    .catch(err => { console.error(`실패: ${(err as Error).message}`); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
