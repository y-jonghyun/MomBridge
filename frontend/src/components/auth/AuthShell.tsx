import Link from 'next/link';

/**
 * 로그인·회원가입·비밀번호 화면의 공통 틀.
 * 기준: docs/design/mombridge-design/cream-editorial-v1.md (크림 배경 + paper 카드, 그림자 없음)
 */
export default function AuthShell({
  title, subtitle, children, footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex min-h-[44px] flex-col items-center justify-center text-ink">
          <span className="font-accent text-[13px] italic tracking-[0.08em] text-muted">MomBridge</span>
          <span className="font-serif text-[22px] font-bold tracking-[-0.02em]">맘브릿지</span>
        </Link>

        <div className="rounded-box border border-line bg-paper p-7">
          <h1 className="text-center font-serif text-title font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-center text-[13px] text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-4 space-y-2 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}

/** 입력 한 줄 — 라벨 13px muted + paper 입력칸 */
export function Field({
  id, label, children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] text-muted">{label}</label>
      {children}
    </div>
  );
}

/** 모든 인증 화면이 같은 입력 모양을 쓰도록 */
export const authInputClass =
  'h-12 w-full rounded-control border border-line bg-cream px-3 text-sm text-ink outline-none focus:border-ink';

/** 기본 동작 버튼 */
export const authButtonClass =
  'flex h-12 w-full items-center justify-center rounded-control bg-ink text-sm font-bold text-paper disabled:opacity-50';
