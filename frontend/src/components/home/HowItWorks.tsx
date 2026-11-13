import Link from 'next/link';
import { PLATFORM_FEE_PERCENT } from '@/lib/fees';
import { ArrowRightIcon } from '@/components/ui/icons';

/**
 * '맘브릿지는 이렇게 진행돼요' 세 줄 — 출시 첫날 홈(열린 미션 0개)에서 빈자리를 채운다.
 * 지급 시기·공제는 이용약관 제8조와 같은 말로 쓴다 (수수료는 lib/fees의 값).
 */
const STEPS: [string, string][] = [
  ['동네 가게의 미션에 신청해요', '선정되면 알림함으로 알려 드려요'],
  ['가게에 다녀와 후기를 올려요', '미션마다 안내된 방법대로 내 SNS에 올려요'],
  ['승인되면 다음 달 10일에 보상을 받아요', `보상금에서 수수료 ${PLATFORM_FEE_PERCENT}%와 세금 3.3%를 뺀 금액이에요`],
];

export default function HowItWorks({ className = '' }: { className?: string }) {
  return (
    <section aria-labelledby="how-it-works" className={className}>
      <h2 id="how-it-works" className="text-[15px] font-bold text-ink">맘브릿지는 이렇게 진행돼요</h2>
      <ol className="m-0 mt-1 list-none space-y-3 p-0">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex gap-3 pt-2">
            <span aria-hidden="true" className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-clay-tint text-[13px] font-bold text-clay-dark">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block break-keep text-[14.5px] font-medium text-ink">{t}</span>
              <span className="mt-0.5 block break-keep text-[12.5px] leading-[1.55] text-muted">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link href="/about" className="mt-2 flex min-h-[44px] items-center gap-1 text-[13px] font-medium text-clay">
        맘브릿지 더 알아보기
        <ArrowRightIcon size={13} strokeWidth={1.8} />
      </Link>
    </section>
  );
}
