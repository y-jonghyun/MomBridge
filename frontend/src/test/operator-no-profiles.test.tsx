import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';

/**
 * 운영자는 참여자(내 활동)·가게 화면에 들어가지 않는다 — 운영자 화면(/operator)으로 보낸다.
 * 그 사이 참여자·가게 요청을 보내지 않는다 (서버도 403으로 막고, 운영자 계정에 프로필을 만들지 않는다).
 * 하단 탭의 '내 활동'은 운영자에게 '관리자'(운영자 화면)로 바뀌고, 운영자 화면의 '미리보기' 링크는 없다.
 */

const nav = vi.hoisted(() => ({ pathname: '/', params: new URLSearchParams() }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.params,
  useRouter: () => router,
}));

const api = vi.hoisted(() => ({ urls: [] as string[] }));
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(async (url: string) => { api.urls.push(String(url)); return { data: { data: [] } }; }),
    post: vi.fn(async (url: string) => { api.urls.push(String(url)); return { data: { data: {} } }; }),
    put: vi.fn(async (url: string) => { api.urls.push(String(url)); return { data: { data: {} } }; }),
    patch: vi.fn(async (url: string) => { api.urls.push(String(url)); return { data: { data: {} } }; }),
    delete: vi.fn(async (url: string) => { api.urls.push(String(url)); return { data: { data: {} } }; }),
  },
  apiErrorMessage: () => '실패했습니다',
}));
vi.mock('@/lib/self-click', () => ({ syncSelfClickCookie: vi.fn() }));

import ParticipantPage from '@/app/participant/page';
import ClientPage from '@/app/client/page';
import { BottomTabBar } from '@/components/ui';

const signIn = (role: 'OPERATOR' | 'PARTICIPANT' | 'CLIENT') =>
  useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', name: '테스트', role }, token: 't', refreshToken: 'r' });

beforeEach(() => { api.urls = []; router.replace.mockClear(); router.push.mockClear(); nav.pathname = '/'; });
afterEach(() => useAuthStore.setState({ user: null, token: null, refreshToken: null }));

describe('운영자가 참여자·가게 화면에 들어오면', () => {
  it('내 활동(/participant) → 운영자 화면으로 보내고, 참여자 요청을 보내지 않는다', async () => {
    signIn('OPERATOR');
    nav.pathname = '/participant';
    render(<ParticipantPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/operator'));
    await new Promise(r => setTimeout(r, 50));
    expect(api.urls.filter(u => u.startsWith('/participant'))).toEqual([]);
    expect(screen.queryByText('신청한 미션이 없어요')).toBeNull();
  });

  it('가게 화면(/client) → 운영자 화면으로 보내고, 가게 요청을 보내지 않는다', async () => {
    signIn('OPERATOR');
    nav.pathname = '/client';
    render(<ClientPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/operator'));
    await new Promise(r => setTimeout(r, 50));
    expect(api.urls.filter(u => u.startsWith('/client'))).toEqual([]);
  });

  it('참여자는 지금처럼 내 활동을 쓴다 (참여자 요청을 보낸다)', async () => {
    signIn('PARTICIPANT');
    nav.pathname = '/participant';
    render(<ParticipantPage />);
    await waitFor(() => expect(api.urls.some(u => u.startsWith('/participant'))).toBe(true));
    expect(router.replace).not.toHaveBeenCalledWith('/operator');
  });
});

describe('하단 탭', () => {
  it('운영자에게는 네 번째 칸이 "관리자"(운영자 화면)이고 "내 활동"은 없다', () => {
    signIn('OPERATOR');
    render(<BottomTabBar />);
    const admin = screen.getByRole('link', { name: '관리자' });
    expect(admin.getAttribute('href')).toBe('/operator');
    expect(screen.queryByRole('link', { name: /내 활동/ })).toBeNull();
  });

  it('참여자·로그인 전에는 그대로 "내 활동"', () => {
    signIn('PARTICIPANT');
    const { unmount } = render(<BottomTabBar />);
    expect(screen.getByRole('link', { name: /내 활동/ }).getAttribute('href')).toBe('/participant');
    unmount();
    useAuthStore.setState({ user: null, token: null, refreshToken: null });
    render(<BottomTabBar />);
    expect(screen.getByRole('link', { name: /내 활동/ }).getAttribute('href')).toBe('/participant');
  });
});

describe('운영자 화면', () => {
  it('"미리보기 — 참여자 화면 / 고객사 화면" 링크가 없다', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'operator', 'page.tsx'), 'utf8');
    expect(src).not.toMatch(/href="\/participant"/);
    expect(src).not.toMatch(/href="\/client"/);
    expect(src).not.toContain('미리보기');
  });
});
