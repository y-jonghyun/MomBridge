'use client';
import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

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
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-center mb-2">맘브릿지</h1>
        <p className="text-gray-500 text-center mb-8">비밀번호 찾기</p>
        {done ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-800">{done}</p>
            <p className="text-xs text-gray-500">메일이 오지 않으면 스팸함을 확인하거나, 몇 분 뒤 다시 요청해 주세요. 링크는 30분 동안 쓸 수 있습니다.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">가입한 이메일</label>
              <input id="email" type="email" required autoComplete="email"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-slate-700 text-white rounded-lg py-2 font-semibold disabled:opacity-50">
              {loading ? '보내는 중...' : '재설정 링크 받기'}
            </button>
          </form>
        )}
        <p className="text-center text-sm text-gray-500 mt-4">
          <Link href="/login" className="text-slate-600 font-medium">로그인으로 돌아가기</Link>
        </p>
      </div>
    </div>
  );
}
