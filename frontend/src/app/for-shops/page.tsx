import type { Metadata } from 'next';
import SiteHeader from '@/components/ui/SiteHeader';
import { BottomTabBar, BottomTabBarSpacer } from '@/components/ui';
import { ChartIcon, PinIcon, ShieldCheckIcon, XCircleIcon } from '@/components/ui/icons';
import {
  Faq, FeatureCard, LANDING_WIDTH, LandingCta, LandingFooter, LandingHeading,
  MarkedList, Steps, inquiryMailto,
} from '@/components/landing/pieces';
import { CLIENT_PAYMENT_ENABLED } from '@/lib/features';

/**
 * 맘브릿지 소개 — 사장님용.
 * 시안: docs/design/mombridge-design/ForShops.html (390px 기준)
 *
 * 비용(금액)은 적지 않는다 — 가게마다 구성이 달라서 문의로 안내한다.
 * 리포트 숫자는 보여 주기용 예시다. API를 부르지 않는다.
 */

export const metadata: Metadata = {
  title: '맘브릿지 사장님 안내 — 동네 엄마들의 진짜 후기, 가게 방문으로 이어졌는지 숫자로',
  description:
    '가게 근처에 사는 엄마들이 직접 방문해 체험하고 솔직한 후기를 남겨요. 후기를 보고 몇 명이 가게를 찾았는지 리포트로 보여 드립니다.',
  openGraph: {
    title: '동네 엄마들의 진짜 후기, 가게 방문으로 이어졌는지 숫자로',
    description: '동네 엄마들의 체험 후기와 방문 성과 리포트. 맘브릿지 사장님 안내.',
    url: '/for-shops',
    siteName: '맘브릿지',
    locale: 'ko_KR',
    type: 'website',
  },
};

const INQUIRY = inquiryMailto();

const PROBLEMS = [
  '멀리 사는 사람이 쓴 후기라 동네 손님으로 이어지지 않았어요',
  '광고 문구 같은 후기는 오히려 믿음을 잃었어요',
  '후기를 몇 명이 봤는지, 효과가 있었는지 알 길이 없었어요',
];

/** 리포트 미리보기 — 전부 예시 숫자다 (API 호출 없음) */
const EXAMPLE_REPORT = {
  caption: '신메뉴 소금빵 체험 · 후기 4건',
  stats: [
    { value: '4', label: '등록된 후기' },
    { value: '57', label: '후기로 들어온 방문' },
    { value: '49', label: '고유 방문자' },
  ],
  /** 후기 등록 후 7일 동안의 방문 추이 — 가장 높은 날만 clay */
  bars: [20, 44, 100, 72, 50, 38, 30],
  rows: [
    { label: '블로그 후기 · 참여자 A', value: '23회' },
    { label: '인스타그램 · 참여자 B', value: '18회' },
    { label: '블로그 후기 · 참여자 C 외 1', value: '16회' },
  ],
};

const WHY = [
  {
    icon: <PinIcon size={20} />, tone: 'clay' as const, title: '가게 근처에 사는 엄마들',
    body: '실제로 다시 올 수 있는 동네 손님이 후기를 남겨요. 주변 엄마들 사이 입소문으로 이어지기 쉬워요.',
  },
  {
    icon: <ShieldCheckIcon size={20} />, tone: 'sage' as const, title: '운영자가 모든 후기를 검수',
    body: '공정위 지침에 맞는 대가 표시가 들어갔는지 확인한 뒤 완료 처리해요. 사장님이 따로 챙기지 않으셔도 돼요.',
  },
  {
    icon: <ChartIcon size={20} />, tone: 'clay' as const, title: '방문까지 숫자로 확인',
    body: '후기마다 따로 붙는 링크로, 어떤 후기가 손님을 더 데려왔는지 보여 드려요.',
  },
];

const STEPS = [
  { title: '문의', body: '가게와 알리고 싶은 메뉴를 알려 주세요.' },
  { title: '미션 설계', body: '제공 내용, 인원, 후기 채널을 함께 정하고 운영자가 대신 등록해 드려요.' },
  { title: '모집 · 선정', body: '동네 엄마들이 신청하면 운영자가 선정해요.' },
  { title: '체험 · 후기', body: '가게를 방문해 경험하고, 정해진 기간 안에 후기를 올려요.' },
  { title: '성과 리포트', body: '후기 모음과 방문 수를 사장님 화면에서 바로 확인해요.' },
];

