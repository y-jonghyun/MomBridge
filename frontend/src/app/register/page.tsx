'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Role } from '@/store/auth';
import { Suspense } from 'react';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({
    email: '', password: '', name: '',
    role: (['PARTICIPANT', 'CLIENT'].includes(searchParams.get('role')?.toUpperCase() ?? '') ? searchParams.get('role')!.toUpperCase() : 'PARTICIPANT') as Role,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/register', form);
      setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
      router.push('/missions');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? '회원가입에 실패했습니다');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-center mb-2">맘브릿지</h1>
        <p className="text-gray-500 text-center mb-8">회원가입</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              <option value="PARTICIPANT">참여자 (지역 주민)</option>
              <option value="CLIENT">고객사 (소상공인)</option>
            </select>
          </div>
          {(['이름', '이메일', '비밀번호'] as const).map((label) => {
            const key = label === '이름' ? 'name' : label === '이메일' ? 'email' : 'password';
            return (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            );
          })}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-slate-700 text-white rounded-lg py-2 font-semibold hover:bg-slate-700 disabled:opacity-50">
            {loading ? '처리 중...' : '가입하기'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          이미 계정이 있으신가요? <Link href="/login" className="text-slate-600 font-medium">로그인</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>;
}
