'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function LoginPage() {
  const router = useRouter();
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
      if (role === 'OPERATOR') router.push('/operator');
      else if (role === 'PARTICIPANT') router.push('/participant');
      else router.push('/client');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm mx-auto px-5 py-20 text-center">
          <h1 className="font-serif italic text-3xl mb-10">로그인</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
            <div>
              <label className="field-label">이메일</label>
              <input
                type="email" required
                className="field-input"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">비밀번호</label>
              <input
                type="password" required
                className="field-input"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            {error && <p className="text-[12px] text-red-700">{error}</p>}
            <button type="submit" disabled={loading} className="btn-solid mt-4 disabled:opacity-50">
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="text-[12px] text-muted mt-8">
            계정이 없으신가요?{' '}
            <Link href="/register" className="text-ink border-b border-ink">
              회원가입
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
