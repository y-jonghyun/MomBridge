import Link from 'next/link';
import SiteFooter from '@/components/legal/SiteFooter';
import { ChevronDownIcon } from '@/components/ui/icons';
import { BUSINESS_INFO } from '@/lib/legal';

/**
 * 소개 페이지(/about · /for-shops)가 함께 쓰는 조각들.
 * 시안: docs/design/mombridge-design/About.html · ForShops.html (390px 기준)
 *
 * 두 페이지 모두 서버 컴포넌트다 — 로그인 상태가 필요한 부분만 따로 client로 뺀다.
 */

/** 본문 한 줄 폭. 모바일은 그대로, 데스크톱에서는 가운데 640px */
export const LANDING_WIDTH = 'mx-auto w-full max-w-[640px] px-5';

/** 섹션 위 영문 머리말 + 제목 */
export function LandingHeading({
  eyebrow, children, as: As = 'h2', className = '',
}: {
  eyebrow: string;
  children: React.ReactNode;
  as?: 'h1' | 'h2';
  className?: string;
}) {
  const size = As === 'h1'
    ? 'text-[31px] leading-[1.32] tracking-[-0.03em]'
    : 'text-[22px] leading-[1.4] tracking-[-0.02em]';
  return (
    <>
      <span className="font-accent text-[15px] italic text-clay">{eyebrow}</span>
      <As className={`mt-1 font-serif font-bold text-ink ${size} ${className}`}>{children}</As>
    </>
  );
}

/**
 * 사진 자리. 지금은 색 상자만 두고, 이미지가 생기면 src만 넘기면 된다.
 * (시안의 #E4D3C1 자리 색 = photo-1)
 */
export function PhotoSlot({
  label, src, alt, className = '', heightClass = 'h-[230px]',
}: {
  /** 이미지가 없을 때 상자 안에 적는 설명 */
  label: string;
  src?: string;
  alt?: string;
  className?: string;
  heightClass?: string;
}) {
  if (src) {
    return (
      // 이미지가 생기면 next/image로 바꾼다 (지금은 자리만)
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? label} className={`w-full rounded-box object-cover ${heightClass} ${className}`} />
    );
  }
  return (
    <div
      role="img" aria-label={label}
      className={`flex items-end rounded-box bg-photo-1 p-4 ${heightClass} ${className}`}
    >
      <span className="text-xs text-photo-ink-1">{label}</span>
    </div>
  );
}

/** 아이콘 + 제목 + 설명 카드 */
export function FeatureCard({
  icon, tone = 'clay', title, children,
}: {
  icon: React.ReactNode;
  /** 아이콘 칸 색 — 시안이 clay-tint와 sage-tint를 번갈아 쓴다 */
  tone?: 'clay' | 'sage';
  title: string;
  children: React.ReactNode;
}) {
  const toneClass = tone === 'sage' ? 'bg-sage-tint text-sage' : 'bg-clay-tint text-clay';
  return (
    <div className="flex gap-3.5 rounded-card border border-line bg-paper p-[18px]">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${toneClass}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-bold text-ink">{title}</p>
        <p className="mt-1 break-keep text-[13px] leading-[1.6] text-muted">{children}</p>
      </div>
    </div>
  );
}

/** 번호가 붙은 단계 목록. 마지막 단계만 clay로 강조한다 */
export function Steps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="list-none p-0">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={step.title} className={`flex gap-3.5 ${last ? '' : 'pb-5'}`}>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-paper ${
                last ? 'bg-clay' : 'bg-ink'
              }`}
            >
              {i + 1}
            </span>
            <div className="min-w-0 pt-1.5">
              <p className="text-[15px] font-bold text-ink">{step.title}</p>
              <p className="mt-1 break-keep text-[13px] leading-[1.6] text-muted">{step.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** 체크·엑스 표가 붙은 한 줄 목록 */
export function MarkedList({
  icon, items, className = '',
}: {
  icon: React.ReactNode;
  items: string[];
  className?: string;
}) {
  return (
    <ul className={`list-none space-y-2.5 p-0 ${className}`}>
      {items.map(item => (
        <li key={item} className="flex gap-2.5 break-keep text-sm leading-[1.6] text-ink-2">
          <span className="mt-[3px] shrink-0">{icon}</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

/** 펼쳐 보는 질문 목록 */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="border-t border-line">
      {items.map(({ q, a }) => (
        <details key={q} className="group border-b border-line">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 break-keep py-3.5 text-[15px] font-medium text-ink marker:hidden">
            {q}
            <ChevronDownIcon size={16} strokeWidth={1.8} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <p className="pb-4 break-keep text-[13px] leading-[1.7] text-ink-2">{a}</p>
        </details>
      ))}
    </div>
  );
}

/** 문의 메일. 제목을 미리 채워 둔다 */
export const inquiryMailto = (subject = '[미션 등록 문의]') =>
  `mailto:${BUSINESS_INFO.inquiryEmail}?subject=${encodeURIComponent(subject)}`;

const BUTTON_BASE = 'flex min-h-[52px] items-center justify-center rounded-control-lg px-5 text-center text-[15px] font-bold';

/** 눈에 띄는 버튼 (clay) */
export function LandingCta({
  href, children, tone = 'clay', className = '',
}: {
  href: string;
  children: React.ReactNode;
  tone?: 'clay' | 'outline' | 'paper';
  className?: string;
}) {
  const toneClass =
    tone === 'outline' ? 'border border-ink bg-transparent font-medium text-ink'
      : tone === 'paper' ? 'bg-paper text-ink'
        : 'bg-clay text-paper';
  const cls = `${BUTTON_BASE} ${toneClass} ${className}`;
  // 메일·앵커는 같은 페이지 밖이거나 라우팅이 필요 없어 a로 둔다
  return href.startsWith('/') ? (
    <Link href={href} className={cls}>{children}</Link>
  ) : (
    <a href={href} className={cls}>{children}</a>
  );
}

/** 두 소개 페이지가 같이 쓰는 하단 */
export function LandingFooter() {
  return <SiteFooter className="mt-10" />;
}
