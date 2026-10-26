'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { SearchIcon } from './icons';
import AccountMenu from './AccountMenu';

/** 역할별로 '내 활동'이 가리키는 곳 */
const HOME_BY_ROLE = { PARTICIPANT: '/participant', CLIENT: '/client', OPERATOR: '/operator' } as const;
const MY_LABEL_BY_ROLE = { PARTICIPANT: '내 활동', CLIENT: '내 가게', OPERATOR: '관리자' } as const;

/**
 * 상단 바. 로고(영문 머리말 + 한글 serif)와 오른쪽 동작.
 * 로그인 전에는 '로그인', 후에는 계정 메뉴(이름·역할 · 내 화면 · 로그아웃)를 보여 준다.
 * 1024px 이상에서는 하단 탭바가 숨겨지므로 여기에 상단 메뉴를 함께 보여 준다.
 */
export default function SiteHeader({
  onSearch, showSearch = true, showMyLink = true,
}: {
  onSearch?: () => void;
  showSearch?: boolean;
  /** 이미 내 화면에 있을 때처럼 오른쪽 바로가기가 필요 없으면 false */
  showMyLink?: boolean;
}) {
  const user = useAuthStore(s => s.user);
  const pathname = usePathname() ?? '/';
  // persist 복원 전에는 서버와 같은 화면을 그려 hydration 불일치를 막는다
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const signedIn = ready && !!user;

  // 로그인 전에는 참여자 화면을 가리킨다 (그 화면이 로그인으로 보낸다)
  const myHref: string = signedIn ? HOME_BY_ROLE[user!.role] : '/participant';
  const myLabel: string = signedIn ? MY_LABEL_BY_ROLE[user!.role] : '내 활동';

  const menu = [
    { href: '/', label: '홈', match: (p: string) => p === '/' },
    { href: '/missions', label: '미션', match: (p: string) => p.startsWith('/missions') },
    { href: '/community', label: '커뮤니티', match: (p: string) => p.startsWith('/community') },
    { href: myHref, label: myLabel, match: (p: string) => p.startsWith(myHref) },
  ];

  return (
    <header className="mx-auto flex w-full max-w-shell items-center justify-between gap-6 px-5 pb-3 pt-[18px]">
      <Link href="/" className="flex shrink-0 flex-col text-ink">
        <span className="font-accent text-[13px] italic tracking-[0.08em] text-muted">MomBridge</span>
        <span className="font-serif text-[22px] font-bold tracking-[-0.02em]">맘브릿지</span>
      </Link>

      {/* 데스크톱 상단 메뉴 — 하단 탭바가 없는 화면 폭에서 이동 수단이 된다 */}
      <nav aria-label="주요 메뉴" className="hidden flex-1 items-center gap-7 lg:flex">
        {menu.map(({ href, label, match }) => {
          const on = match(pathname);
          return (
            <Link
              key={label} href={href} aria-current={on ? 'page' : undefined}
              className={`flex min-h-[44px] items-center text-sm ${on ? 'font-bold text-ink' : 'text-muted hover:text-ink'}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-1">
        {showSearch && onSearch && (
          <button
            type="button" onClick={onSearch} aria-label="검색"
            className="flex h-11 w-11 items-center justify-center text-ink"
          >
            <SearchIcon />
          </button>
        )}
        {signedIn ? (showMyLink && <AccountMenu />) : (
          ready && (
            <Link
              href="/login"
              className="flex h-11 items-center rounded-control px-4 text-sm font-medium text-ink-2"
            >
              로그인
            </Link>
          )
        )}
      </div>
    </header>
  );
}
