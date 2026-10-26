import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/app/login/page';
import { useAuthStore } from '@/store/auth';

/**
 * 로그인한 상태로 /login에 오면, 누구로 들어와 있는지부터 알려 준다.
 * 전에는 아무 안내 없이 빈 폼만 보여서 계정을 바꾸려는 사람이 헤맸다.
 */

vi.mock('@/lib/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
  apiErrorMessage: () => '로그인에 실패했습니다',
}));

const USER = { id: 'u1', email: 'a@b.com', name: '윤종현', role: 'OPERATOR' as const };

beforeEach(() => useAuthStore.setState({ user: USER, token: 't', refreshToken: 'r' }));
afterEach(() => useAuthStore.setState({ user: null, token: null, refreshToken: null }));

describe('로그인 화면', () => {
  it('이미 로그인했으면 누구인지와 갈 곳을 알려 준다', async () => {
    render(<LoginPage />);

    await waitFor(() => expect(screen.getByText(/으로 로그인되어 있어요/)).toBeTruthy());
    const box = screen.getByText(/으로 로그인되어 있어요/);
    expect(box.textContent).toContain('윤종현');
    expect(box.textContent).toContain('관리자');
    expect(screen.getByRole('link', { name: '관리자 화면으로' }).getAttribute('href')).toBe('/operator');
    expect(screen.getByRole('button', { name: '다른 계정으로 로그인' })).toBeTruthy();
  });

  it("'다른 계정으로 로그인'을 누르면 로그아웃하고 폼만 남는다", async () => {
    render(<LoginPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: '다른 계정으로 로그인' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '다른 계정으로 로그인' }));

    expect(useAuthStore.getState().user).toBeNull();
    expect(screen.queryByText(/으로 로그인되어 있어요/)).toBeNull();
    // 홈으로 보내지 않고 그 자리에 빈 폼을 둔다
    expect(screen.getByLabelText('이메일')).toBeTruthy();
    expect(screen.getByRole('button', { name: '로그인' })).toBeTruthy();
  });

  it('로그인 전에는 안내 없이 폼만 보여 준다', async () => {
    useAuthStore.setState({ user: null, token: null, refreshToken: null });
    render(<LoginPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: '로그인' })).toBeTruthy());
    expect(screen.queryByText(/으로 로그인되어 있어요/)).toBeNull();
  });
});
