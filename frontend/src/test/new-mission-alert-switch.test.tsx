import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/** 내 정보 > 새 미션 알림 스위치 — 저장된 활동 지역이 있어야 켤 수 있다 */

const state = vi.hoisted(() => ({ profile: {} as Record<string, unknown> }));
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(async () => ({ data: { data: state.profile } })),
    put: vi.fn(async (_u: string, body: { newMissionAlerts: boolean }) => ({ data: { data: { newMissionAlerts: body.newMissionAlerts } } })),
    post: vi.fn(), patch: vi.fn(), delete: vi.fn(),
  },
}));

import api from '@/lib/api';
import ParticipantProfileForm from '@/components/profile/ParticipantProfileForm';

const base = { regionSi: '서울특별시', regionGu: '마포구', regionDong: null, childAgeGroups: [], snsAccounts: [], complete: false };

beforeEach(() => vi.clearAllMocks());

describe('내 정보 — 새 미션 알림', () => {
  it('꺼져 있으면 켤 수 있고, 켜면 스위치가 켜진다', async () => {
    state.profile = { ...base, newMissionAlerts: false };
    render(<ParticipantProfileForm />);
    const sw = await screen.findByRole('switch', { name: '새 미션 알림' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/마포구에 미션이 열리면 앱 안 알림함으로/)).toBeTruthy();
    fireEvent.click(sw);
    expect(api.put).toHaveBeenCalledWith('/participant/profile/alerts', { newMissionAlerts: true });
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
  });

  it('활동 지역이 저장돼 있지 않으면 누를 수 없다', async () => {
    state.profile = { ...base, regionSi: '', regionGu: '' };
    render(<ParticipantProfileForm />);
    const sw = await screen.findByRole('switch', { name: '새 미션 알림' });
    expect((sw as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('활동 지역을 저장하면 켤 수 있어요.')).toBeTruthy();
  });
});
