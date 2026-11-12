import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DISPLAY_MODE_SCRIPT } from '@/lib/display-mode';
import SiteHeader from '@/components/ui/SiteHeader';
import AuthShell from '@/components/auth/AuthShell';
import BottomTabBar from '@/components/ui/BottomTabBar';
import tailwindConfig from '../../tailwind.config';

/**
 * 앱 공통 기반 (설치 앱 처리 · 누르는 반응 · 움직임 토큰 · 입력칸 대비).
 * CSS 자체는 jsdom이 그리지 못하므로, 규칙이 globals.css에 들어 있는지와 값이 기준을 넘는지를 본다.
 */

const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

function luminance(hex: string) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

afterEach(() => {
  document.documentElement.removeAttribute('data-display');
  vi.restoreAllMocks();
});

describe('설치 앱 표시', () => {
  const run = (standalone: boolean) => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: standalone });
    new Function(DISPLAY_MODE_SCRIPT)();
  };

  it('설치 앱으로 열면 <html data-display="standalone">', () => {
    run(true);
    expect(document.documentElement.dataset.display).toBe('standalone');
  });

  it('브라우저 탭에서는 표시하지 않는다', () => {
    run(false);
    expect(document.documentElement.dataset.display).toBeUndefined();
  });

  it('설치 앱에서 숨길 장식 규칙이 있다 (미디어 쿼리와 속성 두 가지)', () => {
    expect(css).toMatch(/@media \(display-mode: standalone\) \{ \.web-only \{ display: none !important; \} \}/);
    expect(css).toMatch(/html\[data-display='standalone'\] \.web-only \{ display: none !important; \}/);
  });

  it('머리글의 영문 "MomBridge" 줄은 사이트 장식으로 표시된다', () => {
    render(<SiteHeader />);
    expect(screen.getByText('MomBridge').classList).toContain('web-only');
  });

  it('로그인 화면의 영문 머리말도 같다', () => {
    render(<AuthShell title="로그인">내용</AuthShell>);
    expect(screen.getByText('MomBridge').classList).toContain('web-only');
  });
});

describe('입력칸 테두리 대비', () => {
  const field = css.match(/--mb-field-border:\s*(#[0-9A-Fa-f]{6})/)?.[1] ?? '';

  it('크림·paper 바탕 모두에서 3:1 이상 (WCAG 1.4.11)', () => {
    expect(field).not.toBe('');
    expect(contrast(field, '#F6F1E8')).toBeGreaterThanOrEqual(3);
    expect(contrast(field, '#FFFDF8')).toBeGreaterThanOrEqual(3);
  });

  it('tailwind의 line.strong과 같은 값이다', () => {
    const colors = tailwindConfig.theme?.extend?.colors as Record<string, Record<string, string>>;
    expect(colors.line.strong.toLowerCase()).toBe(field.toLowerCase());
  });

  it('입력칸·글상자·선택칸에 적용된다', () => {
    expect(css).toMatch(/textarea,\s*select\s*\{\s*border-color: var\(--mb-field-border\);/);
  });
});

describe('움직임', () => {
  it('움직임 토큰이 정의돼 있다', () => {
    for (const name of ['--mb-ease', '--mb-dur-press', '--mb-dur-quick', '--mb-dur-push', '--mb-dur-sheet-in', '--mb-dur-sheet-out']) {
      expect(css).toContain(`${name}:`);
    }
  });

  it('움직임 줄이기 설정에서는 전환·애니메이션·눌림을 끈다', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('transition-duration: 0.01ms !important');
    expect(block).toContain('animation-duration: 0.01ms !important');
    expect(block).toContain('scale: none');
  });

  it('탭할 때 파란 강조를 끄고, 버튼은 눌린다', () => {
    expect(css).toContain('-webkit-tap-highlight-color: transparent');
    expect(css).toMatch(/button:not\(:disabled\):active, \.press:active \{\s*scale: 0\.97;/);
  });

  it('하단 탭은 누르는 반응을 받는다', () => {
    render(<BottomTabBar />);
    for (const link of screen.getAllByRole('link')) expect(link.classList).toContain('press');
  });
});
