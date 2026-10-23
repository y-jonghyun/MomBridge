'use client';
import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import AuthShell, { authButtonClass, authInputClass } from '@/components/auth/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/password-reset/request', { email });
      setDone(data.data.message);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? '요청에 실패했습니다. 잠시 후 다시 시도해 주세요');
    } finally { setLoading(false); }
  }

  return (
    <AuthShell
      title="비밀번호 찾기"
      footer={<p><Link href="/login" className="text-muted">로그인으로 돌아가기</Link></p>}
    >
      <>
        {done ? (
          <div className="space-y-4">
            <p className="rounded-control bg-sage-tint px-3 py-3 text-sm text-sage">{done}</p>
            <p className="text-xs text-muted">메일이 오지 않으면 스팸함을 확인하거나, 몇 분 뒤 다시 요청해 주세요. 링크는 30분 동안 쓸 수 있습니다.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-2 mb-1">가입한 이메일</label>
              <input id="email" type="email" required autoComplete="email"
                className={authInputClass}
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && <p className="text-clay-dark text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-ink text-paper rounded-control py-2 font-semibold disabled:opacity-50">
              {loading ? '보내는 중...' : '재설정 링크 받기'}
            </button>
          </form>
        )}
      </>
    </AuthShell>
  );
}
