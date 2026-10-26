import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { estimateHeight, smallTouchTargets } from './helpers/touch-targets';
import AccountMenu from '@/components/ui/AccountMenu';
import MissionEmptyBox from '@/components/missions/MissionEmptyBox';
import LoginPage from '@/app/login/page';
import HomeView from '@/components/home/HomeView';
import AboutPage from '@/app/about/page';
import ForShopsPage from '@/app/for-shops/page';
import { useAuthStore } from '@/store/auth';

/**
 * 누를 수 있는 것은 44px 이상 (디자인 기준 1번).
 * 작은 링크가 다시 생기면 여기서 실패한다.
 *
 * jsdom은 높이를 재지 못해 클래스에 적힌 크기로 본다 — 자세한 내용은 helpers/touch-targets.ts.
 */

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(async () => ({ data: { data: { missions: [] } } })),
    post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
  },
  apiErrorMessage: () => '실패했습니다',
}));
vi.mock('@/lib/bookmarks', () => ({
  useBookmarks: (selector: (s: { ids: Set<string>; load: () => void; toggle: () => void }) => unknown) =>
    selector({ ids: new Set<string>(), load: vi.fn(), toggle: vi.fn() }),
}));
vi.mock('@/lib/payout', () => ({
  PAYOUT_DELAY_HINT: '검수가 늦어지면 다음 달로 미뤄질 수 있어요',
  fetchNextPayoutDate: vi.fn(async () => null),
  payoutLabel: () => '11월 10일',
}));

const USER = { id: 'u1', email: 'a@b.com', name: '윤종현', role: 'OPERATOR' as const };

afterEach(() => useAuthStore.setState({ user: null, token: null, refreshToken: null }));

describe('클래스에서 높이 읽기', () => {
  it('높이 클래스를 읽는다', () => {
    expect(estimateHeight('h-11 w-11')).toBe(44);
    expect(estimateHeight('min-h-[44px] items-center')).toBe(44);
    expect(estimateHeight('h-[34px]')).toBe(34);
    expect(estimateHeight('flex h-12')).toBe(48);
  });

  it('세로 패딩도 높이로 친다', () => {
    expect(estimateHeight('py-3.5 text-muted')).toBe(48);
    expect(estimateHeight('py-2')).toBe(36);
  });

  it('크기를 적지 않으면 모른다고 한다', () => {
    expect(estimateHeight('text-clay underline')).toBeNull();
    // 조건부 클래스는 가장 작은 화면 기준이 아니라서 세지 않는다
    expect(estimateHeight('sm:h-11')).toBeNull();
  });
});

describe('주요 화면의 누를 수 있는 것', () => {
  it('로그인 전 홈', async () => {
    const { container } = render(<HomeView />);
    expect(smallTouchTargets(container)).toEqual([]);
  });

  it('로그인 화면 (로그인 전)', () => {
    const { container } = render(<LoginPage />);
    expect(smallTouchTargets(container)).toEqual([]);
  });

  it('로그인 화면 (이미 로그인한 상태)', async () => {
    useAuthStore.setState({ user: USER, token: 't', refreshToken: 'r' });
    const { container } = render(<LoginPage />);
    await screen.findByText(/으로 로그인되어 있어요/);
    expect(smallTouchTargets(container)).toEqual([]);
  });

  it('맘브릿지 소개 (/about)', () => {
    const { container } = render(<AboutPage />);
    expect(smallTouchTargets(container)).toEqual([]);
  });

  it('사장님 안내 (/for-shops)', () => {
    const { container } = render(<ForShopsPage />);
    expect(smallTouchTargets(container)).toEqual([]);
  });

  it('계정 메뉴 (열린 상태)', () => {
    useAuthStore.setState({ user: USER, token: 't', refreshToken: 'r' });
    const { container } = render(<AccountMenu />);
    fireEvent.click(screen.getByRole('button', { name: /계정 메뉴/ }));
    expect(smallTouchTargets(container)).toEqual([]);
  });

  it('빈 목록 안내 상자', () => {
    const { container } = render(
      <MissionEmptyBox message="우리 동네 미션을 준비하고 있어요." actionLabel="다른 지역 미션 보기" actionHref="/missions" />,
    );
    expect(smallTouchTargets(container)).toEqual([]);
  });
});
