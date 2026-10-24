import type { Metadata } from 'next';
import SiteHeader from '@/components/ui/SiteHeader';
import { BottomTabBar, BottomTabBarSpacer } from '@/components/ui';
import { Faq, LANDING_WIDTH, LandingCta, LandingFooter, LandingHeading } from '@/components/landing/pieces';
import {
  HeroSection, HowItWorksSection, PromiseSection, RewardExampleSection, WhySection,
} from '@/components/landing/sections';

/**
 * 맘브릿지 소개 — 엄마용.
 * 시안: docs/design/mombridge-design/About.html (390px 기준)
 * 로그인 없이 볼 수 있어야 한다 (미들웨어·가드 없음).
 *
 * 섹션은 components/landing/sections.tsx에서 온다 — 비로그인 홈(/)과 같은 것을 쓴다.
 */

export const metadata: Metadata = {
  title: '맘브릿지 소개 — 아이 등원 후 두 시간, 우리 동네에서 내 일이 생겨요',
  description:
    '집 근처 가게에 들러 체험하고 솔직한 후기를 남기면 보상을 받아요. 출퇴근도, 면접도 없어요. 우리 동네 미션을 둘러보세요.',
  openGraph: {
    title: '아이 등원 후 두 시간, 우리 동네에서 내 일이 생겨요',
    description: '집 근처 가게를 체험하고 후기를 남기면 보상을 받는 동네 미션. 맘브릿지.',
    url: '/about',
    siteName: '맘브릿지',
    locale: 'ko_KR',
    type: 'website',
  },
};

const FAQ = [
  {
    q: '블로그 방문자가 적어도 할 수 있나요?',
    a: '네. 미션마다 조건이 달라요. "처음이라면" 미션부터 시작해 보세요.',
  },
  {
    q: '아이와 같이 가도 되나요?',
    a: '"아이 동반 가능" 표시가 있는 미션은 함께 가셔도 돼요.',
  },
  {
    q: '선정은 어떻게 되나요?',
    a: '활동 지역과 SNS 활동을 보고 운영자가 선정해요. 결과는 알림으로 알려드려요.',
  },
  {
    q: '보상은 언제 받나요?',
    // lib/payout.ts의 PAYOUT_DELAY_HINT와 같은 문장 (그 파일은 'use client'라 서버 화면에서 값을 읽어 오지 않는다)
    a: '후기 마감이 있는 달의 다음 달 10일에 받아요. 검수가 늦어지면 다음 달로 미뤄질 수 있어요.',
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-cream">
      <SiteHeader showSearch={false} />

      <HeroSection className="pt-[26px]" />
      <WhySection className="pt-11" />
      <HowItWorksSection className="pt-11" />
      <RewardExampleSection className="pt-10" />
      <PromiseSection className="pt-11" />

      {/* 자주 묻는 질문 — 소개 페이지에만 둔다 */}
      <section className={`${LANDING_WIDTH} pt-11`}>
        <LandingHeading eyebrow="Questions">자주 묻는 질문</LandingHeading>
        <div className="mt-3.5">
          <Faq items={FAQ} />
        </div>
      </section>

      {/* 마무리 */}
      <section className={`${LANDING_WIDTH} pt-11`}>
        <div className="rounded-box bg-clay-tint px-[22px] py-7 text-center">
          <p className="font-serif text-[22px] font-bold leading-[1.4] text-ink">
            우리 동네에 어떤 미션이<br />있는지 볼까요?
          </p>
          <LandingCta href="/missions" className="mt-[18px]">우리 동네 미션 보기</LandingCta>
        </div>
      </section>

      <LandingFooter />
      <BottomTabBarSpacer />
      <BottomTabBar />
    </main>
  );
}
