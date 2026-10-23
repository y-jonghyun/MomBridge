import Link from 'next/link';
import { businessInfoLine } from '@/lib/legal';

/**
 * 사이트 하단. 약관·방침 링크와 사업자 정보를 함께 보여준다.
 * 사업자 정보는 lib/legal의 BUSINESS_INFO 한 곳에서 오고,
 * 아직 비어 있는 항목(사업자등록번호·통신판매업 신고번호·주소)은 줄에서 빠진다.
 */
export default function SiteFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`border-t border-line bg-paper py-6 text-center text-xs text-muted ${className}`}>
      <p>© 2026 맘브릿지 · 지역 마케팅 미션 플랫폼</p>
      <p className="mt-2">
        <Link href="/terms" className="hover:underline">이용약관</Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="font-semibold hover:underline">개인정보처리방침</Link>
      </p>
      <p className="mx-auto mt-2 max-w-shell px-5 leading-relaxed">{businessInfoLine()}</p>
    </footer>
  );
}
