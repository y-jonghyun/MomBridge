import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MissionDetailPage from '@/app/missions/[id]/page';
import { useAuthStore } from '@/store/auth';

/**
 * 미션 상세 (1단계): 사진 위 시트, 번호 일정, 하단 고정 신청 버튼.
 * - 일정은 서버에 있는 날짜만: 모집 마감 · 선정 발표(있을 때만) · 후기 마감 · 지급 예정일
 * - 하단 버튼 왼쪽에 모집 마감까지 남은 날 (모집 중일 때만)
 * - 찜은 사진 위 (참여자만)
 */

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'm1' }),
  usePathname: () => '/missions/m1',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  default: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  apiErrorMessage: () => '실패했습니다',
}));
vi.mock('@/lib/bookmarks', () => ({
  useBookmarks: (selector: (s: { ids: Set<string>; load: () => void; toggle: () => void }) => unknown) =>
    selector({ ids: new Set<string>(), load: vi.fn(), toggle: vi.fn() }),
}));

const DAY = 86400000;
// 지금 기준 days일 뒤에서 1분 빼서 만든다 — 화면의 D-day는 올림(ceil)이라 실행 시각과 상관없이 정확히 D-days가 된다
// (전에는 정오 기준이라 자정 직후에 돌리면 하루가 밀렸다)
const at = (days: number) => new Date(Date.now() + days * DAY - 60_000).toISOString();
const md = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };

function mission(over: Record<string, unknown> = {}) {
  return {
    id: 'm1', title: '아침 빵 맛보고 솔직한 후기 남기기', description: '설명', category: 'VISIT', status: 'OPEN',
    regionSi: '서울특별시', regionGu: '마포구', regionDong: '망원동',
    rewardAmount: 30000, maxParticipants: 5, currentCount: 2,
    startDate: at(-3), endDate: at(8), announceDate: at(10), submissionDeadline: at(18),
    payoutDueDate: at(28), visitHours: '평일 10:00~15:00', momTags: ['WEEKDAY_DAY'],
    clientProfile: { businessName: '한결 베이커리', address: '서울 마포구 망원동' },
    images: [], keywords: [],
    ...over,
  };
}

async function renderWith(m: Record<string, unknown>) {
  apiGet.mockImplementation(async (url: string) =>
    String(url ?? '').startsWith('/missions/') ? { data: { data: m } } : { data: { data: { complete: true } } });
  render(<MissionDetailPage />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => apiGet.mockReset());
afterEach(() => useAuthStore.setState({ user: null, token: null, refreshToken: null }));

describe('미션 상세', () => {
  it('제목이 h1이고, 위에 "가게 · 구 동"이 붙는다', async () => {
    await renderWith(mission());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('아침 빵 맛보고 솔직한 후기 남기기');
    expect(screen.getByText('한결 베이커리 · 마포구 망원동')).toBeTruthy();
  });

  it('일정은 번호 목록, 날짜는 "N월 D일" 그대로', async () => {
    const m = mission();
    await renderWith(m);
    const list = screen.getByRole('heading', { name: '일정' }).closest('section')!.querySelector('ol')!;
    const rows = within(list).getAllByRole('listitem').map(li => li.textContent);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain('모집');
    expect(rows[0]).toContain(`${md(m.endDate)}까지`);
    expect(rows[1]).toContain('선정 발표');
    expect(rows[1]).toContain(md(m.announceDate));
    expect(rows[2]).toContain('방문하고 후기 제출');
    expect(rows[2]).toContain(`${md(m.submissionDeadline)}까지`);
    expect(rows[3]).toContain('보상 지급');
    // 모집 중이면 첫 줄이 지금 단계
    expect(rows[0]).toContain('지금 단계');
  });

  it('선정 발표일이 없으면 그 줄을 숨긴다', async () => {
    await renderWith(mission({ announceDate: null }));
    const list = screen.getByRole('heading', { name: '일정' }).closest('section')!.querySelector('ol')!;
    expect(within(list).queryByText('선정 발표')).toBeNull();
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });

  it('방문 가능 시간을 위쪽에 한 줄로 보여 준다', async () => {
    await renderWith(mission());
    expect(screen.getByText(/방문 가능 평일 10:00~15:00/)).toBeTruthy();
  });

  it('하단 버튼 왼쪽에 모집 마감까지 남은 날 (모집 중일 때만)', async () => {
    await renderWith(mission());
    expect(screen.getByText('모집 마감')).toBeTruthy();
    expect(screen.getByText('D-8')).toBeTruthy();
  });

  it('모집이 끝난 미션에는 남은 날을 보여 주지 않는다', async () => {
    await renderWith(mission({ status: 'IN_PROGRESS', endDate: at(-1) }));
    expect(screen.queryByText('모집 마감')).toBeNull();
  });

  it('찜은 사진 위에, 참여자에게만', async () => {
    await renderWith(mission());
    expect(screen.queryByRole('button', { name: '찜하기' })).toBeNull();
  });

  it('참여자는 사진 위에서 찜할 수 있다', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.com', name: '하은', role: 'PARTICIPANT' }, token: 't', refreshToken: 'r' });
    await renderWith(mission());
    expect(screen.getByRole('button', { name: '찜하기' })).toBeTruthy();
  });
});
