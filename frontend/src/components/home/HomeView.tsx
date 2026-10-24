'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { BottomTabBar, BottomTabBarSpacer, MissionCard, SectionHeader, SiteHeader } from '@/components/ui';
import { ArrowRightIcon, ChevronDownIcon, PinIcon, SearchIcon } from '@/components/ui/icons';
import { CATEGORY_LABEL, EMPTY_MESSAGE, toCardData, type MissionListItem } from '@/components/missions/MissionBrowser';
import MissionEmptyBox from '@/components/missions/MissionEmptyBox';
import { PAYOUT_DELAY_HINT, fetchNextPayoutDate, payoutLabel } from '@/lib/payout';
import { useBookmarks } from '@/lib/bookmarks';
import SiteFooter from '@/components/legal/SiteFooter';
import HomeLanding from './HomeLanding';

/** 기준: docs/design/mombridge-design/cream-editorial-v1.md 3번 '홈' + Main.html */

const TYPE_TABS = [{ value: '', label: '전체' }, ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))];

/** 모집 대비 신청이 적은 순 — '선정이 쉬운 미션' 자리를 채운다 (문서 4번) */
const fillRate = (m: MissionListItem) => (m.currentCount ?? 0) / Math.max(1, m.maxParticipants ?? 1);

export default function HomeView() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const [ready, setReady] = useState(false);
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [payoutDay, setPayoutDay] = useState<string | null>(null);
  const savedIds = useBookmarks(s => s.ids);
  const loadBookmarks = useBookmarks(s => s.load);
  const toggleBookmark = useBookmarks(s => s.toggle);

  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (ready && user?.role === 'PARTICIPANT') {
      void loadBookmarks();
      void fetchNextPayoutDate().then(d => setPayoutDay(d ? payoutLabel(d) : null));
    }
  }, [ready, user, loadBookmarks]);
  useEffect(() => {
    // 공개 API라 로그인하지 않아도 미션이 보인다.
    // 처음 온 사람에게는 최신 미션을, 로그인한 사람에게는 마감이 가까운 미션을 먼저 보여 준다.
    if (!ready) return;
    api.get(`/missions?sort=${user ? 'DEADLINE' : 'NEWEST'}`)
      .then(({ data }) => setMissions(data.data.missions))
      .catch(() => setMissions([]))
      .finally(() => setLoaded(true));
  }, [ready, user]);

  const signedIn = ready && !!user;
  const isParticipant = signedIn && user!.role === 'PARTICIPANT';
  // 로그인 전에는 소개 화면이 사장님 띠를 따로 갖고 있다 (HomeLanding)
  const showOwnerStrip = signedIn && user!.role === 'CLIENT';

  // 엄마 시간 태그가 들어오면서 '등원 후' 자리를 실제 기준(평일 낮)으로 채운다.
  // 평일 낮 미션이 하나도 없으면 전과 같이 마감이 가까운 미션을 보여준다.
  const dropOff = missions.filter(m => (m.momTags ?? []).includes('WEEKDAY_DAY')).slice(0, 6);
  const rail = dropOff.length > 0 ? dropOff : missions.slice(0, 6);
  const railTitle = dropOff.length > 0 ? '등원 후 다녀오기 좋은' : '마감이 가까운 미션';
  const easy = [...missions].sort((a, b) => fillRate(a) - fillRate(b)).slice(0, 3);

  // 로그인 전(그리고 persist 복원 전)에는 소개 화면을 보여 준다 — SiteHeader와 같은 방식
  if (!signedIn) {
    return (
      <main className="min-h-screen bg-cream">
        <SiteHeader showSearch={false} />
        <HomeLanding missions={missions} />
        <BottomTabBarSpacer />
        <BottomTabBar />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <SiteHeader />

      <div className="mx-auto max-w-shell">
        <section className="px-5 pb-7 pt-3">
          {/* 활동 지역을 읽어올 API가 아직 없어 지역 고르기 화면으로 보낸다 */}
          <Link
            href="/missions"
            className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 text-[13px] text-ink-2"
          >
            <PinIcon size={14} strokeWidth={1.8} className="text-clay" />
            지역 선택
            <ChevronDownIcon size={12} strokeWidth={2} />
          </Link>

          <h1 className="mb-2.5 mt-[22px] font-serif text-hero font-bold">
            아이 등원 후,<br />우리 동네에서<br />가볍게 버는 시간
          </h1>
          <p className="text-sm leading-[1.65] text-muted">동네 가게의 미션을 하고, 후기로 보상을 받아요.</p>
          <Link
            href="/about"
            className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-[13px] font-medium text-clay"
          >
            맘브릿지 알아보기
            <ArrowRightIcon size={13} strokeWidth={1.8} />
          </Link>

          <form
            onSubmit={e => { e.preventDefault(); router.push(`/missions${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`); }}
            className="mt-5 flex h-[52px] items-center gap-2.5 rounded-control-lg border border-line bg-paper px-4"
          >
            <label htmlFor="home-q" className="sr-only">미션 검색</label>
            <SearchIcon size={18} strokeWidth={1.6} className="shrink-0 text-muted" />
            <input
              id="home-q" value={keyword} onChange={e => setKeyword(e.target.value)}
              placeholder="가게 이름, 동네로 찾기"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </form>
        </section>

        <nav aria-label="미션 유형" className="no-scrollbar flex gap-[22px] overflow-x-auto border-b border-line px-5">
          {TYPE_TABS.map((t, i) => (
            <Link
              key={t.label}
              href={t.value ? `/missions?category=${t.value}` : '/missions'}
              className={`-mb-px shrink-0 whitespace-nowrap py-3 text-sm ${i === 0 ? 'border-b-2 border-ink font-bold text-ink' : 'text-muted'}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {/* 공개된 미션이 하나도 없으면 탭 아래가 비어 보이지 않게 /missions와 같은 안내를 둔다.
            기다리는 동안 볼 것이 있도록 소개 카드를 함께 보여 준다. */}
        {loaded && missions.length === 0 && (
          <div className="mx-5 mt-[26px] space-y-3">
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

        {/* 평일 낮에 다녀올 수 있는 미션 (엄마 시간 태그 기준) */}
        {rail.length > 0 && (
          <section className="pb-2 pt-[30px]">
            <div className="px-5 pb-3.5">
              <SectionHeader
                eyebrow="After drop-off" title={railTitle}
                moreHref={dropOff.length > 0 ? '/missions?momTags=WEEKDAY_DAY' : '/missions'}
              />
            </div>
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
              {rail.map(m => (
                <MissionCard
                  key={m.id} mission={toCardData(m)} variant="rail"
                  saved={savedIds.has(m.id)}
                  onToggleSave={isParticipant ? () => void toggleBookmark(m.id) : undefined}
                />
              ))}
            </div>
          </section>
        )}

        {easy.length > 0 && (
          <section className="mx-5 mt-[30px] rounded-box border border-line bg-paper px-5 py-[22px]">
            <span className="font-accent text-sm italic text-clay">First mission</span>
            <h2 className="mb-1.5 mt-0.5 font-serif text-section font-bold">처음이라면, 신청이 적은 미션부터</h2>
            <p className="mb-3.5 text-[13px] leading-[1.6] text-muted">모집 인원 대비 신청이 적은 미션을 모았어요.</p>
            {easy.map(m => <MissionCard key={m.id} mission={toCardData(m)} variant="row" />)}
          </section>
        )}

        {isParticipant && (
          <section className="mx-5 mt-4 flex items-center justify-between gap-4 rounded-box bg-ink p-5 text-paper">
            <div className="min-w-0">
              <p className="text-xs text-[#CFC4B4]">내 다음 정산일</p>
              <p className="mt-1 font-serif text-section font-bold">
                {payoutDay ? `${payoutDay} 지급 예정` : '—'}
              </p>
              {payoutDay && (
                <p className="mt-1 break-keep text-[11px] leading-[1.5] text-[#CFC4B4]">{PAYOUT_DELAY_HINT}</p>
              )}
            </div>
            <Link href="/participant" className="flex h-11 shrink-0 items-center rounded-control bg-paper px-4 text-[13px] font-medium text-ink">
              내 활동 보기
            </Link>
          </section>
        )}

        {showOwnerStrip && (
          <section className="mx-5 mt-9 border-y border-line px-[22px] py-[26px]">
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
