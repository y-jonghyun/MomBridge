import { CardIcon, CheckIcon, ClockIcon, PinIcon } from '@/components/ui/icons';
import AboutHeroActions from './AboutHeroActions';
import {
  FeatureCard, LANDING_WIDTH, LandingHeading, MarkedList, PhotoSlot, Steps,
} from './pieces';
import { PLATFORM_FEE_PERCENT, netReward, platformFee } from '@/lib/fees';

/**
 * 소개 섹션. /about과 비로그인 홈이 **같은 것을 함께 쓴다** (문구를 두 곳에 두지 않는다).
 * 시안: docs/design/mombridge-design/About.html
 */

const won = (value: number) => `${value.toLocaleString()}원`;

/** 보상 예시에 쓰는 금액. 수수료율은 lib/fees의 값을 따른다 */
const EXAMPLE_REWARD = 20000;

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

/** 히어로. 로그인한 사람에게는 '가입하기'를 보여 주지 않는다 (AboutHeroActions) */
export function HeroSection({ photo = true, className = '' }: { photo?: boolean; className?: string }) {
  return (
    <section className={`${LANDING_WIDTH} ${className}`}>
      <LandingHeading as="h1" eyebrow="For moms in the neighborhood">
        아이 등원 후 두 시간,<br />우리 동네에서<br />내 일이 생겨요
      </LandingHeading>
      <p className="mt-3.5 break-keep text-[15px] leading-[1.7] text-ink-2">
        집 근처 가게에 들러 체험하고, 솔직한 후기를 남기면 보상을 받아요. 출퇴근도, 면접도 없어요.
      </p>
      <AboutHeroActions />
      {photo && <PhotoSlot label="동네 가게에서 체험하는 엄마 사진" className="mt-[26px]" />}
    </section>
  );
}

/** 맘브릿지는 이런 곳이에요 — 카드 3개 */
export function WhySection({ className = '' }: { className?: string }) {
  return (
    <section className={`${LANDING_WIDTH} ${className}`}>
      <LandingHeading eyebrow="Why MomBridge">맘브릿지는 이런 곳이에요</LandingHeading>
      <div className="mt-[18px] space-y-3">
        {WHY.map(({ icon, tone, title, body }) => (
          <FeatureCard key={title} icon={icon} tone={tone} title={title}>{body}</FeatureCard>
        ))}
      </div>
    </section>
  );
}

/** 이렇게 진행돼요 — 4단계 */
export function HowItWorksSection({ className = '' }: { className?: string }) {
  return (
    <section className={`${LANDING_WIDTH} ${className}`}>
      <LandingHeading eyebrow="How it works">이렇게 진행돼요</LandingHeading>
      <div className="mt-[18px]">
        <Steps steps={STEPS} />
      </div>
    </section>
  );
}

/** 보상 예시 카드 */
export function RewardExampleSection({ className = '' }: { className?: string }) {
  return (
    <section className={`${LANDING_WIDTH} ${className}`}>
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
  );
}

/** 우리가 지키는 것 — 약속 3개 */
export function PromiseSection({ className = '' }: { className?: string }) {
  return (
    <section className={`${LANDING_WIDTH} ${className}`}>
      <LandingHeading eyebrow="Our promise">우리가 지키는 것</LandingHeading>
      <MarkedList
        className="mt-3.5"
        icon={<CheckIcon size={18} strokeWidth={2} className="text-sage" />}
        items={PROMISES}
      />
    </section>
  );
}
