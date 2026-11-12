import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 글꼴은 저장소에 넣어 둔 Google 조각을 쓴다 (빌드 때 외부에서 받지 않는다).
 * - 모든 조각에 unicode-range가 있어 화면에 나오는 글자의 조각만 받는다 (통째 파일 없음)
 * - 지금 쓰는 굵기만, 라이선스(OFL) 함께
 * - 서비스워커가 /fonts/ 조각도 캐시한다
 */

const ROOT = join(__dirname, '..', '..');
const css = readFileSync(join(ROOT, 'src', 'app', 'fonts.css'), 'utf8');
const faces = (css.match(/@font-face\s*\{[^}]+\}/g) ?? []).map(b => ({
  family: b.match(/font-family:\s*'([^']+)'/)?.[1] ?? '',
  weight: b.match(/font-weight:\s*(\d+)/)?.[1] ?? null,
  style: b.match(/font-style:\s*(\w+)/)?.[1] ?? null,
  url: b.match(/url\((\/fonts\/[^)]+)\)/)?.[1] ?? null,
  range: /unicode-range:/.test(b),
}));
const real = faces.filter(f => !f.family.endsWith('Fallback'));

describe('저장소에 넣은 글꼴', () => {
  it('빌드가 Google Fonts를 부르지 않는다 (next/font/google을 쓰지 않음)', () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
    });
    const users = walk(join(ROOT, 'src')).filter(p => !p.includes(`${join('src', 'test')}`) && readFileSync(p, 'utf8').includes('next/font/google'));
    expect(users).toEqual([]);
    expect(readFileSync(join(ROOT, 'src', 'app', 'layout.tsx'), 'utf8')).toContain("import './fonts.css';");
  });

  it('모든 조각에 unicode-range가 있고, 파일이 저장소에 있다', () => {
    expect(real.length).toBeGreaterThan(0);
    for (const f of real) {
      expect(f.range, `${f.family} ${f.url}`).toBe(true);
      expect(f.url).toMatch(/^\/fonts\/[a-z-]+\/[\w-]+\.\d*\.?woff2$|^\/fonts\/[a-z-]+\/[\w-]+\.woff2$/);
      expect(existsSync(join(ROOT, 'public', f.url!)), f.url!).toBe(true);
    }
  });

  it('지금 쓰는 굵기만 (Noto Sans KR 400·500·700, Gowun Batang 400·700, Cormorant Garamond 500 이탤릭)', () => {
    const set = (family: string) => Array.from(new Set(real.filter(f => f.family === family).map(f => `${f.weight}${f.style === 'italic' ? 'i' : ''}`))).sort();
    expect(set('Noto Sans KR')).toEqual(['400', '500', '700']);
    expect(set('Gowun Batang')).toEqual(['400', '700']);
    expect(set('Cormorant Garamond')).toEqual(['500i']);
    expect(Array.from(new Set(real.map(f => f.family))).sort()).toEqual(['Cormorant Garamond', 'Gowun Batang', 'Noto Sans KR']);
  });

  it('안 쓰는 조각 파일이 남아 있지 않다', () => {
    const used = new Set(real.map(f => f.url));
    for (const dir of ['noto-sans-kr', 'gowun-batang', 'cormorant-garamond']) {
      for (const n of readdirSync(join(ROOT, 'public', 'fonts', dir)).filter(x => x.endsWith('.woff2'))) {
        expect(used.has(`/fonts/${dir}/${n}`), n).toBe(true);
      }
    }
  });

  it('글꼴마다 OFL 라이선스 파일이 함께 있다', () => {
    for (const dir of ['noto-sans-kr', 'gowun-batang', 'cormorant-garamond']) {
      expect(readFileSync(join(ROOT, 'public', 'fonts', dir, 'OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    }
  });

  it('tailwind가 쓰는 변수를 정의한다 (전과 같은 글꼴 이름 + 크기 맞춘 대체 글꼴)', () => {
    expect(css).toContain("--font-sans: 'Noto Sans KR', 'Noto Sans KR Fallback';");
    expect(css).toContain("--font-serif: 'Gowun Batang', 'Gowun Batang Fallback';");
    expect(css).toContain("--font-accent: 'Cormorant Garamond', 'Cormorant Garamond Fallback';");
    expect(faces.filter(f => f.family.endsWith('Fallback'))).toHaveLength(3);
  });

  it('서비스워커가 /fonts/ 조각을 캐시하고, 오래 캐시해도 되는 헤더를 준다', () => {
    expect(readFileSync(join(ROOT, 'scripts', 'sw.template.js'), 'utf8')).toMatch(/url\.pathname\.startsWith\('\/fonts\/'\)/);
    const next = readFileSync(join(ROOT, 'next.config.ts'), 'utf8');
    expect(next).toContain("source: '/fonts/:path*'");
    expect(next).toContain('public, max-age=31536000, immutable');
  });
});
