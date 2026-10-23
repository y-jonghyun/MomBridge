'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import ProvinceSelect from '@/components/common/ProvinceSelect';
import { CategoryTabs, MissionCard, type MissionCardData } from '@/components/ui';
import { PinIcon } from '@/components/ui/icons';

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
  clientProfile?: { businessName?: string | null } | null;
}

export const CATEGORY_LABEL: Record<string, string> = {
  VISIT: '방문형', SNS: 'SNS', REVIEW: '리뷰', VIDEO: '영상',
};

/** 업종 탭(맛집·카페…)은 데이터가 없어 유형 탭으로 대신한다 (문서 4번) */
const CATEGORY_TABS = [
  { value: '', label: '전체' },
  ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
];

const SORTS = [
  { value: 'DEADLINE', label: '마감 임박순' },
  { value: 'NEWEST', label: '최신순' },
  { value: 'REWARD', label: '보상 높은순' },
];

export interface MissionFilter { category: string; regionSi: string; sort: string; keyword: string }
export const defaultMissionFilter: MissionFilter = { category: '', regionSi: '', sort: 'NEWEST', keyword: '' };

/** 수수료 10%를 뺀 실수령액 (서버 계산값이 생기면 그 값으로 바꾼다) */
const netOf = (reward: number) => Math.floor(Number(reward) * 0.9);

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
    // 엄마 시간 태그는 아직 데이터가 없어 숨긴다 (문서 4번)
    tags: [],
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

  const load = useCallback(async (f: MissionFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.category) params.set('category', f.category);
      if (f.regionSi) params.set('regionSi', f.regionSi);
      if (f.sort) params.set('sort', f.sort);
      if (f.keyword) params.set('keyword', f.keyword);
      const { data } = await api.get(`/missions?${params.toString()}`);
      setMissions(data.data.missions);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(filter); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const apply = (next: Partial<MissionFilter>) => {
    const f = { ...filter, ...next };
    setFilter(f);
    void load(f);
  };

  return (
    <div>
      {/* 칩 줄 — 엄마 시간 칩(평일 낮·아이 동반·재택)은 데이터가 없어 숨긴다 */}
      <div className="flex gap-2 overflow-x-auto px-5 pb-1">
        {/* 지역 칩. Chip은 button이라 select를 품을 수 없어 같은 모양의 label로 만든다 */}
        <label
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] ${
            filter.regionSi ? 'bg-ink font-medium text-paper' : 'border border-line bg-paper text-ink-2'
          }`}
        >
          <PinIcon size={13} strokeWidth={2} />
          <span className="sr-only">지역</span>
          <ProvinceSelect
            value={filter.regionSi}
            emptyLabel="전체 지역"
            onChange={v => apply({ regionSi: v })}
            className="cursor-pointer appearance-none bg-transparent text-[13px] text-inherit outline-none"
          />
        </label>
      </div>

      <div className="mt-2.5">
        <CategoryTabs
          tabs={CATEGORY_TABS}
          value={filter.category}
          onChange={v => apply({ category: v })}
          ariaLabel="미션 유형"
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
          <button type="submit" className="shrink-0 text-[13px] font-medium text-clay">검색</button>
        </form>
      )}

      <div className="flex items-center justify-between px-5 pb-1.5 pt-3.5">
        <span className="text-[13px] text-muted">
          {filter.regionSi ? '우리 동네 미션' : '전체 미션'} <b className="text-ink">{missions.length}</b>개
        </span>
        <label className="flex items-center gap-1 text-[13px] text-ink-2">
          <span className="sr-only">정렬</span>
          <select
            value={filter.sort} onChange={e => apply({ sort: e.target.value })}
            className="h-9 bg-transparent text-[13px] text-ink-2 outline-none"
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
              {missions.map(m => <MissionCard key={m.id} mission={toCardData(m)} />)}
            </div>
          )}

          {/* 목록 끝 / 빈 목록 — 둘 다 같은 점선 상자로 이웃 지역을 권한다 */}
          <div className="mx-5 mt-[26px] rounded-photo border border-dashed border-[#D8CBB8] bg-paper p-4 text-[13px] leading-[1.6] text-ink-2">
            {missions.length === 0
              ? (filter.keyword || filter.category || filter.regionSi
                ? '조건에 맞는 미션이 없어요.'
                : '아직 열린 미션이 없어요.')
              : filter.regionSi
                ? '우리 동네 미션을 다 봤어요.'
                : '미션을 모두 봤어요.'}
            {(filter.regionSi || filter.category || filter.keyword) && (
              <button
                type="button"
                onClick={() => { setSearchInput(''); apply({ regionSi: '', category: '', keyword: '' }); }}
                className="ml-1 font-medium text-clay underline-offset-2 hover:underline"
              >
                이웃 동네 미션 보기
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
