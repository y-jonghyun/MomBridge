'use client';
import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChatIcon, GridIcon, HomeIcon, UserIcon } from './icons';
import { BOTTOM_BAR_VAR, useReportHeight } from '@/lib/bottom-chrome';

const TABS = [
  { href: '/', label: '홈', Icon: HomeIcon, match: (p: string) => p === '/' },
  { href: '/missions', label: '미션', Icon: GridIcon, match: (p: string) => p.startsWith('/missions') },
  { href: '/community', label: '커뮤니티', Icon: ChatIcon, match: (p: string) => p.startsWith('/community') },
  { href: '/participant', label: '내 활동', Icon: UserIcon, match: (p: string) => p.startsWith('/participant') },
];

/**
 * 모바일 하단 4칸. 데스크톱(≥1024px)에서는 숨기고 상단 메뉴를 쓴다.
 * 고정 막대에 가려지지 않도록, 쓰는 화면은 아래 여백을 두거나 <BottomTabBarSpacer />를 둔다.
 */
export default function BottomTabBar() {
  const pathname = usePathname() ?? '/';
  const ref = useRef<HTMLElement>(null);
  // 데스크톱(lg)에서는 숨겨져 높이 0으로 알린다
  useReportHeight(ref, BOTTOM_BAR_VAR);
  return (
    <nav
      ref={ref}
      aria-label="하단 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(76px+env(safe-area-inset-bottom))] grid-cols-4 border-t border-line bg-paper pb-[calc(10px+env(safe-area-inset-bottom))] lg:hidden"
    >
      {TABS.map(({ href, label, Icon, match }) => {
        const on = match(pathname);
        return (
          <Link
            key={href} href={href} aria-current={on ? 'page' : undefined}
            className={`press flex min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] ${
              on ? 'font-medium text-ink' : 'text-muted'
            }`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** 하단 고정 막대에 내용이 가리지 않도록 두는 여백 */
export function BottomTabBarSpacer() {
  return <div className="h-[calc(76px+env(safe-area-inset-bottom))] lg:hidden" aria-hidden="true" />;
}
