import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppBar from '@/components/ui/AppBar';
import BottomTabBar from '@/components/ui/BottomTabBar';
import { useAuthStore } from '@/store/auth';
import { useUnreadStore } from '@/lib/unread-notifications';
import MissionsPage from '@/app/missions/page';

/**
 * 탭 첫 화면의 앱 막대와 하단 탭.
 * - 화면 제목이 머리글(h1)이 되고, 작은 제목은 스크롤 뒤에만 보이는 장식이다
 * - 로그인 전에는 '로그인'이 한 번만 나온다 (커뮤니티의 중복 제거)
 * - 하단 탭: 지금 탭은 clay-tint 알약, 참여자의 안 읽은 알림은 '내 활동'에 숫자
 */

const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  default: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  apiErrorMessage: () => '실패했습니다',
}));
vi.mock('@/lib/bookmarks', () => ({
  useBookmarks: (selector: (s: { ids: Set<string>; load: () => void; toggle: () => void }) => unknown) =>
    selector({ ids: new Set<string>(), load: vi.fn(), toggle: vi.fn() }),
}));

const PARTICIPANT = { id: 'u1', email: 'a@b.com', name: '하은', role: 'PARTICIPANT' as const };

beforeEach(() => {
  apiGet.mockResolvedValue({ data: { data: { missions: [], notifications: [], unreadCount: 0 } } });
});
afterEach(() => {
  useAuthStore.setState({ user: null, token: null, refreshToken: null });
  useUnreadStore.setState({ count: 0, fetchedAt: 0 });
  apiGet.mockReset();
});

describe('앱 막대', () => {
  it('화면 제목이 유일한 h1이고, 머리말과 화면별 동작을 함께 둔다', () => {
    render(<AppBar title="내 활동" eyebrow="11월 12일 목요일" actions={<button type="button">알림</button>} />);
    expect(screen.getAllByRole('heading', { level: 1 }).map(h => h.textContent)).toEqual(['내 활동']);
    expect(screen.getByText('11월 12일 목요일')).toBeTruthy();
    expect(screen.getByRole('button', { name: '알림' })).toBeTruthy();
  });

  it('스크롤 뒤에 보이는 작은 제목은 화면 읽기에서 빠진다', () => {
    const { container } = render(<AppBar title="미션" />);
    const compact = Array.from(container.querySelectorAll('[aria-hidden="true"]')).find(el => el.textContent === '미션');
    expect(compact).toBeTruthy();
  });

  it('로그인 전에는 로그인 링크가 한 번만 있다 (모바일 막대 · 데스크톱 머리글 중 화면에 하나만 보인다)', () => {
    render(<AppBar title="커뮤니티" />);
    const links = screen.getAllByRole('link', { name: '로그인' });
    // 모바일 막대 하나 + 데스크톱 머리글 하나 (CSS로 둘 중 하나만 보임), 제목 줄에는 없다
    expect(links).toHaveLength(2);
    const titleRow = screen.getByRole('heading', { level: 1 }).closest('header')!;
    expect(within(titleRow).queryByRole('link', { name: '로그인' })).toBeNull();
  });

  it('내 화면처럼 계정 메뉴가 필요 없으면 모바일 막대에서 숨긴다', () => {
    const { container } = render(<AppBar title="내 활동" showAccount={false} />);
    const mobileBar = container.querySelector('.sticky')!;
    expect(within(mobileBar as HTMLElement).queryByRole('link', { name: '로그인' })).toBeNull();
  });

  it('미션 탭의 화면 제목은 탭 이름과 같은 "미션"', () => {
    render(<MissionsPage />);
    expect(screen.getByRole('heading', { level: 1, name: '미션' })).toBeTruthy();
  });
});

describe('하단 탭', () => {
  it('지금 있는 탭에 알약을 둔다', () => {
    render(<BottomTabBar />);
    const home = screen.getByRole('link', { name: /홈/ });
    expect(home.getAttribute('aria-current')).toBe('page');
    expect(home.querySelector('span')?.className).toContain('bg-clay-tint');
    expect(screen.getByRole('link', { name: /미션/ }).querySelector('span')?.className).not.toContain('bg-clay-tint');
  });

  it('참여자의 안 읽은 알림 수를 내 활동에 보여 준다', async () => {
    useAuthStore.setState({ user: PARTICIPANT, token: 't', refreshToken: 'r' });
    apiGet.mockResolvedValue({ data: { data: { notifications: [], unreadCount: 3 } } });
    render(<BottomTabBar />);
    await act(async () => { await Promise.resolve(); });
    expect(within(screen.getByRole('link', { name: /내 활동/ })).getByText('3')).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith('/notifications');
  });

  it('로그인 전에는 알림을 묻지 않고 숫자도 없다', () => {
    render(<BottomTabBar />);
    expect(apiGet).not.toHaveBeenCalledWith('/notifications');
    expect(within(screen.getByRole('link', { name: /내 활동/ })).queryByText(/^\d/)).toBeNull();
  });

  it('1분 안에 다시 묻지 않는다', () => {
    useAuthStore.setState({ user: PARTICIPANT, token: 't', refreshToken: 'r' });
    useUnreadStore.setState({ count: 2, fetchedAt: Date.now() });
    render(<BottomTabBar />);
    expect(apiGet).not.toHaveBeenCalledWith('/notifications');
    expect(within(screen.getByRole('link', { name: /내 활동/ })).getByText('2')).toBeTruthy();
  });
});
