import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';

/**
 * 미션 목록 → 상세 → 뒤로: 기억해 둔 목록을 바로 그려 스크롤이 제자리로 돌아오게,
 * 필터는 주소에 남겨 돌아와도 · 다른 탭에서 열어도 같게, 새 목록으로 바뀌어도 보던 카드가 밀리지 않게.
 */

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
vi.mock('next/navigation', () => ({
  usePathname: () => '/missions',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => router,
}));

// 요청마다 답을 손으로 풀어 주는 가짜 API (순서가 뒤바뀌는 경우를 만들려고)
const api = vi.hoisted(() => ({ calls: [] as { url: string; resolve: (v: unknown) => void }[] }));
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn((url: string) => new Promise(resolve => {
      if (String(url).startsWith('/missions')) api.calls.push({ url, resolve });
      else resolve({ data: { data: [] } });
    })),
    post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
  },
}));
const bookmarkState = vi.hoisted(() => ({ ids: new Set<string>(['m-a']), load: vi.fn(), toggle: vi.fn(), clear: vi.fn() }));
vi.mock('@/lib/bookmarks', () => ({
  useBookmarks: Object.assign(
    (selector: (s: typeof bookmarkState) => unknown) => selector(bookmarkState),
    { getState: () => bookmarkState },
  ),
}));

import MissionBrowser, { defaultMissionFilter, filterFromParams, filterToQuery } from '@/components/missions/MissionBrowser';
import { clearMissionListCache, missionListCacheSize, readMissionList, saveMissionList } from '@/lib/mission-list-cache';

const mission = (id: string, shop = `가게 ${id}`) => ({
  id, title: `미션 ${id}`, description: '설명', category: 'VISIT', rewardAmount: 30000,
  regionSi: '서울특별시', regionGu: '마포구', regionDong: '합정동', endDate: '2099-12-31T00:00:00Z',
  currentCount: 0, maxParticipants: 5, momTags: [], clientProfile: { businessName: shop },
});
const answer = async (i: number, missions: unknown[]) => {
  await act(async () => { api.calls[i].resolve({ data: { data: { missions } } }); });
};

beforeEach(() => {
  api.calls = [];
  clearMissionListCache();
  router.replace.mockClear();
  bookmarkState.clear.mockClear();
});
afterEach(() => { useAuthStore.setState({ user: null, token: null, refreshToken: null }); });

