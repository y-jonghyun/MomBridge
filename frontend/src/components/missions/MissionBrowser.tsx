'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '@/lib/api';
import ProvinceSelect from '@/components/common/ProvinceSelect';
import { CategoryTabs, Chip, EmptyState, MissionCard, type MissionCardData } from '@/components/ui';
import { PinIcon } from '@/components/ui/icons';
import MissionEmptyBox from './MissionEmptyBox';
import ShareWithShopsButton from './ShareWithShopsButton';
import { PROVINCES } from '@/lib/regions';
import { BUSINESS_CATEGORIES, MOM_TAGS } from '@/lib/mission-options';
import { useBookmarks } from '@/lib/bookmarks';
import { netReward } from '@/lib/fees';
import { useAuthStore } from '@/store/auth';
import { readMissionList, saveMissionList } from '@/lib/mission-list-cache';

/**
 * 미션 목록 화면. /missions와 참여자 홈의 '미션 탐색' 탭이 같은 이 컴포넌트를 쓴다.
 * 기준: docs/design/mombridge-design/cream-editorial-v1.md 3번 '미션 목록'
 */

export interface MissionListItem {
  id: string;
  title: string;
  description: string;
  category: string;
  rewardAmount: number;
  regionSi: string;
  regionGu: string;
  regionDong?: string | null;
  endDate: string;
  thumbnailUrl?: string | null;
  currentCount?: number | null;
  maxParticipants?: number | null;
  businessCategory?: string | null;
  momTags?: string[] | null;
  clientProfile?: { businessName?: string | null } | null;
}

export const CATEGORY_LABEL: Record<string, string> = {
  VISIT: '방문형', SNS: 'SNS', REVIEW: '리뷰', VIDEO: '영상',
};

/** 업종 탭 (맛집·카페·키즈…). 탭 줄은 이것 하나만 둔다 */
const BUSINESS_TABS = [
  { value: '', label: '전체 업종' },
  ...BUSINESS_CATEGORIES.map(([value, label]) => ({ value, label })),
];

export const BUSINESS_LABEL: Record<string, string> = Object.fromEntries(BUSINESS_CATEGORIES);
export const MOM_TAG_LABEL: Record<string, string> = Object.fromEntries(MOM_TAGS);

const SORTS = [
  { value: 'DEADLINE', label: '마감 임박순' },
  { value: 'NEWEST', label: '최신순' },
  { value: 'REWARD', label: '보상 높은순' },
];

/** 열린 미션이 하나도 없을 때의 문구. 홈도 같은 문구를 쓴다 */
export const EMPTY_MESSAGE = '우리 동네 미션을 준비하고 있어요.';

export interface MissionFilter {
  category: string; regionSi: string; sort: string; keyword: string;
  businessCategory: string; momTags: string[];
}
export const defaultMissionFilter: MissionFilter = {
  category: '', regionSi: '', sort: 'NEWEST', keyword: '', businessCategory: '', momTags: [],
};

/**
 * 필터 → 주소 검색어. 서버 요청과 화면 주소가 같은 규칙을 쓴다.
 * 화면 주소에는 기본 정렬(최신순)을 넣지 않는다 (forUrl).
 */
export function filterToQuery(f: MissionFilter, { forUrl = false } = {}): string {
  const params = new URLSearchParams();
  if (f.category) params.set('category', f.category);
  if (f.regionSi) params.set('regionSi', f.regionSi);
  if (f.sort && !(forUrl && f.sort === defaultMissionFilter.sort)) params.set('sort', f.sort);
  if (f.keyword) params.set('keyword', f.keyword);
  if (f.businessCategory) params.set('businessCategory', f.businessCategory);
  if (f.momTags.length) params.set('momTags', f.momTags.join(','));
  return params.toString();
}

/** 주소 검색어 → 필터. 주소를 복사해 다른 탭에서 열어도 같은 목록이 나오게 */
export function filterFromParams(params: { get: (k: string) => string | null }): MissionFilter {
  const sort = params.get('sort') ?? '';
  return {
    ...defaultMissionFilter,
    category: params.get('category') ?? '',
    businessCategory: params.get('businessCategory') ?? '',
    regionSi: params.get('regionSi') ?? '',
    keyword: params.get('keyword') ?? '',
    sort: SORTS.some(s => s.value === sort) ? sort : defaultMissionFilter.sort,
    momTags: (params.get('momTags') ?? '').split(',').map(t => t.trim()).filter(Boolean),
  };
}

