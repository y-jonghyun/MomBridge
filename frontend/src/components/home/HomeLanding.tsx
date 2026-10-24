import Link from 'next/link';
import { MissionCard } from '@/components/ui';
import { ArrowRightIcon } from '@/components/ui/icons';
import { toCardData, type MissionListItem } from '@/components/missions/MissionBrowser';
import { LANDING_WIDTH, LandingFooter, LandingHeading } from '@/components/landing/pieces';
import {
  HeroSection, HowItWorksSection, PromiseSection, RewardExampleSection, WhySection,
} from '@/components/landing/sections';

/**
 * 처음 온 사람(로그인 전)이 보는 홈.
 * 섹션은 /about과 **같은 것**을 쓴다 (components/landing/sections.tsx).
 * 가운데에 우리 동네 미션 미리보기만 끼워 넣는다.
 *
 * 한부모 같은 사회적 가치 문구는 여기에 두지 않는다 — /for-shops에만 있다.
 */
export default function HomeLanding({ missions }: { missions: MissionListItem[] }) {
  const preview = missions.slice(0, 4);

  return (
    <>
      <HeroSection className="pt-[26px]" />
      <WhySection className="pt-11" />

      {/* 미션이 없으면 이 구역은 통째로 빠진다 (빈 안내를 두지 않는다) */}
      {preview.length > 0 && (
        <section className={`${LANDING_WIDTH} pt-11`}>
          <div className="flex items-baseline justify-between gap-3">
            {/* 머리말과 제목은 두 줄로 쌓이고, '전체 보기'만 오른쪽에 붙는다 */}
            <div className="min-w-0">
              <LandingHeading eyebrow="Open now">우리 동네 미션 미리보기</LandingHeading>
            </div>
            <Link href="/missions" className="flex min-h-[44px] shrink-0 items-center text-[13px] text-muted">
              전체 보기
            </Link>
          </div>
          <div className="mt-[18px] grid grid-cols-2 gap-x-3 gap-y-[22px]">
            {preview.map(m => <MissionCard key={m.id} mission={toCardData(m)} variant="grid" />)}
          </div>
        </section>
      )}

      <HowItWorksSection className="pt-11" />
      <RewardExampleSection className="pt-10" />
      <PromiseSection className="pt-11" />

      {/* 사장님 띠 */}
      <section className={`${LANDING_WIDTH} pt-11`}>
        <div className="border-y border-line px-[22px] py-[26px]">
          <span className="font-accent text-sm italic text-clay">For shop owners</span>
          <h2 className="mb-2 mt-1 break-keep font-serif text-section font-bold leading-[1.4] text-ink">
            가게 사장님이신가요?
          </h2>
          <p className="mb-4 break-keep text-[13px] leading-[1.65] text-muted">
            동네 엄마들의 후기가 가게 방문으로 이어졌는지 숫자로 보여 드려요.
          </p>
          <Link
            href="/for-shops"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control border border-ink px-[18px] text-sm font-medium text-ink"
          >
            사장님 안내 보기
            <ArrowRightIcon size={14} strokeWidth={1.8} />
          </Link>
        </div>
      </section>

      <LandingFooter />
    </>
  );
}