describe('필터 ↔ 주소', () => {
  it('지역·업종·유형·정렬·검색어·태그가 주소로 갔다가 그대로 돌아온다 (기본 정렬은 주소에 넣지 않는다)', () => {
    const f = { ...defaultMissionFilter, regionSi: '서울특별시', businessCategory: 'CAFE', category: 'VISIT', sort: 'REWARD', keyword: '빵', momTags: ['WEEKDAY'] };
    const q = filterToQuery(f, { forUrl: true });
    expect(filterFromParams(new URLSearchParams(q))).toEqual(f);
    expect(filterToQuery(defaultMissionFilter, { forUrl: true })).toBe('');
    expect(filterToQuery(defaultMissionFilter)).toBe('sort=NEWEST');
    // 모르는 정렬값은 기본으로
    expect(filterFromParams(new URLSearchParams('sort=WHATEVER')).sort).toBe('NEWEST');
  });

  it('조건을 바꾸면 주소를 바꾼다 (기록은 쌓지 않고, 스크롤도 건드리지 않는다)', async () => {
    render(<MissionBrowser syncUrl />);
    await answer(0, [mission('a')]);
    fireEvent.click(screen.getByRole('button', { name: 'SNS' }));
    expect(router.replace).toHaveBeenCalledWith('/missions?category=SNS', { scroll: false });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('syncUrl이 아니면 주소를 건드리지 않는다', async () => {
    render(<MissionBrowser />);
    await answer(0, [mission('a')]);
    fireEvent.click(screen.getByRole('button', { name: 'SNS' }));
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('돌아왔을 때 바로 그리기', () => {
  it('같은 조건을 기억해 두었으면 뼈대 없이 처음부터 목록을 그리고, 뒤에서 새로 받는다', async () => {
    const first = render(<MissionBrowser />);
    await answer(0, [mission('a'), mission('b')]);
    first.unmount();

    const { container } = render(<MissionBrowser />);
    // 아직 새 답이 오기 전인데도 목록이 있다
    expect(screen.getByText('[마포구 합정동] 가게 a')).toBeTruthy();
    expect(container.querySelector('.animate-pulse')).toBeNull();
    expect(api.calls).toHaveLength(2); // 뒤에서 다시 받는 중
    await answer(1, [mission('a'), mission('b')]);
    expect(screen.getByText('[마포구 합정동] 가게 b')).toBeTruthy();
  });

  it('조건을 빠르게 바꾸면 늦게 온 예전 답은 버린다', async () => {
    render(<MissionBrowser />);
    await answer(0, [mission('a')]);
    fireEvent.click(screen.getByRole('button', { name: 'SNS' }));   // 요청 1
    fireEvent.click(screen.getByRole('button', { name: '리뷰' }));  // 요청 2
    await answer(2, [mission('review')]);
    await answer(1, [mission('sns')]);                               // 늦게 온 예전 답
    expect(screen.getByText('[마포구 합정동] 가게 review')).toBeTruthy();
    expect(screen.queryByText('[마포구 합정동] 가게 sns')).toBeNull();
  });
});

describe('새 목록으로 바뀌어도 보던 카드가 밀리지 않는다', () => {
  const ROW = 300;
  let scrollY = 0;
  beforeEach(() => {
    scrollY = 500;
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
    window.scrollBy = vi.fn((_x: number, dy: number) => { scrollY += dy; }) as unknown as typeof window.scrollBy;
    // 카드 한 장 = 한 줄(300px)로 놓고, 화면 위치 = 순서 × 300 − 스크롤
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const cards = Array.from(document.querySelectorAll('[data-mission-id]'));
      const i = cards.indexOf(this);
      const top = i * ROW - scrollY;
      return { top, bottom: top + ROW, left: 0, right: 0, width: 0, height: ROW, x: 0, y: top, toJSON() {} } as DOMRect;
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('맨 위에 새 미션이 끼어들면 그만큼 스크롤을 내려 보던 카드(b)를 같은 자리에 둔다', async () => {
    saveMissionList(filterToQuery(defaultMissionFilter), [mission('a'), mission('b'), mission('c')]);
    render(<MissionBrowser />);
    // 스크롤 500: a는 −500~−200(안 보임), b는 −200~100(보이는 첫 카드)
    await answer(0, [mission('new'), mission('a'), mission('b'), mission('c')]);
    // 기억한 목록으로 그렸으니, 브라우저가 스크롤을 되돌리기(scroll 이벤트) 전에는 새 목록으로 바꾸지 않는다
    expect(document.querySelector('[data-mission-id="new"]')).toBeNull();
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
      await new Promise(r => requestAnimationFrame(() => r(null)));
      await Promise.resolve();
    });
    expect(document.querySelector('[data-mission-id="new"]')).not.toBeNull();
    expect(window.scrollBy).toHaveBeenCalledWith(0, ROW);
    const b = document.querySelector('[data-mission-id="b"]') as HTMLElement;
    expect(b.getBoundingClientRect().top).toBe(-200);
  });

  it('같은 목록이면 다시 그리지도, 스크롤을 건드리지도 않는다', async () => {
    saveMissionList(filterToQuery(defaultMissionFilter), [mission('a'), mission('b')]);
    render(<MissionBrowser />);
    await answer(0, [mission('a'), mission('b')]);
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it('맨 위를 보고 있을 때는 새 미션이 위에 그대로 보이게 둔다', async () => {
    scrollY = 0;
    saveMissionList(filterToQuery(defaultMissionFilter), [mission('a')]);
    render(<MissionBrowser />);
    await answer(0, [mission('new'), mission('a')]);
    expect(window.scrollBy).not.toHaveBeenCalled();
  });
});

describe('계정이 바뀌면 비운다', () => {
  it('기억한 목록은 계정마다 따로이고, 로그아웃·다른 계정 로그인 때 모두 비우며 찜 표시도 비운다', () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', name: '가', role: 'PARTICIPANT' }, token: 't', refreshToken: 'r' });
    saveMissionList('sort=NEWEST', [mission('a')]);
    expect(readMissionList('sort=NEWEST')).toBeTruthy();

    useAuthStore.setState({ user: { id: 'u2', email: 'c@d.e', name: '나', role: 'PARTICIPANT' } });
    expect(missionListCacheSize()).toBe(0);
    expect(bookmarkState.clear).toHaveBeenCalled();

    saveMissionList('sort=NEWEST', [mission('b')]);
    useAuthStore.getState().clearAuth();
    expect(missionListCacheSize()).toBe(0);
  });

  it('최근 8가지 조건만 기억한다', () => {
    for (let i = 0; i < 12; i++) saveMissionList(`keyword=${i}`, [mission(String(i))]);
    expect(missionListCacheSize()).toBe(8);
    expect(readMissionList('keyword=0')).toBeUndefined();
    expect(readMissionList('keyword=11')).toBeTruthy();
  });
});

describe('뒤로 갈 때 스크롤을 바로 되돌린다', () => {
  it('기록 이동(popstate) 직후에만 부드러운 스크롤을 잠시 끄고 다시 켠다', async () => {
    vi.useFakeTimers();
    const { default: InstantHistoryScroll, HISTORY_SCROLL_SETTLE_MS } = await import('@/components/common/InstantHistoryScroll');
    render(<InstantHistoryScroll />);
    const html = document.documentElement;
    expect(html.style.scrollBehavior).toBe('');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(html.style.scrollBehavior).toBe('auto');
    vi.advanceTimersByTime(HISTORY_SCROLL_SETTLE_MS);
    expect(html.style.scrollBehavior).toBe('');
    vi.useRealTimers();
  });
});
