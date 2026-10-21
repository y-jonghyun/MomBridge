import { execSync } from 'child_process';

// TEST_DATABASE_URL이 있으면 마이그레이션을 적용한 뒤 통합 테스트를 실행한다.
export default function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
