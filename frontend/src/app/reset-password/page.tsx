'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다'); return; }
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
    return <p className="text-sm text-gray-600 text-center">링크가 올바르지 않습니다. <Link href="/forgot-password" className="text-slate-700 font-medium underline">재설정을 다시 요청</Link>해 주세요.</p>;
  }
  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-800">비밀번호를 바꿨습니다. 다른 기기에서도 로그아웃됐으니 새 비밀번호로 로그인해 주세요.</p>
        <Link href="/login" className="block w-full bg-slate-700 text-white rounded-lg py-2 font-semibold">로그인</Link>
      </div>
    );
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="pw" className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
        <input id="pw" type="password" required autoComplete="new-password" minLength={6}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label htmlFor="pw2" className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호 확인</label>
        <input id="pw2" type="password" required autoComplete="new-password"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && (
        <p className="text-red-500 text-sm">
          {error} {error.includes('만료') && <Link href="/forgot-password" className="underline">다시 요청하기</Link>}
        </p>
      )}
      <button type="submit" disabled={loading} className="w-full bg-slate-700 text-white rounded-lg py-2 font-semibold disabled:opacity-50">
        {loading ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-center mb-2">맘브릿지</h1>
        <p className="text-gray-500 text-center mb-8">새 비밀번호 설정</p>
        <Suspense><ResetForm /></Suspense>
      </div>
    </div>
  );
}
