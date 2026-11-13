'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MissionBrowser, { filterFromParams } from '@/components/missions/MissionBrowser';
import { AppBar, BottomTabBar, BottomTabBarSpacer } from '@/components/ui';

/**
 * 조건(지역·업종·유형·정렬·검색어·태그)은 화면 주소에 있다 — 홈에서 넘어온 조건도,
 * 이 화면에서 바꾼 조건도(MissionBrowser가 주소에 남긴다). 그래서 상세에 갔다 돌아오거나
 * 주소를 복사해 다른 탭에서 열어도 같은 목록이 나온다.
 */
function MissionsBody() {
  const params = useSearchParams();
  return <MissionBrowser initialFilter={filterFromParams(params)} syncUrl />;
}

export default function MissionsPage() {
  return (
    <div className="min-h-screen bg-cream">
      <AppBar title="미션" />
      <div className="mx-auto max-w-shell pb-8">
        <Suspense fallback={<div className="px-5 py-10 text-sm text-muted">불러오는 중…</div>}>
          <MissionsBody />
        </Suspense>
      </div>
      <BottomTabBarSpacer />
      <BottomTabBar />
    </div>
  );
}
