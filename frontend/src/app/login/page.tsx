'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { syncSelfClickCookie } from '@/lib/self-click';
import AuthShell, { authButtonClass, authInputClass } from '@/components/auth/AuthShell';

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
        {expired && !error && (
          <p className="mb-4 rounded-control bg-clay-tint px-3 py-2 text-sm text-clay-dark">로그인이 만료됐습니다. 다시 로그인해 주세요.</p>
        )}

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
