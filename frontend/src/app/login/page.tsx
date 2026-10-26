'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { apiErrorMessage } from '@/lib/api';
import { useAuthHydrated, useAuthStore, type Role } from '@/store/auth';
import { syncSelfClickCookie } from '@/lib/self-click';
import AuthShell, { authButtonClass, authInputClass } from '@/components/auth/AuthShell';

const ROLE_LABEL: Record<Role, string> = { PARTICIPANT: '참여자', CLIENT: '고객사', OPERATOR: '관리자' };
const HOME_BY_ROLE: Record<Role, string> = { PARTICIPANT: '/participant', CLIENT: '/client', OPERATOR: '/operator' };
const MY_SCREEN_LABEL: Record<Role, string> = {
  PARTICIPANT: '내 활동으로', CLIENT: '내 가게로', OPERATOR: '관리자 화면으로',
};

/** 로그인 후 돌아갈 경로. 다른 사이트로 보내지 않도록 같은 사이트 경로만 허용 */
function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : null;
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expired = searchParams.get('expired') === '1';
  const next = safeNext(searchParams.get('next'));
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const hydrated = useAuthHydrated();
  // 이미 로그인한 사람에게는 폼 대신 누구로 들어와 있는지부터 알려 준다
  const [switching, setSwitching] = useState(false);
  const signedIn = hydrated && !!user && !switching;
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
      const role = data.data.user.role;
      if (role === 'PARTICIPANT') void syncSelfClickCookie();
      if (next) router.push(next);
      else if (role === 'OPERATOR') router.push('/operator');
      else if (role === 'PARTICIPANT') router.push('/participant');
      else router.push('/client');
    } catch (err: unknown) {
      setError(apiErrorMessage(err, '로그인에 실패했습니다'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="로그인"
      footer={
        <>
          <p><Link href="/forgot-password" className="text-muted">비밀번호를 잊으셨나요?</Link></p>
          <p>계정이 없으신가요? <Link href="/register" className="font-medium text-clay">회원가입</Link></p>
        </>
      }
    >
      <>
        {signedIn && (
          <div className="mb-4 rounded-card border border-line bg-cream p-4">
            <p className="break-keep text-sm text-ink">
              <strong className="font-medium">{user!.name}</strong>({ROLE_LABEL[user!.role]})으로 로그인되어 있어요
            </p>
            {/* 좁은 화면에서는 글이 접히지 않게 한 줄씩 둔다 */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link
                href={HOME_BY_ROLE[user!.role]}
                className="flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-control bg-ink px-4 text-sm font-bold text-paper"
              >
                {MY_SCREEN_LABEL[user!.role]}
              </Link>
              <button
                type="button"
                onClick={() => { clearAuth(); setSwitching(true); }}
                className="flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-control border border-line bg-paper px-4 text-sm text-ink-2"
              >
                다른 계정으로 로그인
              </button>
            </div>
          </div>
        )}

        {expired && !error && (
          <p className="mb-4 rounded-control bg-clay-tint px-3 py-2 text-sm text-clay-dark">로그인이 만료됐습니다. 다시 로그인해 주세요.</p>
        )}

        {/* 안내 상자는 폼 위에 둔다 — 폼은 그대로 쓸 수 있다 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-[13px] text-muted">이메일</label>
            <input
              id="login-email" type="email" required
              className={authInputClass}
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-[13px] text-muted">비밀번호</label>
            <input
              id="login-password" type="password" required
              className={authInputClass}
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {error && <p className="text-clay-dark text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className={authButtonClass}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </>
    </AuthShell>
  );
}
