'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { BellIcon, SearchIcon } from './icons';

/** 역할별로 '내 활동'이 가리키는 곳 */
const HOME_BY_ROLE = { PARTICIPANT: '/participant', CLIENT: '/client', OPERATOR: '/operator' } as const;

/**
 * 상단 바. 로고(영문 머리말 + 한글 serif)와 오른쪽 동작.
 * 로그인 상태를 반영한다 — 로그인 전에는 '로그인', 후에는 내 화면으로 가는 링크와 알림.
 */
export default function SiteHeader({
  onSearch, showSearch = true,
}: {
  onSearch?: () => void;
  showSearch?: boolean;
}) {
  const user = useAuthStore(s => s.user);
  // persist 복원 전에는 서버와 같은 화면을 그려 hydration 불일치를 막는다
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const signedIn = ready && !!user;

  return (
    <header className="mx-auto flex w-full max-w-shell items-center justify-between px-5 pb-3 pt-[18px]">
      <Link href="/" className="flex flex-col text-ink">
        <span className="font-accent text-[13px] italic tracking-[0.08em] text-muted">Mom Bridge</span>
        <span className="font-serif text-[22px] font-bold tracking-[-0.02em]">맘브릿지</span>
      </Link>

      <div className="flex items-center gap-1">
        {showSearch && onSearch && (
          <button
            type="button" onClick={onSearch} aria-label="검색"
            className="flex h-11 w-11 items-center justify-center text-ink"
          >
            <SearchIcon />
          </button>
        )}
        {signedIn ? (
          <Link
            href={HOME_BY_ROLE[user!.role] ?? '/'} aria-label="내 활동"
            className="flex h-11 w-11 items-center justify-center text-ink"
          >
            <BellIcon />
          </Link>
        ) : (
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
