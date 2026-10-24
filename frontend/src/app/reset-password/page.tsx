'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { PASSWORD_HINT, passwordError } from '@/lib/password';
import AuthShell, { authButtonClass, authInputClass } from '@/components/auth/AuthShell';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bad = passwordError(password);
    if (bad) { setError(bad); return; }
    if (password !== confirm) { setError('비밀번호가 서로 다릅니다'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/password-reset/confirm', { token, newPassword: password });
      setDone(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? '변경에 실패했습니다. 잠시 후 다시 시도해 주세요');
    } finally { setLoading(false); }
  }

  if (!token) {
    return <p className="text-sm text-ink-2 text-center">링크가 올바르지 않습니다. <Link href="/forgot-password" className="text-ink-2 font-medium underline">재설정을 다시 요청</Link>해 주세요.</p>;
  }
  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-control bg-sage-tint px-3 py-3 text-sm text-sage">비밀번호를 바꿨습니다. 다른 기기에서도 로그아웃됐으니 새 비밀번호로 로그인해 주세요.</p>
        <Link href="/login" className="block w-full bg-ink text-paper rounded-control py-2 font-semibold">로그인</Link>
      </div>
    );
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="pw" className="block text-sm font-medium text-ink-2 mb-1">새 비밀번호</label>
        <p className="mb-1 text-xs text-muted">{PASSWORD_HINT}</p>
        <input id="pw" type="password" required autoComplete="new-password" minLength={8}
          className={authInputClass}
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label htmlFor="pw2" className="block text-sm font-medium text-ink-2 mb-1">새 비밀번호 확인</label>
        <input id="pw2" type="password" required autoComplete="new-password"
          className={authInputClass}
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && (
        <p className="text-clay-dark text-sm">
          {error} {error.includes('만료') && <Link href="/forgot-password" className="underline">다시 요청하기</Link>}
        </p>
      )}
      <button type="submit" disabled={loading} className="w-full bg-ink text-paper rounded-control py-2 font-semibold disabled:opacity-50">
        {loading ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="새 비밀번호 설정"
      footer={<p><Link href="/login" className="text-muted">로그인으로 돌아가기</Link></p>}
    >
      <>
        <Suspense><ResetForm /></Suspense>
      </>
    </AuthShell>
  );
}
