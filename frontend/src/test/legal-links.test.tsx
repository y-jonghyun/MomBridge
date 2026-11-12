import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SiteFooter from '@/components/legal/SiteFooter';
import LegalInfo from '@/components/legal/LegalInfo';
import AuthShell from '@/components/auth/AuthShell';
import ParticipantPage from '@/app/participant/page';
import ClientPage from '@/app/client/page';
import { FOOTER_COPYRIGHT, businessInfoLine } from '@/lib/legal';
import { useAuthStore } from '@/store/auth';

/**
 * 약관·개인정보처리방침·사업자 정보에 닿는 길.
 * - 사이트 하단은 설치 앱에서 숨긴다(.web-only) — 브라우저 탭·데스크톱에서는 그대로
 * - 같은 묶음이 참여자·고객사의 '내 정보'에 있다 (문구는 하단과 같은 출처)
 * - 로그아웃 상태에서는 로그인·가입 화면의 링크로 닿는다
 */

const links = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('a')).map(a => [a.textContent?.trim(), a.getAttribute('href')]);

describe('사이트 하단', () => {
  it('설치 앱에서만 숨기는 표시가 있고, 내용은 그대로', () => {
    const { container } = render(<SiteFooter />);
    const footer = container.querySelector('footer')!;
    expect(footer.classList).toContain('web-only');
    expect(footer.textContent).toContain(FOOTER_COPYRIGHT);
    expect(footer.textContent).toContain(businessInfoLine());
    expect(links(footer)).toEqual([['이용약관', '/terms'], ['개인정보처리방침', '/privacy']]);
  });
});

describe('내 정보의 약관·사업자 정보 묶음', () => {
  it('하단과 같은 링크·사업자 정보·저작권 문구', () => {
    const { container } = render(<LegalInfo />);
    const box = container.querySelector('section[aria-label="약관과 사업자 정보"]') as HTMLElement;
    expect(box.classList).not.toContain('web-only');
    expect(links(box)).toEqual([['이용약관›', '/terms'], ['개인정보처리방침›', '/privacy']]);
    expect(box.textContent).toContain(businessInfoLine());
    expect(box.textContent).toContain(FOOTER_COPYRIGHT);
  });
});

describe('로그인·가입 화면', () => {
  it('약관·방침 링크가 있다 (로그아웃 상태의 설치 앱에서 닿는 길)', () => {
    render(<AuthShell title="로그인">내용</AuthShell>);
    const nav = screen.getByRole('navigation', { name: '약관' });
    expect(links(nav)).toEqual([['이용약관', '/terms'], ['개인정보처리방침', '/privacy']]);
  });
});

// ── 두 역할의 '내 정보' 화면 ──
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
let params = new URLSearchParams();
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => params,
  useRouter: () => router,
}));
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(async (url: string) => {
      const u = String(url ?? '');
      if (u === '/notifications') return { data: { data: { notifications: [], unreadCount: 0 } } };
      if (u === '/auth/me') return { data: { data: { user: { name: '', phone: '' } } } };
      return { data: { data: [] } };
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
// 프로필·가게 입력 양식은 이 테스트의 관심이 아니다 (각자 서버 응답 모양이 따로 있다)
vi.mock('@/components/profile/ParticipantProfileForm', () => ({ default: () => <div>참여자 프로필 양식</div> }));
vi.mock('@/components/profile/ClientStoreForm', () => ({ default: () => <div>가게 정보 양식</div> }));

afterEach(() => {
  useAuthStore.setState({ user: null, token: null, refreshToken: null });
  params = new URLSearchParams();
});

const settle = () => act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });

describe('두 역할의 내 정보', () => {
  it('참여자: 내 활동의 내 정보 탭 맨 아래', { timeout: 20000 }, async () => {
    params = new URLSearchParams('tab=profile');
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.com', name: '하은', role: 'PARTICIPANT' }, token: 't', refreshToken: 'r' });
    render(<ParticipantPage />);
    await settle();
    expect(document.querySelector('section[aria-label="약관과 사업자 정보"]')).toBeTruthy();
  });

  it('고객사: 내 정보 탭 맨 아래', { timeout: 20000 }, async () => {
    useAuthStore.setState({ user: { id: 'u2', email: 'c@b.com', name: '사장님', role: 'CLIENT' }, token: 't', refreshToken: 'r' });
    render(<ClientPage />);
    await settle();
    expect(document.querySelector('section[aria-label="약관과 사업자 정보"]')).toBeNull();
    const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === '내 정보')!;
    fireEvent.click(tab);
    await settle();
    const box = document.querySelector('section[aria-label="약관과 사업자 정보"]') as HTMLElement;
    expect(box).toBeTruthy();
    expect(within(box).getByText(businessInfoLine())).toBeTruthy();
  });
});
