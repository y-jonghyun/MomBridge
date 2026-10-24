import type { Metadata } from 'next';
import SiteHeader from '@/components/ui/SiteHeader';
import { BottomTabBar, BottomTabBarSpacer } from '@/components/ui';
import { CardIcon, CheckIcon, ClockIcon, PinIcon } from '@/components/ui/icons';
import AboutHeroActions from '@/components/landing/AboutHeroActions';
import {
  Faq, FeatureCard, LANDING_WIDTH, LandingCta, LandingFooter, LandingHeading,
  MarkedList, PhotoSlot, Steps,
} from '@/components/landing/pieces';
import { PLATFORM_FEE_PERCENT, netReward, platformFee } from '@/lib/fees';

/**
 * 맘브릿지 소개 — 엄마용.
 * 시안: docs/design/mombridge-design/About.html (390px 기준)
 * 로그인 없이 볼 수 있어야 한다 (미들웨어·가드 없음).
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

/** 보상 예시 — 금액은 예시지만 수수료율은 실제 값을 따른다 */
const EXAMPLE_REWARD = 20000;
const won = (value: number) => `${value.toLocaleString()}원`;

const WHY = [
  {
    icon: <PinIcon size={20} />, tone: 'clay' as const, title: '집 가까이',
    body: '내가 사는 동네의 가게 미션을 먼저 보여드려요. 멀리 갈 필요가 없어요.',
  },
  {
    icon: <ClockIcon size={20} />, tone: 'sage' as const, title: '내 시간에 맞춰',
    body: '평일 낮, 주말, 아이와 함께, 집에서 하는 미션을 골라서 볼 수 있어요.',
  },
  {
    icon: <CardIcon size={20} />, tone: 'clay' as const, title: '정직한 보상',
    body: '수수료와 받는 금액, 지급일을 신청하기 전에 미리 보여드려요.',
  },
];

const STEPS = [
  { title: '미션 고르고 신청하기', body: '우리 동네 미션에서 마음에 드는 걸 골라 신청해요.' },
  { title: '선정 안내 받기', body: '선정되면 알림으로 방문 방법과 일정을 알려드려요.' },
  { title: '방문하고 후기 남기기', body: '가게를 체험하고 내 블로그나 SNS에 솔직한 후기를 올려요.' },
  // 지급 규칙은 정산(lib/payout)과 같은 표현을 쓴다 — 후기 마감 다음 달 10일
  { title: '다음 달 10일 보상 받기', body: '후기가 승인되면 후기 마감 다음 달 10일에 등록한 계좌로 보내드려요.' },
];

const PROMISES = [
  '내 연락처와 주소는 가게에 알려주지 않아요.',
  '후기에 넣어야 할 광고 표시 문구를 미리 안내해 드려요.',
  '후기는 솔직하게 쓰면 돼요. 칭찬을 강요하지 않아요.',
];

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

      {/* 히어로 */}
      <section className={`${LANDING_WIDTH} pt-[26px]`}>
        <LandingHeading as="h1" eyebrow="For moms in the neighborhood">
          아이 등원 후 두 시간,<br />우리 동네에서<br />내 일이 생겨요
        </LandingHeading>
        <p className="mt-3.5 break-keep text-[15px] leading-[1.7] text-ink-2">
          집 근처 가게에 들러 체험하고, 솔직한 후기를 남기면 보상을 받아요. 출퇴근도, 면접도 없어요.
        </p>
        <AboutHeroActions />
        <PhotoSlot label="동네 가게에서 체험하는 엄마 사진" className="mt-[26px]" />
      </section>

      {/* 맘브릿지는 이런 곳이에요 */}
      <section className={`${LANDING_WIDTH} pt-11`}>
        <LandingHeading eyebrow="Why MomBridge">맘브릿지는 이런 곳이에요</LandingHeading>
        <div className="mt-[18px] space-y-3">
          {WHY.map(({ icon, tone, title, body }) => (
            <FeatureCard key={title} icon={icon} tone={tone} title={title}>{body}</FeatureCard>
          ))}
        </div>
      </section>

      {/* 이렇게 진행돼요 */}
      <section className={`${LANDING_WIDTH} pt-11`}>
        <LandingHeading eyebrow="How it works">이렇게 진행돼요</LandingHeading>
        <div className="mt-[18px]">
          <Steps steps={STEPS} />
        </div>
      </section>

      {/* 보상 예시 */}
      <section className={`${LANDING_WIDTH} pt-10`}>
        <div className="rounded-box bg-ink px-5 py-[22px] text-paper">
          <span className="font-accent text-sm italic text-clay-tint">Example</span>
          <p className="mb-4 mt-1 font-serif text-section font-bold">보상은 이렇게 계산돼요</p>
          <div className="flex justify-between border-b border-[#3A332B] py-2 text-sm">
            <span className="text-[#CFC4B4]">미션 보상</span>
            <span>{won(EXAMPLE_REWARD)}</span>
          </div>
          <div className="flex justify-between border-b border-[#3A332B] py-2 text-sm">
            <span className="text-[#CFC4B4]">플랫폼 수수료 {PLATFORM_FEE_PERCENT}%</span>
            <span>−{won(platformFee(EXAMPLE_REWARD))}</span>
          </div>
          <div className="flex items-baseline justify-between pt-3">
            <span className="text-sm text-[#CFC4B4]">받는 금액</span>
            <span className="font-serif text-title font-bold">{won(netReward(EXAMPLE_REWARD))}</span>
          </div>
          <p className="mt-2.5 break-keep text-xs leading-[1.6] text-[#CFC4B4]">
            예시 금액이에요. 세금이 있는 경우 따로 안내해 드려요.
          </p>
        </div>
      </section>

      {/* 우리가 지키는 것 */}
      <section className={`${LANDING_WIDTH} pt-11`}>
        <LandingHeading eyebrow="Our promise">우리가 지키는 것</LandingHeading>
        <MarkedList
          className="mt-3.5"
          icon={<CheckIcon size={18} strokeWidth={2} className="text-sage" />}
          items={PROMISES}
        />
      </section>

      {/* 자주 묻는 질문 */}
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
