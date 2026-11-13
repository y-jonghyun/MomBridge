import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';

/**
 * 출시 첫날 빈 상태 (app-feel PR 8) — 보여 줄 것이 없을 때 한 줄 대신 다음 행동을 준다.
 * 미션 0개 → 단골 가게에 알리기 · 커뮤니티 0개 → 첫 글 쓰기 · 내 활동 0개 → 단계 미리보기 + 프로필 채우기 ·
 * 가게 미션 0개 → 첫 미션 안내 (금액 없음)
 */

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
const params = new URLSearchParams();
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => params,
  useRouter: () => router,
}));

const routes = vi.hoisted(() => ({ map: {} as Record<string, unknown> }));
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(async (url: string) => {
      const key = Object.keys(routes.map).find(k => String(url).startsWith(k));
      return { data: { data: key ? routes.map[key] : [] } };
    }),
    post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
  },
  apiErrorMessage: () => '실패했습니다',
}));
const bookmarkState = { ids: new Set<string>(), load: vi.fn(), toggle: vi.fn() };
vi.mock('@/lib/bookmarks', () => ({
  useBookmarks: (selector: (s: typeof bookmarkState) => unknown) => selector(bookmarkState),
}));
vi.mock('@/lib/payout', () => ({
  PAYOUT_DELAY_HINT: '검수가 늦어지면 다음 달로 미뤄질 수 있어요',
  fetchNextPayoutDate: vi.fn(async () => null),
  payoutLabel: () => '12월 10일',
}));
vi.mock('@/lib/self-click', () => ({ syncSelfClickCookie: vi.fn() }));

import MissionBrowser, { defaultMissionFilter } from '@/components/missions/MissionBrowser';
import CommunityPage from '@/app/community/page';
import ParticipantPage from '@/app/participant/page';
import ClientPage from '@/app/client/page';
import { FOR_SHOPS_URL } from '@/components/missions/ShareWithShopsButton';

const USER = { id: 'u1', email: 'a@b.c', name: '지은', role: 'PARTICIPANT' as const };
const signIn = (role: 'PARTICIPANT' | 'CLIENT') =>
  useAuthStore.setState({ user: { ...USER, role } as never, token: 't', refreshToken: 'r' });

beforeEach(() => {
  routes.map = {
    '/missions': { missions: [] },
    '/notifications': { notifications: [], unreadCount: 0 },
    '/community/posts/best': [],
    '/community/posts': { posts: [], total: 0 },
  };
});
afterEach(() => {
  useAuthStore.setState({ user: null, token: null, refreshToken: null });
  vi.clearAllMocks();
  // @ts-expect-error 테스트에서 붙인 공유 창을 치운다
  delete navigator.share;
});

describe('미션 목록 0개 — 단골 가게에 알리기', () => {
  it('지역만 고른 채 0개면 "아직 서울에 열린 미션이 없어요" + 공유 버튼 + 다른 지역 보기', async () => {
    render(<MissionBrowser initialFilter={{ ...defaultMissionFilter, regionSi: '서울특별시' }} />);
    expect(await screen.findByRole('heading', { name: '아직 서울에 열린 미션이 없어요' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '단골 가게에 알리기' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '다른 지역 미션 보기' })).toBeTruthy();
  });

  it('휴대폰 공유 창으로 가게 안내(/for-shops) 주소를 보낸다', async () => {
    const share = vi.fn(async () => {});
    Object.assign(navigator, { share });
    render(<MissionBrowser />);
    fireEvent.click(await screen.findByRole('button', { name: '단골 가게에 알리기' }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect((share.mock.calls[0] as unknown as [{ url: string }])[0].url).toBe(FOR_SHOPS_URL);
    expect(FOR_SHOPS_URL).toMatch(/\/for-shops$/);
  });

  it('공유 창이 없으면 주소를 복사하고 알린다', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<MissionBrowser />);
    fireEvent.click(await screen.findByRole('button', { name: '단골 가게에 알리기' }));
    expect(await screen.findByText('가게 안내 주소를 복사했어요. 사장님께 보내 주세요.')).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(FOR_SHOPS_URL);
  });

  it('검색어로 걸러서 0개면 예전처럼 "조건에 맞는 미션이 없어요"', async () => {
    render(<MissionBrowser initialFilter={{ ...defaultMissionFilter, keyword: '빵' }} />);
    expect(await screen.findByText(/조건에 맞는 미션이 없어요/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '단골 가게에 알리기' })).toBeNull();
  });
});

