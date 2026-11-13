import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 화면 전환 (app-feel PR 9) — 기본은 꺼짐, 환경 변수 하나로 켜고 끔, 움직임 줄이기면 항상 꺼짐.
 */

const nav = vi.hoisted(() => ({ pathname: '/missions' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import PageTransition from '@/components/PageTransition';
import { VEIL_KEYFRAMES, slideKeyframes } from '@/lib/page-transitions';

const animate = vi.fn();
let reduced = false;

beforeEach(() => {
  nav.pathname = '/missions';
  reduced = false;
  animate.mockClear();
  (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
  window.matchMedia = vi.fn((q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? reduced : false,
    media: q, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => { delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate; });

const page = (enabled: boolean) => (
  <PageTransition enabled={enabled}>
    <a href="/missions/m1">미션 1</a>
    <nav aria-label="하단 메뉴"><a href="/community">커뮤니티</a></nav>
  </PageTransition>
);

describe('화면 전환', () => {
  it('꺼져 있으면 감싸는 상자도 없고 움직이지 않는다', () => {
    const { container, rerender } = render(page(false));
    expect(container.querySelector('[data-page-transition]')).toBeNull();
    nav.pathname = '/missions/m1';
    rerender(page(false));
    expect(animate).not.toHaveBeenCalled();
  });

  it('처음 열 때는 움직이지 않고, 링크로 들어가면 오른쪽에서 들어온다', () => {
    const { getByText, rerender } = render(page(true));
    expect(animate).not.toHaveBeenCalled();
    fireEvent.click(getByText('미션 1'));
    nav.pathname = '/missions/m1';
    rerender(page(true));
    expect(animate).toHaveBeenCalledWith(slideKeyframes('forward'), expect.objectContaining({ duration: 220 }));
    expect(animate).toHaveBeenCalledWith(VEIL_KEYFRAMES, expect.objectContaining({ duration: 220 }));
    expect(slideKeyframes('forward')![0]).toMatchObject({ left: '24px' });
  });

  it('뒤로 가기는 왼쪽에서, 하단 탭은 흐려졌다 나타난다 (옆으로 움직이지 않는다)', () => {
    const { getByText, rerender } = render(page(true));
    nav.pathname = '/missions/m1';
    rerender(page(true));
    animate.mockClear();

    window.dispatchEvent(new PopStateEvent('popstate'));
    nav.pathname = '/missions';
    rerender(page(true));
    expect(animate).toHaveBeenCalledWith(slideKeyframes('back'), expect.anything());
    expect(slideKeyframes('back')![0]).toMatchObject({ left: '-24px' });
    animate.mockClear();

    fireEvent.click(getByText('커뮤니티'));
    nav.pathname = '/community';
    rerender(page(true));
    // 탭은 옆으로 밀지 않고 가림막만 걷는다
    expect(slideKeyframes('tab')).toBeNull();
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledWith(VEIL_KEYFRAMES, expect.anything());
  });

  it('움직임 줄이기를 켠 사용자에게는 켜져 있어도 움직이지 않는다', () => {
    reduced = true;
    const { rerender } = render(page(true));
    nav.pathname = '/missions/m1';
    rerender(page(true));
    expect(animate).not.toHaveBeenCalled();
  });

  it('하단 탭 막대(position: fixed)를 끌고 다니거나 흐리게 하지 않는다', () => {
    // 화면 상자는 transform·opacity를 쓰지 않는다 (fixed가 묶이거나 함께 흐려진다)
    for (const k of ['forward', 'back'] as const) {
      expect(slideKeyframes(k)!.some(f => 'transform' in f || 'translate' in f || 'opacity' in f)).toBe(false);
    }
    // 가림막은 하단 막대(z-30)보다 아래, 앱 막대(z-20)보다 위
    const { container } = render(page(true));
    const veil = container.querySelector('[data-page-transition-veil]')!;
    expect(veil.className).toContain('z-[25]');
    expect(veil.className).toContain('pointer-events-none');
    expect(veil.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('켜고 끄는 환경 변수 (next.config.ts)', () => {
  const ORIGINAL = { ...process.env };
  afterEach(() => { process.env = { ...ORIGINAL }; vi.resetModules(); });

  const resolved = async () => {
    vi.resetModules();
    const cfg = (await import('../../next.config')).default as { env?: Record<string, string> };
    return cfg.env?.NEXT_PUBLIC_PAGE_TRANSITIONS;
  };

  it('비워 두면 운영·로컬은 꺼짐, Vercel 프리뷰는 켬', async () => {
    delete process.env.NEXT_PUBLIC_PAGE_TRANSITIONS;
    process.env.VERCEL_ENV = 'production';
    expect(await resolved()).toBe('off');
    delete process.env.VERCEL_ENV;
    expect(await resolved()).toBe('off');
    process.env.VERCEL_ENV = 'preview';
    expect(await resolved()).toBe('on');
  });

  it('값을 주면 그 값이 이긴다 (운영에서 켜기 · 프리뷰에서 끄기)', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_PAGE_TRANSITIONS = 'on';
    expect(await resolved()).toBe('on');
    process.env.VERCEL_ENV = 'preview';
    process.env.NEXT_PUBLIC_PAGE_TRANSITIONS = 'off';
    expect(await resolved()).toBe('off');
  });
});
