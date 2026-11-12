import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InstallPrompt from '@/components/common/InstallPrompt';
import BottomTabBar from '@/components/ui/BottomTabBar';
import { StickyCTA } from '@/components/ui';
import { ABOVE_BOTTOM_BAR } from '@/lib/bottom-chrome';

/**
 * 설치 배너가 하단 고정 막대(탭 막대·신청 버튼)나 그 위 내용을 가리지 않게 하는 장치.
 * 막대는 자기 높이를 --mb-bottom-bar로, 배너는 자기 높이(+간격)를 --mb-install-banner로 알리고
 * 배너는 막대 위에 뜬다. jsdom은 높이를 재지 못하므로 getBoundingClientRect를 바꿔 끼운다.
 */

const root = () => document.documentElement.style;

function fakeHeight(px: number) {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    height: px, width: 390, top: 0, left: 0, right: 390, bottom: px, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect);
}

function firePrompt() {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  e.prompt = async () => {};
  e.userChoice = Promise.resolve({ outcome: 'dismissed' });
  act(() => { window.dispatchEvent(e); });
}

beforeEach(() => {
  // 브라우저 탭(설치 전) 상태
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
  try { window.localStorage.clear(); } catch { /* 없음 */ }
});

afterEach(() => {
  vi.restoreAllMocks();
  root().removeProperty('--mb-bottom-bar');
  root().removeProperty('--mb-install-banner');
});

describe('하단 고정 막대가 자기 높이를 알린다', () => {
  it('탭 막대', () => {
    fakeHeight(76);
    const { unmount } = render(<BottomTabBar />);
    expect(root().getPropertyValue('--mb-bottom-bar')).toBe('76px');
    unmount();
    expect(root().getPropertyValue('--mb-bottom-bar')).toBe('');
  });

  it('하단 고정 신청 버튼', () => {
    fakeHeight(77);
    render(<StickyCTA label="신청하기" />);
    expect(root().getPropertyValue('--mb-bottom-bar')).toBe('77px');
  });

  it('숨겨진 막대(데스크톱의 탭 막대)는 0으로 알린다', () => {
    fakeHeight(0);
    render(<BottomTabBar />);
    expect(root().getPropertyValue('--mb-bottom-bar')).toBe('0px');
  });
});

describe('설치 배너', () => {
  it('하단 막대 위에 뜨고, 떠 있는 동안 자기 높이 + 간격만큼 아래 여백을 요구한다', () => {
    fakeHeight(64);
    render(<InstallPrompt />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(root().getPropertyValue('--mb-install-banner')).toBe('');

    firePrompt();
    const banner = screen.getByRole('dialog', { name: '맘브릿지 앱 설치' });
    expect(banner.style.bottom).toBe(ABOVE_BOTTOM_BAR);
    expect(root().getPropertyValue('--mb-install-banner')).toBe('72px');
  });

  it('닫으면 여백도 돌려놓는다', () => {
    fakeHeight(64);
    render(<InstallPrompt />);
    firePrompt();
    fireEvent.click(screen.getByRole('button', { name: '설치 안내 닫기' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(root().getPropertyValue('--mb-install-banner')).toBe('');
  });

  it('설치 앱(standalone)에서는 띄우지 않는다', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
    render(<InstallPrompt />);
    firePrompt();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(root().getPropertyValue('--mb-install-banner')).toBe('');
  });
});
