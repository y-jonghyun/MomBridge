'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Role } from '@/store/auth';
import { Suspense } from 'react';
import AuthShell, { authButtonClass, authInputClass } from '@/components/auth/AuthShell';
import { formatPhone, isMobilePhone, phoneDigits } from '@/lib/phone';
import { PASSWORD_HINT, passwordError } from '@/lib/password';

const AGREEMENTS = [
  { key: 'age14', label: '만 14세 이상입니다', required: true },
  { key: 'terms', label: '이용약관 동의', required: true, href: '/terms' },
  { key: 'privacy', label: '개인정보 수집·이용 동의', required: true, href: '/privacy' },
  { key: 'marketing', label: '이벤트·새 미션 소식 받기', required: false },
] as const;
type AgreementKey = (typeof AGREEMENTS)[number]['key'];

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({
    email: '', password: '', name: '', phone: '',
    role: (['PARTICIPANT', 'CLIENT'].includes(searchParams.get('role')?.toUpperCase() ?? '') ? searchParams.get('role')!.toUpperCase() : 'PARTICIPANT') as Role,
  });
  const [agreements, setAgreements] = useState<Record<AgreementKey, boolean>>({ age14: false, terms: false, privacy: false, marketing: false });
  const allAgreed = AGREEMENTS.every(a => agreements[a.key]);
  const requiredAgreed = AGREEMENTS.every(a => !a.required || agreements[a.key]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requiredAgreed) { setError('필수 항목에 동의해 주세요'); return; }
    if (!isMobilePhone(form.phone)) { setError('010으로 시작하는 휴대폰 번호를 입력해주세요'); return; }
    const badPassword = passwordError(form.password);
    if (badPassword) { setError(badPassword); return; }
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/register', { ...form, phone: phoneDigits(form.phone), agreements });
      setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
      // 가입 직후에는 프로필을 채우러 보낸다 (참여자는 지원 전, 고객사는 미션 등록 전에 꼭 필요하다)
      router.push(form.role === 'CLIENT' ? '/client?tab=profile&welcome=1' : '/participant?tab=profile&welcome=1');
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
                  autoComplete={key === 'password' ? 'new-password' : undefined}
                  className={authInputClass}
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
                {key === 'password' && <p className="mt-1 text-xs text-muted">{PASSWORD_HINT}</p>}
              </div>
            );
          })}
          <div>
            <label htmlFor="signup-phone" className="block text-sm font-medium text-ink-2 mb-1">휴대폰 번호</label>
            <input
              id="signup-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={13}
              placeholder="010-1234-5678"
              className={authInputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
            />
            <p className="text-xs text-muted mt-1">
              {form.role === 'CLIENT'
                ? '결제·정산 안내를 이 번호로 보냅니다'
                : '선정·정산 안내를 이 번호로 보냅니다'}
            </p>
          </div>
          <fieldset className="space-y-2 rounded-card border border-line bg-cream p-3">
            <legend className="sr-only">약관 동의</legend>
            <label className="flex items-center gap-2 border-b border-line pb-2 text-sm font-semibold text-ink">
              <input type="checkbox" className="h-4 w-4 accent-ink" checked={allAgreed}
                onChange={(e) => setAgreements(Object.fromEntries(AGREEMENTS.map(a => [a.key, e.target.checked])) as Record<AgreementKey, boolean>)} />
              전체 동의 <span className="text-xs font-normal text-muted">(선택 항목 포함)</span>
            </label>
            {AGREEMENTS.map(a => (
              <div key={a.key} className="flex items-center justify-between gap-2 text-sm text-ink-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-ink" checked={agreements[a.key]}
                    onChange={(e) => setAgreements({ ...agreements, [a.key]: e.target.checked })} />
                  <span className={a.required ? 'font-medium text-ink' : 'text-muted'}>[{a.required ? '필수' : '선택'}]</span>
                  {a.label}
                </label>
                {'href' in a && (
                  <Link href={a.href} target="_blank" className="shrink-0 text-xs text-muted underline">보기</Link>
                )}
              </div>
            ))}
          </fieldset>
          {error && <p className="text-clay-dark text-sm">{error}</p>}
          <button type="submit" disabled={loading || !requiredAgreed}
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
