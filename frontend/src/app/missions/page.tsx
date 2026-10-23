'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MissionBrowser, { defaultMissionFilter } from '@/components/missions/MissionBrowser';
import { BottomTabBar, BottomTabBarSpacer, SiteHeader } from '@/components/ui';

/** 홈에서 넘어온 조건(유형·업종·태그·검색어)을 그대로 이어받는다 */
function MissionsBody() {
  const params = useSearchParams();
  const momTags = (params.get('momTags') ?? '').split(',').map(t => t.trim()).filter(Boolean);

  return (
    <MissionBrowser
      initialFilter={{
        ...defaultMissionFilter,
        category: params.get('category') ?? '',
        businessCategory: params.get('businessCategory') ?? '',
        regionSi: params.get('regionSi') ?? '',
        keyword: params.get('keyword') ?? '',
        momTags,
      }}
    />
  );
}

export default function MissionsPage() {
  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <div className="mx-auto max-w-shell pb-8">
        <h1 className="px-5 pb-2 font-serif text-title font-bold text-ink">미션 탐색</h1>
        <Suspense fallback={<div className="px-5 py-10 text-sm text-muted">불러오는 중…</div>}>
          <MissionsBody />
        </Suspense>
      </div>
      <BottomTabBarSpacer />
      <BottomTabBar />
    </div>
  );
}
