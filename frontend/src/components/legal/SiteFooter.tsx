import Link from 'next/link';
import { FOOTER_COPYRIGHT, LEGAL_LINKS, businessInfoLine } from '@/lib/legal';

/**
 * 사이트 하단. 약관·방침 링크와 사업자 정보를 함께 보여준다.
 * 사업자 정보는 lib/legal의 BUSINESS_INFO 한 곳에서 오고,
 * 아직 비어 있는 항목(사업자등록번호·통신판매업 신고번호·주소)은 줄에서 빠진다.
 *
 * 설치 앱(standalone)에서는 숨긴다(.web-only). 같은 묶음이 참여자·고객사의 '내 정보'(LegalInfo)와
 * 로그인·가입 화면(AuthShell)에 있어, 설치 앱에서도 약관·방침·사업자 정보에 닿을 수 있다.
 */
export default function SiteFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`web-only border-t border-line bg-paper py-6 text-center text-xs text-muted ${className}`}>
      <p>{FOOTER_COPYRIGHT}</p>
      {/* 터치 영역 44px (디자인 기준 1번) */}
      <p className="mt-1 flex items-center justify-center">
        {LEGAL_LINKS.map((l, i) => (
          <span key={l.href} className="flex items-center">
            {i > 0 && <span aria-hidden>·</span>}
            <Link href={l.href} className={`inline-flex min-h-[44px] items-center px-2 hover:underline ${'strong' in l && l.strong ? 'font-semibold' : ''}`}>{l.label}</Link>
          </span>
        ))}
      </p>
      <p className="mx-auto mt-2 max-w-shell px-5 leading-relaxed">{businessInfoLine()}</p>
    </footer>
  );
}
