/**
 * scripts/sw.template.js 에 빌드 버전을 넣어 public/sw.js 를 만든다.
 * package.json의 prebuild로 `npm run build` 직전에 자동으로 돈다 (Vercel 빌드 포함).
 *
 * 버전 = 커밋 해시 앞 7자리 + 빌드 시각.
 *   - 커밋 해시: Vercel은 VERCEL_GIT_COMMIT_SHA를 주고, 로컬은 git에서 읽는다 (둘 다 없으면 'local')
 *   - 빌드 시각: 같은 커밋을 다시 배포하거나 커밋 전 변경을 빌드해도 버전이 겹치지 않게
 * sw.js 내용이 바뀌어야 브라우저가 새 서비스워커를 받으므로, 배포마다 값이 달라지는 것이 목적이다.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLACEHOLDER = '__SW_VERSION__';

function commit() {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'local';
  }
}

const version = `${commit()}-${Date.now().toString(36)}`;
const template = readFileSync(join(ROOT, 'scripts', 'sw.template.js'), 'utf8');
if (!template.includes(PLACEHOLDER)) {
  throw new Error(`scripts/sw.template.js 에 ${PLACEHOLDER} 가 없습니다`);
}
writeFileSync(join(ROOT, 'public', 'sw.js'), template.replaceAll(PLACEHOLDER, version));
console.log(`public/sw.js (VERSION ${version})`);
