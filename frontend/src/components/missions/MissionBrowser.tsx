'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import ProvinceSelect from '@/components/common/ProvinceSelect';
import { CategoryTabs, Chip, MissionCard, type MissionCardData } from '@/components/ui';
import { PinIcon } from '@/components/ui/icons';
import MissionEmptyBox from './MissionEmptyBox';
import { BUSINESS_CATEGORIES, MOM_TAGS } from '@/lib/mission-options';
import { useBookmarks } from '@/lib/bookmarks';
import { netReward } from '@/lib/fees';
import { useAuthStore } from '@/store/auth';

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

/** 수수료를 뺀 실수령액 (서버 계산값이 생기면 그 값으로 바꾼다) */
const netOf = (reward: number) => netReward(Number(reward));

export function toCardData(m: MissionListItem): MissionCardData {
  const area = m.regionDong || m.regionGu;
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
}: {
  initialFilter?: MissionFilter;
  showSearch?: boolean;
}) {
  const [filter, setFilter] = useState<MissionFilter>(initialFilter);
  const [searchInput, setSearchInput] = useState(initialFilter.keyword);
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore(s => s.user);
  const savedIds = useBookmarks(s => s.ids);
  const loadBookmarks = useBookmarks(s => s.load);
  const toggleBookmark = useBookmarks(s => s.toggle);
  const canSave = user?.role === 'PARTICIPANT';

  const load = useCallback(async (f: MissionFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.category) params.set('category', f.category);
      if (f.regionSi) params.set('regionSi', f.regionSi);
      if (f.sort) params.set('sort', f.sort);
      if (f.keyword) params.set('keyword', f.keyword);
      if (f.businessCategory) params.set('businessCategory', f.businessCategory);
      if (f.momTags.length) params.set('momTags', f.momTags.join(','));
      const { data } = await api.get(`/missions?${params.toString()}`);
      setMissions(data.data.missions);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(filter); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (canSave) void loadBookmarks(); }, [canSave, loadBookmarks]);

  const filtered = !!(filter.keyword || filter.category || filter.regionSi || filter.businessCategory || filter.momTags.length);

  const toggleMomTag = (value: string) => {
    const has = filter.momTags.includes(value);
    apply({ momTags: has ? filter.momTags.filter(t => t !== value) : [...filter.momTags, value] });
  };

  const apply = (next: Partial<MissionFilter>) => {
    const f = { ...filter, ...next };
    setFilter(f);
    void load(f);
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
                <MissionCard
                  key={m.id} mission={toCardData(m)}
                  saved={savedIds.has(m.id)}
                  onToggleSave={canSave ? () => void toggleBookmark(m.id) : undefined}
                />
              ))}
            </div>
          )}

          {/* 목록 끝 / 빈 목록 — 둘 다 같은 점선 상자로 이웃 지역을 권한다 */}
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
        </>
      )}
    </div>
  );
}
