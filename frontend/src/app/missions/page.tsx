'use client';
import MissionBrowser from '@/components/missions/MissionBrowser';
import { BottomTabBar, BottomTabBarSpacer, SiteHeader } from '@/components/ui';

export default function MissionsPage() {
  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <div className="mx-auto max-w-shell pb-8">
        <h1 className="px-5 pb-2 font-serif text-title font-bold text-ink">미션 탐색</h1>
        <MissionBrowser />
      </div>
      <BottomTabBarSpacer />
      <BottomTabBar />
    </div>
  );
}
