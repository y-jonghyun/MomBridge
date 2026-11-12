import Link from 'next/link';
import { FOOTER_COPYRIGHT, LEGAL_LINKS, businessInfoLine } from '@/lib/legal';

/**
 * '내 정보' 맨 아래의 약관·방침·사업자 정보 묶음 (참여자 내 활동 · 고객사 내 정보).
 * 사이트 하단(SiteFooter)과 같은 문구를 lib/legal에서 그대로 가져온다 — 설치 앱에서는 하단이 숨겨지므로 여기서 닿는다.
 */
export default function LegalInfo({ className = '' }: { className?: string }) {
  return (
    <section aria-label="약관과 사업자 정보" className={`rounded-box border border-line bg-paper px-5 pb-4 pt-2 ${className}`}>
      <ul className="m-0 list-none divide-y divide-line-soft p-0">
        {LEGAL_LINKS.map(l => (
          <li key={l.href}>
            <Link href={l.href} className="press flex min-h-[48px] items-center justify-between text-sm text-ink">
              <span className={'strong' in l && l.strong ? 'font-semibold' : ''}>{l.label}</span>
              <span aria-hidden className="text-muted">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t border-line-soft pt-3 text-xs leading-relaxed text-muted">
        <p>{businessInfoLine()}</p>
        <p className="mt-1">{FOOTER_COPYRIGHT}</p>
      </div>
    </section>
  );
}