const FAQ = [
  {
    q: '후기 내용을 미리 정할 수 있나요?',
    a: '꼭 들어가야 할 정보(메뉴명, 위치 등)는 안내할 수 있어요. 다만 평가는 참여자가 솔직하게 써요. 그래야 읽는 사람이 믿어요.',
  },
  {
    q: '참여자 연락처를 받을 수 있나요?',
    a: '참여자 개인정보는 사장님께 전달하지 않아요. 방문 일정 조율은 맘브릿지가 중간에서 도와드려요.',
  },
  {
    q: '직접 미션을 올릴 수도 있나요?',
    // 직접 등록이 열렸는지는 기능 잠금 한 곳(lib/features)에서 온다
    a: CLIENT_PAYMENT_ENABLED
      ? '네. 사장님 화면에서 직접 등록하실 수 있어요. 처음이라면 운영자가 함께 봐 드려요.'
      : '지금은 운영자가 대신 등록해 드려요. 사장님 직접 등록은 곧 열릴 예정이에요.',
  },
  {
    q: '후기가 기간 안에 안 올라오면요?',
    a: '운영자가 참여자에게 먼저 안내하고, 그래도 어려우면 다른 참여자로 채우는 방법을 함께 정해요.',
  },
];

export default function ForShopsPage() {
  return (
    <main className="min-h-screen bg-cream">
      <SiteHeader showSearch={false} />

      {/* 히어로 */}
      <section className={`${LANDING_WIDTH} pt-9`}>
        <LandingHeading as="h1" eyebrow="For shop owners">
          동네 엄마들의 진짜 후기,<br />가게 방문으로<br />이어졌는지 숫자로
        </LandingHeading>
        <p className="mt-4 break-keep text-[15px] leading-[1.7] text-ink-2">
          우리 가게 근처에 사는 엄마들이 직접 와서 경험하고, 솔직한 후기를 남겨요.
          후기를 보고 몇 명이 가게 페이지를 찾았는지 리포트로 보여 드려요.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <LandingCta href={INQUIRY}>미션 등록 문의</LandingCta>
          <LandingCta href="#report" tone="outline">리포트 예시 보기</LandingCta>
        </div>
      </section>

      {/* 문제 제기 */}
      <section className={`${LANDING_WIDTH} pt-11`}>
        <div className="rounded-box border border-line bg-paper px-5 py-6">
          <h2 className="font-serif text-[21px] font-bold leading-[1.45] tracking-[-0.02em] text-ink">
            후기는 올라왔는데,<br />손님이 늘었는지 모르셨죠?
          </h2>
          <MarkedList
            className="mt-4"
            icon={<XCircleIcon size={18} className="text-clay" />}
            items={PROBLEMS}
          />
        </div>
      </section>

      {/* 리포트 예시 */}
      <section id="report" className={`${LANDING_WIDTH} scroll-mt-4 pt-12`}>
        <LandingHeading eyebrow="Report">미션이 끝나면 이렇게 받아 보세요</LandingHeading>

        <div className="relative mt-[18px] rounded-box border border-line bg-paper px-5 py-[22px]">
          <span className="absolute right-4 top-4 flex h-6 items-center rounded-full bg-clay-tint px-2.5 text-[11px] font-bold text-clay-dark">
            예시
          </span>
          <p className="text-[13px] text-muted">{EXAMPLE_REPORT.caption}</p>

          <div className="mt-3.5 grid grid-cols-3 gap-2">
            {EXAMPLE_REPORT.stats.map(s => (
              <div key={s.label}>
                <p className="font-serif text-[26px] font-bold text-ink">{s.value}</p>
                <p className="mt-0.5 break-keep text-[11px] text-muted">{s.label}</p>
              </div>
            ))}
          </div>

          <div aria-hidden className="mt-[18px] flex h-16 items-end gap-1.5">
            {EXAMPLE_REPORT.bars.map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className={`flex-1 rounded-t ${h === 100 ? 'bg-clay' : 'bg-line'}`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted">
            <span>후기 등록 후 7일</span>
            <span>3일째 최다</span>
          </div>

          <div className="mt-[18px] border-t border-line-soft">
            {EXAMPLE_REPORT.rows.map((row, i) => (
              <div
                key={row.label}
                className={`flex justify-between gap-3 py-3 text-[13px] text-ink ${
                  i === EXAMPLE_REPORT.rows.length - 1 ? '' : 'border-b border-line-soft'
                }`}
              >
                <span className="min-w-0 break-keep">{row.label}</span>
                <span className="shrink-0 font-bold">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-2.5 break-keep text-xs leading-[1.6] text-muted">
          숫자는 예시예요. 방문 수는 후기 속 링크를 통해 가게 페이지를 연 횟수로 집계해요.
        </p>
      </section>

      {/* 맘브릿지가 다른 점 */}
      <section className={`${LANDING_WIDTH} pt-12`}>
        <LandingHeading eyebrow="Why MomBridge">맘브릿지가 다른 점</LandingHeading>
        <div className="mt-[18px] space-y-3">
          {WHY.map(({ icon, tone, title, body }) => (
            <FeatureCard key={title} icon={icon} tone={tone} title={title}>{body}</FeatureCard>
          ))}
        </div>
      </section>

      {/* 진행 단계 */}
      <section className={`${LANDING_WIDTH} pt-12`}>
        <LandingHeading eyebrow="How it works">이렇게 진행돼요</LandingHeading>
        <div className="mt-5">
          <Steps steps={STEPS} />
        </div>
      </section>

      {/* 비용 — 금액은 적지 않는다 */}
      <section className={`${LANDING_WIDTH} pt-11`}>
        <div className="rounded-box bg-ink px-[22px] py-[26px] text-paper">
          <span className="font-accent text-sm italic text-clay-tint">Pricing</span>
          <h2 className="mt-1 font-serif text-[22px] font-bold leading-[1.45]">
            비용은 가게 상황에 맞춰<br />안내해 드려요
          </h2>
          <p className="mt-3 break-keep text-sm leading-[1.7] text-[#CFC4B4]">
            모집 인원, 제공 메뉴, 후기 채널에 따라 달라져요. 문의 주시면 맞는 구성을 함께 정해 드려요.
          </p>
          <LandingCta href={INQUIRY} tone="paper" className="mt-[18px]">비용 문의하기</LandingCta>
        </div>
      </section>

      {/* 사회적 가치 */}
      <section className={`${LANDING_WIDTH} pt-4`}>
        <div className="rounded-box bg-sage-tint px-5 py-[22px]">
          <span className="font-accent text-sm italic text-sage">With the neighborhood</span>
          <h2 className="mt-1 font-serif text-[19px] font-bold leading-[1.5] text-ink">
            가게 홍보가 동네 엄마들의<br />일자리가 돼요
          </h2>
          <p className="mt-2.5 break-keep text-[13px] leading-[1.7] text-sage">
            맘브릿지는 한부모 가정을 포함한 동네 엄마들이 아이를 돌보면서도 할 수 있는 일을 만들어요.
            사장님의 미션 하나가 이웃의 생활을 돕습니다.
          </p>
        </div>
      </section>

      {/* 자주 묻는 질문 */}
      <section className={`${LANDING_WIDTH} pt-12`}>
        <LandingHeading eyebrow="FAQ">자주 묻는 질문</LandingHeading>
        <div className="mt-3.5">
          <Faq items={FAQ} />
        </div>
      </section>

      {/* 마무리 */}
      <section className={`${LANDING_WIDTH} pt-11`}>
        <div className="rounded-box bg-clay-tint px-[22px] py-7 text-center">
          <h2 className="font-serif text-[21px] font-bold leading-[1.45] text-ink">
            우리 가게도<br />동네 엄마들에게 소개해 볼까요?
          </h2>
          <LandingCta href={INQUIRY} className="mt-[18px]">미션 등록 문의</LandingCta>
          <p className="mt-2.5 text-xs text-clay-dark">보통 하루 안에 답변 드려요</p>
        </div>
      </section>

      <LandingFooter />
      <BottomTabBarSpacer />
      <BottomTabBar />
    </main>
  );
}