describe('커뮤니티 0개 — 첫 글 쓰기', () => {
  it('로그인했으면 주제 예시를 누르면 제목·분류가 채워진 글쓰기 창이 열린다', async () => {
    signIn('PARTICIPANT');
    render(<CommunityPage />);
    expect(await screen.findByRole('heading', { name: '우리 동네 첫 이야기를 들려주세요' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '체험단이 처음이에요' }));
    expect((await screen.findByDisplayValue('체험단이 처음이에요')).tagName).toBe('INPUT');
    expect(screen.getByDisplayValue('질문/문의')).toBeTruthy();
  });

  it('로그인 전이면 "로그인하고 첫 글 쓰기"', async () => {
    render(<CommunityPage />);
    const link = await screen.findByRole('link', { name: '로그인하고 첫 글 쓰기' });
    expect(link.getAttribute('href')).toBe('/login');
  });
});

describe('내 활동 0개 — 단계 미리보기 + 프로필 채우기', () => {
  it('신청이 없으면 앞으로의 단계를 보여 주고, 프로필이 덜 찼으면 채우기를 권한다', async () => {
    routes.map['/participant/profile'] = { complete: false };
    signIn('PARTICIPANT');
    render(<ParticipantPage />);
    expect(await screen.findByRole('heading', { name: '신청한 미션이 없어요' })).toBeTruthy();
    expect(screen.getByText('맘브릿지가 신청자를 확인하고 골라요')).toBeTruthy();
    expect(screen.getByRole('link', { name: '미션 둘러보기' }).getAttribute('href')).toBe('/missions');
    expect(await screen.findByRole('heading', { name: '프로필을 미리 채워 두세요' })).toBeTruthy();
  });

  it('프로필이 다 찼으면 프로필 카드는 없다', async () => {
    routes.map['/participant/profile'] = { complete: true };
    signIn('PARTICIPANT');
    render(<ParticipantPage />);
    await screen.findByRole('heading', { name: '신청한 미션이 없어요' });
    await waitFor(() => expect(screen.queryByRole('heading', { name: '프로필을 미리 채워 두세요' })).toBeNull());
  });
});

describe('가게 첫 화면 — 미션 0개', () => {
  it('첫 미션 안내 · 예시 · 비용 문의 — 금액은 없다', async () => {
    routes.map['/client/missions'] = [];
    routes.map['/client/profile'] = { complete: true };
    routes.map['/auth/me'] = { user: { name: '사장님', phone: '' } };
    signIn('CLIENT');
    const { container } = render(<ClientPage />);
    expect(await screen.findByRole('heading', { name: '첫 미션을 등록해 보세요' })).toBeTruthy();
    // 결제를 받기 전에는 대신 등록해 준다는 사실대로
    expect(screen.getByText('지금은 맘브릿지가 대신 등록해 드려요')).toBeTruthy();
    expect(screen.getByRole('link', { name: '비용 문의하기' }).getAttribute('href')).toMatch(/^mailto:/);
    // 등록 버튼은 아래 고정 막대 하나 — 첫 화면 안에 겹치는 버튼을 두지 않는다
    expect(screen.queryByRole('link', { name: '첫 미션 등록 문의하기' })).toBeNull();
    const first = container.querySelector('[aria-labelledby="first-mission"]')!;
    expect(first.textContent).not.toMatch(/\d원|₩/);
  });
});
