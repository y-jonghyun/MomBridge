import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MissionJourney, { journeySteps } from '@/components/participant/MissionJourney';
import ParticipantPage from '@/app/participant/page';
import { useAuthStore } from '@/store/auth';

/**
 * 내 활동 (1단계): 세로 여정 · 지금 할 일 버튼 하나 · 크림 카드의 지급 예정.
 * 단계는 서버에 있는 상태만으로 정한다 — 방문은 따로 기록하지 않아 "방문하고 후기 제출"로 합친다.
 */

const NOW = new Date('2026-11-12T12:00:00+09:00');
const base = { appliedAt: '2026-11-03T00:00:00Z', selectedAt: '2026-11-05T00:00:00Z', deadline: '2026-11-14T00:00:00Z', now: NOW };
const states = (s: ReturnType<typeof journeySteps>) => s.map(x => `${x.label}:${x.state}`);

describe('여정 단계', () => {
  it('선정됐고 후기 제출 전: 지금 단계는 "방문하고 후기 제출", 마감 D-day', () => {
    const s = journeySteps({ ...base, submissionStatus: null, payoutDay: '12월 10일' });
    expect(states(s)).toEqual(['신청:done', '선정:done', '방문하고 후기 제출:current', '검수:todo', '보상 지급:todo']);
    expect(s[0].detail).toBe('11월 3일');
    expect(s[1].detail).toBe('11월 5일');
    expect(s[2].detail).toBe('11월 14일까지 · D-2');
    expect(s[4].detail).toBe('12월 10일 지급 예정');
  });

  it('제출했으면 검수가 지금 단계', () => {
    expect(states(journeySteps({ ...base, submissionStatus: 'SUBMITTED' }))).toEqual(
      ['신청:done', '선정:done', '방문하고 후기 제출:done', '검수:current', '보상 지급:todo']);
  });

  it('검수를 통과하면 보상 지급이 지금 단계, 지급하면 모두 끝', () => {
    expect(journeySteps({ ...base, submissionStatus: 'APPROVED' }).map(x => x.state)).toEqual(['done', 'done', 'done', 'done', 'current']);
    expect(journeySteps({ ...base, submissionStatus: 'APPROVED', payoutCompleted: true }).map(x => x.state)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('수정 요청이 오면 다시 제출 단계로', () => {
    const s = journeySteps({ ...base, submissionStatus: 'REVISION', revisionLeft: true });
    expect(s[2].state).toBe('current');
    expect(s[2].detail).toBe('수정 요청이 왔어요');
  });

  it('화면 읽기에 지금 단계를 알린다', () => {
    render(<MissionJourney steps={journeySteps({ ...base, submissionStatus: null })} />);
    expect(screen.getByText('(지금 단계)', { exact: false }).closest('li')?.textContent).toContain('방문하고 후기 제출');
  });
});

// ── 화면 ──
// 실제 라우터처럼 같은 객체를 돌려준다 (화면의 useEffect가 router에 기대고 있다)
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
const params = new URLSearchParams();
vi.mock('next/navigation', () => ({
  usePathname: () => '/participant',
  useSearchParams: () => params,
  useRouter: () => router,
}));
const routes: Record<string, unknown> = { '/notifications': { notifications: [], unreadCount: 0 } };
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(async (url: string) => ({ data: { data: routes[String(url ?? '')] ?? [] } })),
    post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
  },
  apiErrorMessage: () => '실패했습니다',
}));
// 실제 스토어처럼 함수가 매번 같아야 한다 (화면의 useEffect가 이 함수에 기대고 있어, 매번 새로 만들면 끝없이 다시 불린다)
const bookmarkState = { ids: new Set<string>(), load: vi.fn(), toggle: vi.fn() };
vi.mock('@/lib/bookmarks', () => ({
  useBookmarks: (selector: (s: typeof bookmarkState) => unknown) => selector(bookmarkState),
}));
vi.mock('@/lib/payout', () => ({
  PAYOUT_DELAY_HINT: '검수가 늦어지면 다음 달로 미뤄질 수 있어요',
  fetchNextPayoutDate: vi.fn(async () => new Date('2026-12-10T00:00:00+09:00')),
  payoutLabel: () => '12월 10일',
}));
vi.mock('@/lib/self-click', () => ({ syncSelfClickCookie: vi.fn() }));

afterEach(() => {
  useAuthStore.setState({ user: null, token: null, refreshToken: null });
  delete routes['/participant/applications'];
});

async function renderPage() {
  useAuthStore.setState({ user: { id: 'u1', email: 'a@b.com', name: '하은', role: 'PARTICIPANT' }, token: 't', refreshToken: 'r' });
  render(<ParticipantPage />);
  await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
}

describe('내 활동 화면', () => {
  // 이 화면은 요소가 많아 jsdom의 역할(role) 검색이 느리다 — 선택자로 찾고 시간을 넉넉히 둔다
  it('검은 요약 카드 대신 크림 카드의 지급 예정', { timeout: 20000 }, async () => {
    await renderPage();
    const card = document.querySelector('section[aria-label="지급 예정"]') as HTMLElement;
    expect(card.className).not.toContain('bg-ink');
    expect(card.className).toContain('bg-paper');
    // 지급 예정 금액(큰 글씨)과 누적 보상 둘 다 0원
    expect(within(card).getAllByText('0원')).toHaveLength(2);
    expect(Array.from(card.querySelectorAll('button')).map(b => b.textContent)).toContain('내역 ›');
  });

  it('선정된 미션 카드: 세로 여정과 지금 할 일 버튼 하나', { timeout: 20000 }, async () => {
    routes['/participant/applications'] = [{
      id: 'a1', missionId: 'm1', status: 'APPROVED', createdAt: '2026-11-03T00:00:00Z', reviewedAt: '2026-11-05T00:00:00Z',
      mission: { title: '아침 빵 맛보고 사진 세 장 남기기', status: 'IN_PROGRESS', regionGu: '강남구', regionDong: '역삼동', rewardAmount: 30000,
        submissionDeadline: '2026-11-14T00:00:00Z', clientProfile: { businessName: '강남 수제 베이커리' } },
    }];
    await renderPage();
    const card = screen.getByText('아침 빵 맛보고 사진 세 장 남기기').closest('section')!;
    expect(card.querySelectorAll('ol[aria-label="진행 단계"] > li')).toHaveLength(5);
    // 큰 버튼(clay)은 하나, 작성 가이드는 글자 링크
    const buttons = Array.from(card.querySelectorAll('button'));
    expect(buttons.filter(b => b.className.includes('bg-clay')).map(b => b.textContent)).toEqual(['후기 링크 제출하기']);
    expect(buttons.map(b => b.textContent)).toContain('작성 가이드 · 추적 링크 복사');
  });
});
