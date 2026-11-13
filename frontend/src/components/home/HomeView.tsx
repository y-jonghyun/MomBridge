'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { AppBar, BottomTabBar, BottomTabBarSpacer, EmptyState, MissionCard, SiteHeader } from '@/components/ui';
import { ArrowRightIcon } from '@/components/ui/icons';
import { EMPTY_MESSAGE, toCardData, type MissionListItem } from '@/components/missions/MissionBrowser';
import MissionEmptyBox from '@/components/missions/MissionEmptyBox';
import { fetchNextPayoutDate, payoutLabel } from '@/lib/payout';
import { pickNextStep, type NextStep } from '@/lib/next-step';
import SiteFooter from '@/components/legal/SiteFooter';
import HomeLanding from './HomeLanding';
import NextStepCard from './NextStepCard';
import NewMissionAlertToggle from './NewMissionAlertToggle';
import HowItWorks from './HowItWorks';
import NotificationBell from '@/components/notifications/NotificationBell';

/**
 * 루트(/) — 보는 사람에 따라 다르다.
 * - 로그인 전: 소개 화면 (HomeLanding, 첫 방문용)
 * - 로그인 후: app-feel 1단계 시안 — 인사 + '내 미션 다음 단계' 카드 + 우리 구의 새 미션
 *   참여자는 앱 막대에 알림 종, 새 미션 아래에 '새 미션 알림 받기'(활동 지역이 있을 때)
 */

const NEW_COUNT = 5;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
/** "11월 13일 금요일" */
const todayLabel = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;

interface Region { si: string; gu: string }

