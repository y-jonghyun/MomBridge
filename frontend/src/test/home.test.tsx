import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 루트(/)는 보는 사람에 따라 다르다.
 * - 로그인 전: 소개 화면 (히어로 · 소개 카드 · 미션 미리보기 · 진행 · 보상 예시 · 약속 · 사장님 띠)
 * - 로그인 후: 인사 + 내 미션 다음 단계 카드 + 우리 구의 새 미션 (app-feel 1단계)
 *
 * '한부모' 같은 사회적 가치 문구는 홈에 두지 않는다 (/for-shops에만).
 */

const missionsMock = vi.hoisted(() => ({
  list: [] as unknown[],
  regionList: [] as unknown[],
  profile: { regionSi: '', regionGu: '' } as { regionSi: string; regionGu: string; newMissionAlerts?: boolean },
  notifications: [] as unknown[],
  applications: [] as unknown[],
}));
const authMock = vi.hoisted(() => ({ user: null as { id: string; role: string; name: string } | null }));

// 주소별로 답한다: 미션 목록(지역 조건이 있으면 regionList) · 프로필 · 내 활동 목록
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(async (url: string) => {
      if (url.startsWith('/missions')) {
        const list = url.includes('regionGu=') ? missionsMock.regionList : missionsMock.list;
        return { data: { data: { missions: list } } };
      }
      if (url === '/participant/profile') return { data: { data: missionsMock.profile } };
      if (url === '/participant/applications') return { data: { data: missionsMock.applications } };
      if (url === '/notifications') {
        const n = missionsMock.notifications as { isRead: boolean }[];
        return { data: { data: { notifications: n, unreadCount: n.filter(x => !x.isRead).length } } };
      }
      return { data: { data: [] } };
    }),
    post: vi.fn(), patch: vi.fn(async () => ({ data: { success: true } })), delete: vi.fn(),
    put: vi.fn(async (_url: string, body: { newMissionAlerts: boolean }) => ({ data: { data: { newMissionAlerts: body.newMissionAlerts } } })),
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
import api from '@/lib/api';
import { fireEvent } from '@testing-library/react';

/** 카드에는 제목이 아니라 `[구 동] 가게 이름`이 찍힌다 (toCardData) */
const mission = (id: string, shop: string) => ({
  id, title: `미션 ${id}`, description: '설명', category: 'SNS', rewardAmount: 30000,
  regionSi: '서울특별시', regionGu: '마포구', regionDong: '합정동',
  endDate: '2026-12-31T00:00:00.000Z', currentCount: 1, maxParticipants: 5,
  momTags: [], clientProfile: { businessName: shop },
});

beforeEach(() => {
  missionsMock.list = []; missionsMock.regionList = []; missionsMock.applications = [];
  missionsMock.profile = { regionSi: '', regionGu: '' };
  missionsMock.notifications = [];
  authMock.user = null;
});
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
    expect(screen.getByText('[마포구 합정동] 가게 1')).toBeTruthy();
    expect(screen.getByText('[마포구 합정동] 가게 4')).toBeTruthy();
    expect(screen.queryByText('[마포구 합정동] 가게 5')).toBeNull();
    expect(screen.getByText('전체 보기')).toBeTruthy();
  });
});

