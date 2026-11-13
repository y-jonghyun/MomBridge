import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';

/**
 * 운영자 대행 등록·수정에 '유입 추적'(도착 주소 · 키워드) 칸.
 * - 운영자 화면에서만 보인다 (가게는 '캠페인 설정'에서 같은 값을 정한다)
 * - 수정 창은 도착 주소를 불러와 그대로 돌려보낸다 (예전에는 보내지 않아 저장할 때마다 지워졌다)
 * - 도착 주소 없이 모집을 시작하려 하면 묻는다 (막지는 않는다 — 가게 화면도 선택 항목)
 */

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/operator',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => router,
}));

const state = vi.hoisted(() => ({ editMission: {} as Record<string, unknown>, keywords: null as unknown, missions: [] as unknown[] }));
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(async (url: string) => {
      if (String(url).endsWith('/edit')) {
        return { data: { data: { mission: state.editMission, keywords: state.keywords, rules: {}, applicationCount: 0, closed: false, images: [] } } };
      }
      if (url === '/operator/missions') return { data: { data: { missions: state.missions } } };
      return { data: { data: [] } };
    }),
    put: vi.fn(async () => ({ data: { data: { changed: ['title'], keywordsChanged: false, notified: 0 } } })),
    patch: vi.fn(async () => ({ data: { success: true } })),
    post: vi.fn(), delete: vi.fn(),
  },
  apiErrorMessage: () => '실패했습니다',
}));

import api from '@/lib/api';
import RegisterMissionForm, { type RegisterForm } from '@/components/operator/RegisterMissionForm';
import MissionEditModal from '@/components/missions/MissionEditModal';
import OperatorDashboard from '@/app/operator/page';
import { NO_DESTINATION_WARNING } from '@/lib/mission-warnings';

const baseForm: RegisterForm = {
  clientProfileId: 'c1', title: '미션', description: '설명', category: 'REVIEW', rewardAmount: '30000', maxParticipants: '5',
  regionSi: '서울특별시', regionGu: '마포구', regionDong: '합정동', visitAddress: '', startDate: '2026-12-01', endDate: '2026-12-20',
  announceDate: '', submissionDeadline: '2026-12-30', requirements: '', visitGuide: '', businessCategory: 'CAFE', momTags: [],
  visitHours: '', destinationUrl: '', sendPaymentLink: false,
};
const signIn = (role: 'OPERATOR' | 'CLIENT') =>
  useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', name: '테스트', role }, token: 't', refreshToken: 'r' });

beforeEach(() => { vi.clearAllMocks(); state.keywords = null; state.missions = []; });
afterEach(() => useAuthStore.setState({ user: null, token: null, refreshToken: null }));

describe('등록 폼의 유입 추적 칸', () => {
  const renderForm = (extra: Record<string, unknown> = {}) => {
    const set = vi.fn();
    render(
      <RegisterMissionForm form={baseForm} set={set} clients={[{ id: 'c1', businessName: '가게' }]}
        pendingImages={[]} onPendingChange={() => {}} submitting={false} onSubmit={e => e.preventDefault()} {...extra} />,
    );
    return set;
  };

  it('운영자 화면(키워드 칸을 넘길 때)에는 도착 주소·키워드가 있고, 입력이 폼에 들어간다', () => {
    const set = renderForm({ keywords: null, onKeywordsChange: vi.fn() });
    const input = screen.getByLabelText(/도착 주소/) as HTMLInputElement;
    expect(input.type).toBe('url');
    expect(screen.getByLabelText(/도착 주소/).closest('div')?.textContent).toContain('(권장)'); // REVIEW 유형
    fireEvent.change(input, { target: { value: 'https://smartstore.naver.com/x' } });
    expect(set).toHaveBeenCalledWith('destinationUrl', 'https://smartstore.naver.com/x');
    expect(screen.getByText('유입 추적')).toBeTruthy();
  });

  it('가게 수정 창(키워드 칸을 넘기지 않을 때)에는 유입 추적 칸이 없다', () => {
    renderForm();
    expect(screen.queryByLabelText(/도착 주소/)).toBeNull();
    expect(screen.queryByText('유입 추적')).toBeNull();
  });
});

