import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 루트(/)는 보는 사람에 따라 다르다.
 * - 로그인 전: 소개 화면 (히어로 · 소개 카드 · 미션 미리보기 · 진행 · 보상 예시 · 약속 · 사장님 띠)
 * - 로그인 후: 지금까지 쓰던 미션 중심 홈
 *
 * '한부모' 같은 사회적 가치 문구는 홈에 두지 않는다 (/for-shops에만).
 */

const missionsMock = vi.hoisted(() => ({ list: [] as unknown[] }));
const authMock = vi.hoisted(() => ({ user: null as { id: string; role: string; name: string } | null }));

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(async () => ({ data: { data: { missions: missionsMock.list } } })),
    post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
  },
}));

// zustand 저장소는 선택자를 받는다 — 테스트에서는 고정된 상태를 넘겨 준다
vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (s: { user: unknown }) => unknown) => selector({ user: authMock.user }),
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

// vi.mock은 위로 끌어올려지므로 평범하게 들여와도 위의 가짜가 먼저 걸린다
import HomeView from '@/components/home/HomeView';

/** 카드에는 제목이 아니라 `[동] 가게 이름`이 찍힌다 (toCardData) */
const mission = (id: string, shop: string) => ({
  id, title: `미션 ${id}`, description: '설명', category: 'SNS', rewardAmount: 30000,
  regionSi: '서울특별시', regionGu: '마포구', regionDong: '합정동',
  endDate: '2026-12-31T00:00:00.000Z', currentCount: 1, maxParticipants: 5,
  momTags: [], clientProfile: { businessName: shop },
});

beforeEach(() => { missionsMock.list = []; authMock.user = null; });
afterEach(() => vi.clearAllMocks());

describe('로그인 전 홈', () => {
  it('소개 히어로와 사장님 안내 링크가 나온다', async () => {
    render(<HomeView />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('아이 등원 후 두 시간');
    expect(screen.getByRole('heading', { name: '맘브릿지는 이런 곳이에요' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '이렇게 진행돼요' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '우리가 지키는 것' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '가게 사장님이신가요?' })).toBeTruthy();

    const shops = screen.getAllByRole('link').find(a => a.getAttribute('href') === '/for-shops');
    expect(shops).toBeTruthy();
  });

  it("'한부모'라는 말이 없다", () => {
    const { container } = render(<HomeView />);
    expect(container.textContent).not.toContain('한부모');
  });

  it('미션이 0개면 미리보기 구역이 통째로 없다', async () => {
    const { container } = render(<HomeView />);
    await waitFor(() => expect(container.textContent).toContain('맘브릿지는 이런 곳이에요'));

    expect(screen.queryByRole('heading', { name: '우리 동네 미션 미리보기' })).toBeNull();
    expect(screen.queryByText('전체 보기')).toBeNull();
  });

  it('미션이 있으면 최대 4개까지 미리 보여 준다', async () => {
    missionsMock.list = ['1', '2', '3', '4', '5'].map(n => mission(n, `가게 ${n}`));
    render(<HomeView />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '우리 동네 미션 미리보기' })).toBeTruthy());
    expect(screen.getByText('[합정동] 가게 1')).toBeTruthy();
    expect(screen.getByText('[합정동] 가게 4')).toBeTruthy();
    expect(screen.queryByText('[합정동] 가게 5')).toBeNull();
    expect(screen.getByText('전체 보기')).toBeTruthy();
  });
});

describe('로그인 후 홈', () => {
  beforeEach(() => { authMock.user = { id: 'u1', role: 'PARTICIPANT', name: '엄마' }; });

  it('지금까지 쓰던 미션 중심 홈이 그대로 나온다', async () => {
    missionsMock.list = [mission('1', '가게 1')];
    const { container } = render(<HomeView />);

    await waitFor(() => expect(container.textContent).toContain('가볍게 버는 시간'));
    // 소개 화면의 히어로가 아니라 기존 홈 히어로다
    expect(container.textContent).not.toContain('아이 등원 후 두 시간');
    expect(screen.getByPlaceholderText('가게 이름, 동네로 찾기')).toBeTruthy();
  });

  it('미션이 0개면 빈 안내와 함께 소개 카드를 보여 준다', async () => {
    const { container } = render(<HomeView />);

    // 히어로에도 같은 글이 있으므로 개수로 본다
    await waitFor(() => expect(screen.getAllByText('맘브릿지 알아보기').length).toBeGreaterThan(0));
    const about = screen.getAllByRole('link').filter(a => a.getAttribute('href') === '/about');
    expect(about.length).toBeGreaterThan(0);
    expect(container.textContent).toContain('언제 보상을 받는지');
  });
});