export default function HomeView() {
  const user = useAuthStore(s => s.user);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const signedIn = ready && !!user;
  const isParticipant = signedIn && user!.role === 'PARTICIPANT';

  // 로그인 전 소개 화면의 미리보기 (공개 API)
  const [landingMissions, setLandingMissions] = useState<MissionListItem[]>([]);
  useEffect(() => {
    if (!ready || user) return;
    api.get('/missions?sort=NEWEST')
      .then(({ data }) => setLandingMissions(data.data.missions))
      .catch(() => setLandingMissions([]));
  }, [ready, user]);

  // ── 로그인 후 ──
  // 참여자의 활동 지역 (프로필에 없으면 null — 전체 지역의 새 미션을 보여 준다)
  const [region, setRegion] = useState<Region | null>(null);
  const [regionLoaded, setRegionLoaded] = useState(false);
  const [nextStep, setNextStep] = useState<NextStep | null>(null);
  // 새 미션 알림 받기 (프로필 값). 불러오기 전에는 null — 카드를 깜빡이지 않게 그리지 않는다
  const [alertsOn, setAlertsOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    if (!isParticipant) { setRegionLoaded(true); return; }
    let alive = true;
    api.get('/participant/profile')
      .then(({ data }) => {
        const p = data.data;
        if (alive && p?.regionSi?.trim() && p?.regionGu?.trim()) setRegion({ si: p.regionSi, gu: p.regionGu });
        if (alive) setAlertsOn(!!p?.newMissionAlerts);
      })
      .catch(() => { /* 지역 없이 전체 새 미션을 보여 준다 */ })
      .finally(() => { if (alive) setRegionLoaded(true); });
    // 다음 단계 카드는 내 활동과 같은 세 목록으로 만든다. 못 받아오면 카드만 빼고 나머지는 그대로 보여 준다.
    Promise.all([
      api.get('/participant/applications'),
      api.get('/submissions/my'),
      api.get('/participant/payouts'),
      fetchNextPayoutDate(),
    ])
      .then(([appR, subR, payR, payDate]) => {
        if (!alive) return;
        setNextStep(pickNextStep({
          applications: appR.data.data, submissions: subR.data.data, payouts: payR.data.data,
          payoutDay: payDate ? payoutLabel(payDate) : null,
        }));
      })
      .catch(() => { if (alive) setNextStep(null); });
    return () => { alive = false; };
  }, [signedIn, isParticipant]);

  // 새 미션: 우리 구 → 하나도 없으면 전체 지역
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [regionEmpty, setRegionEmpty] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!signedIn || !regionLoaded) return;
    let alive = true;
    (async () => {
      try {
        if (region) {
          const q = new URLSearchParams({ sort: 'NEWEST', regionSi: region.si, regionGu: region.gu });
          const { data } = await api.get(`/missions?${q}`);
          if (!alive) return;
          if (data.data.missions.length > 0) { setMissions(data.data.missions); setRegionEmpty(false); return; }
          setRegionEmpty(true);
        }
        const { data } = await api.get('/missions?sort=NEWEST');
        if (alive) setMissions(data.data.missions);
      } catch {
        if (alive) setMissions([]);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [signedIn, regionLoaded, region]);

  // 로그인 전(그리고 persist 복원 전)에는 소개 화면을 보여 준다 — SiteHeader와 같은 방식
  if (!signedIn) {
    return (
      <main className="min-h-screen bg-cream">
        <SiteHeader showSearch={false} />
        <HomeLanding missions={landingMissions} />
        <BottomTabBarSpacer />
        <BottomTabBar />
      </main>
    );
  }

  // 가게 띠는 가게 계정에만
  const showOwnerStrip = user!.role === 'CLIENT';
  const inRegion = !!region && !regionEmpty;
  const listTitle = inRegion ? `${region!.gu} 새 미션` : '새 미션';
  const shown = missions.slice(0, NEW_COUNT);
  // 참여자에게 열린 미션이 하나도 없다 — 출시 첫날 화면 (알림 받기·지역 정하기가 카드 안으로 들어간다)
  const launchEmpty = loaded && isParticipant && shown.length === 0;

  return (
    <main className="min-h-screen bg-cream">
      <AppBar
        title={`${user!.name}님, 안녕하세요`}
        eyebrow={[todayLabel(new Date()), region?.gu].filter(Boolean).join(' · ')}
        actions={isParticipant ? <NotificationBell /> : undefined}
      />

      <div className="mx-auto max-w-shell px-5">
        {/* 데스크톱에서는 카드가 너무 넓어지지 않게 왼쪽 칸에, 새 미션은 오른쪽 칸에 둔다 */}
        <div className={nextStep ? 'lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-10' : ''}>
          {nextStep && (
            <div className="mt-4">
              <NextStepCard step={nextStep} />
            </div>
          )}

          <section aria-labelledby="home-new" className={nextStep ? 'mt-7 lg:mt-2' : 'mt-7'}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="home-new" className="font-serif text-section-sm font-bold">{listTitle}</h2>
              <Link
                href={region ? `/missions?regionSi=${encodeURIComponent(region.si)}` : '/missions'}
                className="flex min-h-[44px] items-center text-[13px] text-muted"
              >
                전체 보기
              </Link>
            </div>

            {/* 우리 구에 열린 미션이 없을 때 / 활동 지역을 아직 정하지 않았을 때 한 줄 안내 */}
            {loaded && region && regionEmpty && missions.length > 0 && (
              <p className="mb-1 break-keep text-[13px] leading-[1.6] text-muted">
                {region.gu}에는 아직 열린 미션이 없어 다른 지역의 새 미션을 보여 드려요.
              </p>
            )}
            {loaded && isParticipant && !region && !launchEmpty && (
              <Link
                href="/participant?tab=profile"
                className="mb-1 flex min-h-[44px] items-center gap-1 break-keep text-[13px] text-clay"
              >
                활동 지역을 정하면 우리 구 미션을 먼저 보여 드려요
                <ArrowRightIcon size={13} strokeWidth={1.8} />
              </Link>
            )}

            {!loaded ? (
              <div aria-hidden="true" className="space-y-3 pt-2">
                {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-control bg-line-soft" />)}
              </div>
            ) : shown.length > 0 ? (
              <div className="[&>a:first-child]:border-t-0">
                {shown.map(m => <MissionCard key={m.id} mission={toCardData(m)} variant="row" />)}
              </div>
            ) : launchEmpty ? (
              <div className="mt-2">
                <EmptyState
                  title={<>{region ? `${region.gu}의` : '우리 동네'} 첫 미션을{' '}<br />준비하고 있어요</>}
                  body="가게가 미션을 열면 이 자리에 바로 보여요."
                >
                  {region ? (
                    alertsOn !== null && <NewMissionAlertToggle bare gu={region.gu} on={alertsOn} onChange={setAlertsOn} />
                  ) : (
                    <Link
                      href="/participant?tab=profile"
                      className="flex h-12 w-full items-center justify-center rounded-control bg-clay text-[15px] font-bold text-paper"
                    >
                      활동 지역 정하기
                    </Link>
                  )}
                </EmptyState>
                <HowItWorks className="mt-7" />
              </div>
            ) : (
              // 공개된 미션이 하나도 없으면 /missions와 같은 안내와 소개 카드 (출시 첫날 화면은 PR 8에서 다듬는다)
              <div className="mt-2 space-y-3">
                <MissionEmptyBox message={EMPTY_MESSAGE} actionLabel="다른 지역 미션 보기" actionHref="/missions" />
                <Link
                  href="/about"
                  className="flex min-h-[44px] items-center justify-between gap-3 rounded-box border border-line bg-paper px-5 py-4"
                >
                  <span className="min-w-0">
                    <span className="block font-serif text-section font-bold text-ink">맘브릿지 알아보기</span>
                    <span className="mt-1 block break-keep text-[13px] leading-[1.6] text-muted">
                      어떻게 신청하고 언제 보상을 받는지 한눈에 볼 수 있어요.
                    </span>
                  </span>
                  <ArrowRightIcon size={16} strokeWidth={1.8} className="shrink-0 text-muted" />
                </Link>
              </div>
            )}

            {/* 새 미션 알림 받기 — 활동 지역이 있는 참여자만 (어느 구를 알릴지 알아야 하므로) */}
            {loaded && isParticipant && region && alertsOn !== null && !launchEmpty && (
              <NewMissionAlertToggle gu={region.gu} on={alertsOn} onChange={setAlertsOn} className="mt-4" />
            )}
          </section>
        </div>

        {showOwnerStrip && (
          <section className="mt-9 border-y border-line px-[22px] py-[26px]">
            <span className="font-accent text-sm italic text-clay">For shop owners</span>
            <h2 className="mb-2 mt-1 font-serif text-section font-bold leading-[1.4]">
              동네 엄마들의 진짜 후기,<br />방문으로 이어졌는지 숫자로
            </h2>
            <p className="mb-4 text-[13px] leading-[1.65] text-muted">후기 글을 보고 가게를 찾은 방문 수를 리포트로 보여드려요.</p>
            <Link
              href="/client"
              className="inline-flex h-11 items-center gap-1.5 rounded-control border border-ink px-[18px] text-sm font-medium text-ink"
            >
              내 가게 미션 보기
              <ArrowRightIcon size={14} strokeWidth={1.8} />
            </Link>
          </section>
        )}
      </div>

      <SiteFooter className="mt-7" />

      <BottomTabBarSpacer />
      <BottomTabBar />
    </main>
  );
}