describe('수정 창', () => {
  const mission = {
    id: 'm1', clientProfileId: 'c1', businessName: '가게', title: '미션', description: '설명', category: 'SNS',
    rewardAmount: 30000, maxParticipants: 5, regionSi: '서울특별시', regionGu: '마포구', startDate: '2026-12-01',
    endDate: '2026-12-20', submissionDeadline: '2026-12-30', momTags: [], destinationUrl: 'https://example.com/shop',
  };

  it('가게 계정: 도착 주소 칸은 없지만 불러온 값을 그대로 돌려보내 지워지지 않는다', async () => {
    signIn('CLIENT');
    state.editMission = mission;
    render(<MissionEditModal missionId="m1" onClose={() => {}} />);
    await screen.findByText('수정 내용 저장');
    expect(screen.queryByLabelText(/도착 주소/)).toBeNull();
    fireEvent.click(screen.getByText('수정 내용 저장'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const body = (api.put as unknown as { mock: { calls: [string, Record<string, unknown>][] } }).mock.calls[0][1];
    expect(body.destinationUrl).toBe('https://example.com/shop');
    expect(body.keywords).toBeUndefined();
  });

  it('운영자: 도착 주소를 고쳐 보내고, 키워드는 바꿨을 때만 보낸다', async () => {
    signIn('OPERATOR');
    state.editMission = mission;
    state.keywords = { main: { keyword: '합정 브런치' }, subs: [] };
    render(<MissionEditModal missionId="m1" onClose={() => {}} />);
    const input = await screen.findByLabelText(/도착 주소/) as HTMLInputElement;
    expect(input.value).toBe('https://example.com/shop');
    fireEvent.change(input, { target: { value: 'https://booking.naver.com/x' } });
    fireEvent.click(screen.getByText('수정 내용 저장'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const body = (api.put as unknown as { mock: { calls: [string, Record<string, unknown>][] } }).mock.calls[0][1];
    expect(body.destinationUrl).toBe('https://booking.naver.com/x');
    expect(body.keywords).toBeUndefined(); // 키워드는 그대로라 보내지 않는다
  });
});

describe('도착 주소 없이 모집 시작', () => {
  const openMissionsTab = async () => {
    signIn('OPERATOR');
    render(<OperatorDashboard />);
    fireEvent.click((await screen.findAllByRole('button', { name: /^미션 관리/ }))[0]);
    return screen.findAllByText('도착 주소 없음 · 유입이 집계되지 않아요');
  };

  it('목록에 "도착 주소 없음"이 보이고, 모집 중으로 바꾸려 하면 묻는다 — 취소하면 바꾸지 않는다', async () => {
    state.missions = [{ id: 'm1', title: '주소 없는 미션', status: 'DRAFT', destinationUrl: null, clientProfile: { businessName: '가게' }, _count: { applications: 0, submissions: 0 }, rewardAmount: 30000 }];
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const notes = await openMissionsTab();
    expect(notes.length).toBeGreaterThan(0);
    const select = screen.getAllByDisplayValue(/임시|DRAFT|작성/)[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'OPEN' } });
    expect(confirmSpy).toHaveBeenCalledWith(NO_DESTINATION_WARNING);
    expect(api.patch).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.change(select, { target: { value: 'OPEN' } });
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/operator/missions/m1/status', { status: 'OPEN' }));
    confirmSpy.mockRestore();
  });

  it('도착 주소가 있으면 묻지 않고 바로 바꾼다', async () => {
    state.missions = [{ id: 'm2', title: '주소 있는 미션', status: 'DRAFT', destinationUrl: 'https://example.com', clientProfile: { businessName: '가게' }, _count: { applications: 0, submissions: 0 }, rewardAmount: 30000 }];
    const confirmSpy = vi.spyOn(window, 'confirm');
    signIn('OPERATOR');
    render(<OperatorDashboard />);
    fireEvent.click((await screen.findAllByRole('button', { name: /^미션 관리/ }))[0]);
    await screen.findAllByText('주소 있는 미션');
    expect(screen.queryByText('도착 주소 없음 · 유입이 집계되지 않아요')).toBeNull();
    const select = screen.getAllByDisplayValue(/임시|DRAFT|작성/)[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'OPEN' } });
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/operator/missions/m2/status', { status: 'OPEN' }));
    confirmSpy.mockRestore();
  });
});
