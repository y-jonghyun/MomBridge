'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Role } from '@/store/auth';
import { Suspense } from 'react';
import AuthShell, { authButtonClass, authInputClass } from '@/components/auth/AuthShell';

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
      setError(apiErrorMessage(err, '회원가입에 실패했습니다'));
    } finally { setLoading(false); }
  }

  return (
    <AuthShell
      title="회원가입"
      footer={<>
          <p>이미 계정이 있으신가요? <Link href="/login" className="font-medium text-clay">로그인</Link></p>
        </>}
    >
      <>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">역할</label>
            <select
              className="w-full border rounded-control px-3 py-2 text-sm"
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
                <label className="block text-sm font-medium text-ink-2 mb-1">{label}</label>
                <input
                  type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'}
                  required
                  className={authInputClass}
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            );
          })}
          {form.role === 'CLIENT' && (
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">연락처 (SMS 수신용)</label>
              <input
                type="tel"
                placeholder="예: 01012345678"
                className={authInputClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <p className="text-xs text-muted mt-1">운영자가 결제 링크를 SMS로 발송할 때 사용됩니다</p>
            </div>
          )}
          {error && <p className="text-clay-dark text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className={authButtonClass}>
            {loading ? '처리 중...' : '가입하기'}
          </button>
        </form>
      </>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>;
}
