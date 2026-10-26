import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccountMenu from '@/components/ui/AccountMenu';
import { useAuthStore } from '@/store/auth';

/**
 * 상단 바 계정 메뉴.
 * 전에는 종 아이콘이 '내 활동' 링크여서 알림으로 오해를 샀고, 로그아웃은 화면마다 숨어 있었다.
 */

const USER = { id: 'u1', email: 'a@b.com', name: '윤종현', role: 'OPERATOR' as const };

// 로그아웃이 주소를 바꾸는 것까지 확인한다
const assign = vi.fn();
beforeEach(() => {
  useAuthStore.setState({ user: USER, token: 't', refreshToken: 'r' });
  assign.mockClear();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, set href(v: string) { assign(v); }, get href() { return 'http://localhost/'; } },
  });
});
afterEach(() => {
  useAuthStore.setState({ user: null, token: null, refreshToken: null });
  sessionStorage.clear();
});

describe('계정 메뉴', () => {
  it('이름과 역할, 내 화면, 로그아웃을 보여 준다', () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole('button', { name: /계정 메뉴/ }));

    const menu = screen.getByRole('menu');
    expect(menu.textContent).toContain('윤종현');
    expect(menu.textContent).toContain('관리자');
    expect(screen.getByRole('menuitem', { name: '관리자 화면' }).getAttribute('href')).toBe('/operator');
    expect(screen.getByRole('menuitem', { name: '로그아웃' })).toBeTruthy();
  });

  it('Esc로 닫힌다', () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole('button', { name: /계정 메뉴/ }));
    expect(screen.getByRole('menu')).toBeTruthy();

    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('바깥을 누르면 닫힌다', () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole('button', { name: /계정 메뉴/ }));

    act(() => { fireEvent.mouseDown(document.body); });

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('로그아웃하면 저장된 로그인이 비고 홈으로 간다', () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole('button', { name: /계정 메뉴/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '로그아웃' }));

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(assign).toHaveBeenCalledWith('/');
    // 홈에서 한 번 보여 줄 안내 표시를 남긴다
    expect(sessionStorage.getItem('mombridge-logout-notice')).toBe('1');
  });

  it('로그인 전에는 아무것도 그리지 않는다', () => {
    useAuthStore.setState({ user: null, token: null, refreshToken: null });
    const { container } = render(<AccountMenu />);
    expect(container.textContent).toBe('');
  });

  it('버튼은 44px 터치 영역을 지킨다', () => {
    render(<AccountMenu />);
    const button = screen.getByRole('button', { name: /계정 메뉴/ });
    expect(button.className).toContain('h-11');
    expect(button.className).toContain('w-11');
  });
});
