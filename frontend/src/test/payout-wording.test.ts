import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 지급액 문구는 실제 정산과 같아야 한다.
 * 지금 정산(backend config/fees.ts)은 수수료 10%만 빼고 세금은 빼지 않는다 →
 * 화면에 "세금을 뺐다"는 말을 쓰지 않는다. 세금은 "있으면 따로 안내"로만 말한다.
 *
 * 약관·개인정보처리방침 본문은 세무 확인 뒤 따로 정하므로 이 검사에서 뺀다.
 */
const SRC = join(__dirname, '..');
const SKIP = ['app/terms/', 'app/privacy/', 'test/'];
const CLAIMS = [/세금\s*공제/, /수수료\s*·\s*세금/, /세금\s*\d+(\.\d+)?\s*%/, /원천징수/, /세후/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(name) ? [p] : [];
  });
}

describe('지급액 문구', () => {
  it('약관·개인정보처리방침 밖의 화면은 세금을 뺀다고 말하지 않는다', () => {
    const hits: string[] = [];
    for (const f of files(SRC)) {
      // 윈도우 경로(\)도 / 로 맞춰 비교한다
      const rel = relative(SRC, f).split(sep).join('/');
      if (SKIP.some(prefix => rel.startsWith(prefix))) continue;
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (CLAIMS.some(re => re.test(line))) hits.push(`${rel}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