describe('로그인 후 홈', () => {
  beforeEach(() => { authMock.user = { id: 'u1', role: 'PARTICIPANT', name: '엄마' }; });

  it('소개 화면이 아니라 인사와 새 미션 목록이 나온다', async () => {
    missionsMock.list = [mission('1', '가게 1')];
    const { container } = render(<HomeView />);

    expect(screen.getByRole('heading', { level: 1, name: '엄마님, 안녕하세요' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('[마포구 합정동] 가게 1')).toBeTruthy());
    expect(screen.getByRole('heading', { name: '새 미션' })).toBeTruthy();
    expect(container.textContent).not.toContain('아이 등원 후 두 시간');
    // 예전 로그인 후 홈의 히어로·검색·정산 검은 카드는 없다
    expect(container.textContent).not.toContain('가볍게 버는 시간');
    expect(screen.queryByPlaceholderText('가게 이름, 동네로 찾기')).toBeNull();
    expect(container.textContent).not.toContain('내 다음 정산일');
  });

  it('활동 지역이 있으면 그 구의 새 미션을 최대 5개 보여 준다', async () => {
    missionsMock.profile = { regionSi: '서울특별시', regionGu: '마포구' };
    missionsMock.regionList = ['1', '2', '3', '4', '5', '6'].map(n => mission(n, `가게 ${n}`));
    render(<HomeView />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '마포구 새 미션' })).toBeTruthy());
    expect(await screen.findByText('[마포구 합정동] 가게 5')).toBeTruthy();
    expect(screen.queryByText('[마포구 합정동] 가게 6')).toBeNull();
    // 머리말에 날짜와 구
    expect(screen.getByText(/요일 · 마포구$/)).toBeTruthy();
  });

  it('우리 구에 열린 미션이 없으면 전체 새 미션을 보여 주고 그렇다고 알린다', async () => {
    missionsMock.profile = { regionSi: '서울특별시', regionGu: '마포구' };
    missionsMock.list = [mission('9', '다른 동네 가게')];
    const { container } = render(<HomeView />);

    await waitFor(() => expect(screen.getByText('[마포구 합정동] 다른 동네 가게')).toBeTruthy());
    expect(screen.getByRole('heading', { name: '새 미션' })).toBeTruthy();
    expect(container.textContent).toContain('마포구에는 아직 열린 미션이 없어');
  });

  it('활동 지역이 없으면 지역을 정하는 곳으로 안내한다', async () => {
    missionsMock.list = [mission('1', '가게 1')];
    render(<HomeView />);
    const link = await screen.findByRole('link', { name: /활동 지역을 정하면/ });
    expect(link.getAttribute('href')).toBe('/participant?tab=profile');
  });

  it('선정된 미션이 있으면 맨 위에 다음 단계 카드를 보여 준다', async () => {
    missionsMock.applications = [{
      id: 'a1', missionId: 'm1', status: 'APPROVED', createdAt: '2026-11-01T00:00:00Z', reviewedAt: '2026-11-03T00:00:00Z',
      mission: { title: '한결 베이커리 아침 빵 체험', status: 'IN_PROGRESS', submissionDeadline: null },
    }];
    render(<HomeView />);

    const card = await screen.findByRole('link', { name: /내 미션 다음 단계: 한결 베이커리 아침 빵 체험/ });
    expect(card.getAttribute('href')).toBe('/participant');
    expect(card.textContent).toContain('후기 제출');
    expect(card.textContent).toContain('진행 중 1');
  });

  it('신청한 미션이 없으면 카드가 없다', async () => {
    missionsMock.list = [mission('1', '가게 1')];
    render(<HomeView />);
    await waitFor(() => expect(screen.getByText('[마포구 합정동] 가게 1')).toBeTruthy());
    expect(screen.queryByRole('link', { name: /내 미션 다음 단계/ })).toBeNull();
  });

  it('열린 미션이 하나도 없으면 출시 첫날 화면 — 지역이 없으면 지역 정하기, 진행 안내, 소개 링크', async () => {
    render(<HomeView />);
    expect(await screen.findByRole('heading', { name: '우리 동네 첫 미션을 준비하고 있어요' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '활동 지역 정하기' }).getAttribute('href')).toBe('/participant?tab=profile');
    // 위쪽의 '활동 지역을 정하면…' 줄은 카드 안 버튼과 겹치므로 숨긴다
    expect(screen.queryByRole('link', { name: /활동 지역을 정하면/ })).toBeNull();
    expect(screen.getByRole('heading', { name: '맘브릿지는 이렇게 진행돼요' })).toBeTruthy();
    // 지급 시기는 약관 제8조와 같은 말, 공제는 실제 정산과 같게 수수료만 (세금은 지금 빼지 않는다)
    expect(screen.getByText('승인되면 다음 달 10일에 보상을 받아요')).toBeTruthy();
    expect(screen.getByText('수수료 10%를 뺀 금액이에요. 세금이 있으면 따로 안내해 드려요')).toBeTruthy();
    expect(document.body.textContent).not.toContain('3.3%');
    expect(screen.getByRole('link', { name: /맘브릿지 더 알아보기/ }).getAttribute('href')).toBe('/about');
  });

  it('활동 지역이 있으면 "{구}의 첫 미션" + 카드 안에서 새 미션 알림 받기 (아래 카드는 겹치지 않게 뺀다)', async () => {
    missionsMock.profile = { regionSi: '서울특별시', regionGu: '마포구', newMissionAlerts: false };
    render(<HomeView />);
    expect(await screen.findByRole('heading', { name: '마포구의 첫 미션을 준비하고 있어요' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '새 미션 알림 받기' })).toHaveLength(1);
    expect(screen.queryByText('마포구에 새 미션이 열리면 알려 드릴까요?')).toBeNull();
  });

  it('가게 계정은 미션이 0개여도 예전 빈 안내와 소개 카드', async () => {
    authMock.user = { id: 'c1', role: 'CLIENT', name: '사장님' };
    const { container } = render(<HomeView />);
    await waitFor(() => expect(screen.getByText('맘브릿지 알아보기')).toBeTruthy());
    expect(container.textContent).toContain('언제 보상을 받는지');
    expect(screen.queryByText('맘브릿지는 이렇게 진행돼요')).toBeNull();
  });
});

