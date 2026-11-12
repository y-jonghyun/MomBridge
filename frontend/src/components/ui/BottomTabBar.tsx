'use client';
import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChatIcon, GridIcon, HomeIcon, UserIcon } from './icons';
import { BOTTOM_BAR_VAR, useReportHeight } from '@/lib/bottom-chrome';
import { useUnreadCount } from '@/lib/unread-notifications';

const TABS = [
  { href: '/', label: '홈', Icon: HomeIcon, match: (p: string) => p === '/' },
  { href: '/missions', label: '미션', Icon: GridIcon, match: (p: string) => p.startsWith('/missions') },
  { href: '/community', label: '커뮤니티', Icon: ChatIcon, match: (p: string) => p.startsWith('/community') },
  { href: '/participant', label: '내 활동', Icon: UserIcon, match: (p: string) => p.startsWith('/participant') },
];

/**
 * 모바일 하단 4칸. 데스크톱(≥1024px)에서는 숨기고 상단 메뉴를 쓴다.
 * 지금 있는 탭은 아이콘 뒤 clay-tint 알약으로, 참여자의 안 읽은 알림은 '내 활동'에 숫자로 보여 준다.
 * 고정 막대에 가려지지 않도록, 쓰는 화면은 아래 여백을 두거나 <BottomTabBarSpacer />를 둔다.
 */
export default function BottomTabBar() {
  const pathname = usePathname() ?? '/';
  const ref = useRef<HTMLElement>(null);
  // 데스크톱(lg)에서는 숨겨져 높이 0으로 알린다
  useReportHeight(ref, BOTTOM_BAR_VAR);
  const unread = useUnreadCount();
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
            className={`press flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] ${
              on ? 'font-bold text-ink' : 'text-muted'
            }`}
          >
            <span
              className={`relative flex h-[30px] w-[52px] items-center justify-center rounded-full transition-colors duration-quick ease-mb ${
                on ? 'bg-clay-tint text-clay-dark' : ''
              }`}
            >
              <Icon />
              {href === '/participant' && unread > 0 && (
                <span className="absolute -top-0.5 left-[30px] flex h-4 min-w-[16px] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold leading-none text-paper">
                  {unread > 9 ? '9+' : unread}
                  <span className="sr-only">개의 안 읽은 알림</span>
                </span>
              )}
            </span>
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
