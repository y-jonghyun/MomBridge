'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Role } from '@/store/auth';
import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({
    email: '', password: '', name: '', phone: '',
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
    <div className="min-h-screen flex flex-col bg-cream">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm mx-auto px-5 py-20 text-center">
          <h1 className="font-serif italic text-3xl mb-10">회원가입</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
            <div>
              <label className="field-label">역할</label>
              <select
                className="field-input"
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
                  <label className="field-label">{label}</label>
                  <input
                    type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'}
                    required
                    className="field-input"
                    value={form[key as keyof typeof form] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              );
            })}
            {form.role === 'CLIENT' && (
              <div>
                <label className="field-label">연락처 (SMS 수신용)</label>
                <input
                  type="tel"
                  placeholder="예: 01012345678"
                  className="field-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <p className="text-[11px] text-muted mt-1.5">운영자가 결제 링크를 SMS로 발송할 때 사용됩니다</p>
              </div>
            )}
            {error && <p className="text-[12px] text-red-700">{error}</p>}
            <button type="submit" disabled={loading} className="btn-solid mt-4 disabled:opacity-50">
              {loading ? '처리 중...' : '가입하기'}
            </button>
          </form>

          <p className="text-[12px] text-muted mt-8">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-ink border-b border-ink">
              로그인
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>;
}