/**
 * 브라우저가 뒤로 가기의 스크롤 위치를 되돌릴 때까지 기다린다.
 * 되돌리면 scroll 이벤트가 오고, 맨 위로 돌아온 경우처럼 이벤트가 없으면 잠시 뒤 넘어간다.
 */
function afterScrollRestore(maxWait = 450): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(timer); requestAnimationFrame(() => resolve()); };
    const onScroll = () => done();
    const timer = window.setTimeout(done, maxWait);
    window.addEventListener('scroll', onScroll, { once: true, passive: true });
  });
}

/** 같은 목록인지 (새로 받은 것이 기억한 것과 같으면 다시 그리지 않는다) */
const sameList = (a: MissionListItem[], b: MissionListItem[]) => JSON.stringify(a) === JSON.stringify(b);

/** 수수료를 뺀 실수령액 (서버 계산값이 생기면 그 값으로 바꾼다) */
const netOf = (reward: number) => netReward(Number(reward));

/**
 * 카드에 찍는 동네 이름 — "마포구 합정동". 동이 없으면 구만.
 * '성남시 분당구'처럼 시가 붙은 구는 끝의 구 이름만 쓴다 (카드 한 줄이 넘치지 않게).
 */
export function areaLabel(regionGu: string | null | undefined, regionDong: string | null | undefined): string {
  const gu = (regionGu ?? '').trim().split(/\s+/).pop() ?? '';
  return [gu, (regionDong ?? '').trim()].filter(Boolean).join(' ');
}

export function toCardData(m: MissionListItem): MissionCardData {
  const area = areaLabel(m.regionGu, m.regionDong);
  const dday = Math.ceil((new Date(m.endDate).getTime() - Date.now()) / 86400000);
  return {
    id: m.id,
    place: `[${area}] ${m.clientProfile?.businessName ?? m.title}`,
    offer: m.description,
    rewardAmount: Number(m.rewardAmount),
    netAmount: netOf(m.rewardAmount),
    categoryLabel: CATEGORY_LABEL[m.category] ?? m.category,
    dday,
    tags: (m.momTags ?? []).map(t => MOM_TAG_LABEL[t] ?? t),
    businessCategory: m.businessCategory,
    thumbnailUrl: m.thumbnailUrl,
    appliedCount: m.currentCount ?? null,
    maxParticipants: m.maxParticipants ?? null,
  };
}