describe('새 미션 알림 (로그인 후 홈)', () => {
  beforeEach(() => { authMock.user = { id: 'u1', role: 'PARTICIPANT', name: '지은' }; });

  it('앱 막대에 알림 종이 있고, 안 읽은 수를 알려 준다', async () => {
    missionsMock.notifications = [
      { id: 'n1', type: 'MISSION_OPEN', title: '마포구 합정동에 새 미션이 열렸어요', body: '[한결] 라테', isRead: false, resourceType: 'mission', resourceId: 'm9', createdAt: '2026-11-13T00:00:00Z' },
    ];
    render(<HomeView />);
    const bell = await screen.findByRole('button', { name: '알림, 안 읽은 알림 1개' });
    fireEvent.click(bell);
    // 새 미션 알림은 누르면 그 미션으로 가고 읽음 처리된다
    const link = await screen.findByRole('link', { name: /마포구 합정동에 새 미션이 열렸어요/ });
    expect(link.getAttribute('href')).toBe('/missions/m9');
    fireEvent.click(link);
    expect(api.patch).toHaveBeenCalledWith('/notifications/n1/read');
  });

  it('활동 지역이 있고 꺼져 있으면 알림 받기를 권하고, 누르면 켜진다', async () => {
    missionsMock.profile = { regionSi: '서울특별시', regionGu: '마포구', newMissionAlerts: false };
    missionsMock.regionList = [mission('1', '가게 1')];
    render(<HomeView />);
    expect(await screen.findByText('마포구에 새 미션이 열리면 알려 드릴까요?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '새 미션 알림 받기' }));
    expect(api.put).toHaveBeenCalledWith('/participant/profile/alerts', { newMissionAlerts: true });
    expect(await screen.findByText('마포구에 새 미션이 열리면 알림함으로 알려 드려요')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '알림 끄기' }));
    expect(api.put).toHaveBeenLastCalledWith('/participant/profile/alerts', { newMissionAlerts: false });
    expect(await screen.findByRole('button', { name: '새 미션 알림 받기' })).toBeTruthy();
  });

  it('활동 지역이 없으면 알림 받기를 보여 주지 않는다 (어느 구인지 몰라서)', async () => {
    missionsMock.list = [mission('1', '가게 1')];
    render(<HomeView />);
    await screen.findByText('[마포구 합정동] 가게 1');
    expect(screen.queryByRole('button', { name: '새 미션 알림 받기' })).toBeNull();
  });

  it('가게 계정에는 종도 알림 받기도 없다', async () => {
    authMock.user = { id: 'c1', role: 'CLIENT', name: '사장님' };
    missionsMock.list = [mission('1', '가게 1')];
    render(<HomeView />);
    await screen.findByText('[마포구 합정동] 가게 1');
    expect(screen.queryByRole('button', { name: /^알림/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '새 미션 알림 받기' })).toBeNull();
  });
});