export default function MissionBrowser({
  initialFilter = defaultMissionFilter,
  showSearch = true,
  syncUrl = false,
}: {
  initialFilter?: MissionFilter;
  showSearch?: boolean;
  /** 필터를 화면 주소(?regionSi=…)에 남긴다 — /missions에서만 켠다 */
  syncUrl?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState<MissionFilter>(initialFilter);
  const [searchInput, setSearchInput] = useState(initialFilter.keyword);
  // 기억해 둔 목록이 있으면 처음부터 그린다 — 뒤로 왔을 때 페이지가 원래 길이라 브라우저가 스크롤을 제자리로 돌린다
  const [missions, setMissions] = useState<MissionListItem[]>(
    () => readMissionList<MissionListItem>(filterToQuery(initialFilter))?.missions ?? [],
  );
  const [loading, setLoading] = useState(() => !readMissionList(filterToQuery(initialFilter)));
  const latest = useRef(0);
  // 기억한 목록으로 처음 그렸다면(뒤로 온 경우) 브라우저가 스크롤을 되돌릴 때까지 새 목록 반영을 잠시 미룬다 —
  // 되돌리기 전에 목록이 바뀌면 브라우저가 예전 위치로 되돌려 보던 카드가 밀린다
  const startedFromCache = useRef(missions.length > 0);
  const shown = useRef(missions);
  shown.current = missions;
  // 뒤에서 받은 목록으로 바꿀 때 사용자가 보던 카드가 밀리지 않게, 그 카드의 화면 위치를 적어 둔다
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const user = useAuthStore(s => s.user);
  const savedIds = useBookmarks(s => s.ids);
  const loadBookmarks = useBookmarks(s => s.load);
  const toggleBookmark = useBookmarks(s => s.toggle);
  const canSave = user?.role === 'PARTICIPANT';

  /**
   * 목록을 받는다. 같은 조건을 기억해 두었으면 그것을 먼저 그리고(뼈대 없이) 뒤에서 조용히 새로 받는다.
   * 빠르게 조건을 바꾸면 마지막 요청의 답만 쓴다.
   */
  const load = useCallback(async (f: MissionFilter) => {
    const query = filterToQuery(f);
    const id = ++latest.current;
    const cached = readMissionList<MissionListItem>(query);
    if (cached) {
      if (!sameList(shown.current, cached.missions)) setMissions(cached.missions);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const { data } = await api.get(`/missions?${query}`);
      if (id !== latest.current) return;
      const fresh: MissionListItem[] = data.data.missions;
      saveMissionList(query, fresh);
      if (sameList(shown.current, fresh)) return;
      if (startedFromCache.current) {
        startedFromCache.current = false;
        await afterScrollRestore();
        if (id !== latest.current) return;
      }
      // 화면 아래쪽을 보고 있었다면, 보이는 첫 카드의 위치를 적어 두고 바꾼 뒤 그 자리에 맞춘다
      if (typeof window !== 'undefined' && window.scrollY > 0) {
        const first = Array.from(document.querySelectorAll<HTMLElement>('[data-mission-id]'))
          .find(el => el.getBoundingClientRect().bottom > 0);
        anchor.current = first ? { id: first.dataset.missionId!, top: first.getBoundingClientRect().top } : null;
      }
      setMissions(fresh);
    } catch {
      // 못 받으면 기억한 목록(있으면)을 그대로 둔다
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, []);

  // 목록이 바뀐 직후, 그리기 전에 보던 카드를 원래 화면 위치로 되돌린다 (사라졌으면 그대로 둔다)
  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    if (!a) return;
    const el = document.querySelector<HTMLElement>(`[data-mission-id="${CSS.escape(a.id)}"]`);
    if (!el) return;
    const delta = el.getBoundingClientRect().top - a.top;
    if (Math.abs(delta) >= 1) window.scrollBy(0, delta);
  }, [missions]);

  useEffect(() => { void load(filter); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (canSave) void loadBookmarks(); }, [canSave, loadBookmarks]);

  const filtered = !!(filter.keyword || filter.category || filter.regionSi || filter.businessCategory || filter.momTags.length);
  // 검색어·유형·업종·태그 없이(지역만 골랐거나 아무것도 안 골랐는데) 0개 — 출시 첫날처럼 정말 열린 미션이 없는 것
  const nothingOpen = !(filter.keyword || filter.category || filter.businessCategory || filter.momTags.length);
  const regionShort = PROVINCES.find(p => p.name === filter.regionSi)?.short ?? filter.regionSi;

  const toggleMomTag = (value: string) => {
    const has = filter.momTags.includes(value);
    apply({ momTags: has ? filter.momTags.filter(t => t !== value) : [...filter.momTags, value] });
  };

  const apply = (next: Partial<MissionFilter>) => {
    const f = { ...filter, ...next };
    setFilter(f);
    void load(f);
    // 상세에 갔다 돌아와도, 주소를 복사해 다른 탭에서 열어도 같은 조건이 되게 주소에 남긴다 (기록은 쌓지 않는다)
    if (syncUrl) {
      const q = filterToQuery(f, { forUrl: true });
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
  };

  return (
    <div>
      {/* 칩 줄 — 지역 + 유형 + 엄마 시간 태그.
          탭 줄을 둘로 쌓지 않으려고 유형(방문형·SNS·리뷰·영상)도 이 줄에 둔다.
          유형은 하나만, 엄마 시간 태그는 여러 개 고를 수 있다 */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1">
        {/* 지역 칩. Chip은 button이라 select를 품을 수 없어 같은 모양의 label로 만든다.
            다른 칩과 같이 보이는 알약은 36px, 누를 수 있는 영역은 44px로 둔다 */}
        <label className="-my-1 flex min-h-[44px] shrink-0 items-center">
          <span
            className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] ${
              filter.regionSi ? 'bg-ink font-medium text-paper' : 'border border-line bg-paper text-ink-2'
            }`}
          >
            <PinIcon size={13} strokeWidth={2} />
            <span className="sr-only">지역</span>
            <ProvinceSelect
              value={filter.regionSi}
              emptyLabel="전체 지역"
              onChange={v => apply({ regionSi: v })}
              className="h-9 cursor-pointer appearance-none bg-transparent text-[13px] text-inherit outline-none"
            />
          </span>
        </label>
        {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
          <Chip
            key={value} selected={filter.category === value}
            // 같은 유형을 다시 누르면 해제된다
            onClick={() => apply({ category: filter.category === value ? '' : value })}
          >
            {label}
          </Chip>
        ))}
        {MOM_TAGS.map(([value, label]) => (
          <Chip key={value} selected={filter.momTags.includes(value)} onClick={() => toggleMomTag(value)}>
            {label}
          </Chip>
        ))}
      </div>

      <div className="mt-2.5">
        <CategoryTabs
          tabs={BUSINESS_TABS}
          value={filter.businessCategory}
          onChange={v => apply({ businessCategory: v })}
          ariaLabel="업종"
        />
      </div>

      {showSearch && (
        <form
          onSubmit={e => { e.preventDefault(); apply({ keyword: searchInput }); }}
          className="mt-3.5 flex h-[52px] items-center gap-2.5 rounded-control-lg border border-line bg-paper px-4 mx-5"
        >
          <label htmlFor="mission-q" className="sr-only">미션 검색</label>
          <input
            id="mission-q" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="가게 이름, 동네로 찾기"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
          />
          {/* 입력칸 안의 버튼이라 세로 패딩으로만 누를 영역을 넓힌다 (줄 높이는 그대로) */}
          <button type="submit" className="shrink-0 py-3.5 text-[13px] font-medium text-clay">검색</button>
        </form>
      )}

      <div className="flex items-center justify-between px-5 pb-1.5 pt-3.5">
        <span className="text-[13px] text-muted">
          {filter.regionSi ? '우리 동네 미션' : '전체 미션'} <b className="text-ink">{missions.length}</b>개
        </span>
        <label className="flex items-center gap-1 text-[13px] text-ink-2">
          <span className="sr-only">정렬</span>
          {/* 테두리가 없는 칸이라 높이를 44px로 키워도 보이는 모습은 그대로다 */}
          <select
            value={filter.sort} onChange={e => apply({ sort: e.target.value })}
            className="-my-1 min-h-[44px] bg-transparent text-[13px] text-ink-2 outline-none"
          >
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-[22px] px-5 pt-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square w-full rounded-photo bg-line-soft" />
              <div className="mt-2.5 h-3.5 w-3/4 rounded bg-line-soft" />
              <div className="mt-2 h-3 w-1/2 rounded bg-line-soft" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {missions.length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-[22px] px-5 pt-2 sm:grid-cols-3 lg:grid-cols-4">
              {missions.map(m => (
                <div key={m.id} data-mission-id={m.id} className="min-w-0">
                  <MissionCard
                    mission={toCardData(m)}
                    saved={savedIds.has(m.id)}
                    onToggleSave={canSave ? () => void toggleBookmark(m.id) : undefined}
                  />
                </div>
              ))}
            </div>
          )}

          {/* 열린 미션이 하나도 없을 때 — 가게에 알리는 것이 가장 쓸모 있는 행동이다 */}
          {missions.length === 0 && nothingOpen ? (
            <div className="mx-5 mt-4">
              <EmptyState
                title={filter.regionSi ? <>아직 {regionShort}에{' '}<br />열린 미션이 없어요</> : <>아직 열린 미션이 없어요</>}
                body="자주 가는 가게 사장님께 맘브릿지를 알려 주시면 우리 동네 미션이 더 빨리 열려요."
              >
                <ShareWithShopsButton />
                {filter.regionSi && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(''); apply({ regionSi: '' }); }}
                    className="flex min-h-[44px] w-full items-center justify-center text-[13px] text-ink-2 underline underline-offset-2"
                  >
                    다른 지역 미션 보기
                  </button>
                )}
              </EmptyState>
            </div>
          ) : (
          /* 목록 끝 / 빈 목록 — 둘 다 같은 점선 상자로 이웃 지역을 권한다 */
          <div className="mx-5 mt-[26px]">
            <MissionEmptyBox
              message={
                missions.length === 0
                  ? (filtered ? '조건에 맞는 미션이 없어요.' : EMPTY_MESSAGE)
                  : filter.regionSi ? '우리 동네 미션을 다 봤어요.' : '미션을 모두 봤어요.'
              }
              actionLabel={filtered ? '이웃 동네 미션 보기' : undefined}
              onAction={() => {
                setSearchInput('');
                apply({ regionSi: '', category: '', keyword: '', businessCategory: '', momTags: [] });
              }}
            />
          </div>
          )}
        </>
      )}
    </div>
  );
}
