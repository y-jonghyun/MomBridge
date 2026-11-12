'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import AccountMenu from './AccountMenu';
import SiteHeader from './SiteHeader';

/**
 * 탭 첫 화면의 머리글 (홈·미션·커뮤니티·내 활동).
 *
 * 모바일(1024px 미만): 사이트 로고 대신 화면 제목이 머리글이 된다.
 * - 위에 붙는 얇은 막대: 오른쪽에 로그인/계정 메뉴, 큰 제목이 화면 밖으로 나가면 작은 제목이 나타난다
 * - 그 아래 큰 제목(+ 머리말)과 화면별 동작(알림·글 작성 등)
 * 데스크톱(1024px 이상): 하단 탭이 없으므로 지금처럼 사이트 머리글(상단 메뉴)을 두고, 그 아래에 같은 제목 줄을 둔다.
 */
export default function AppBar({
  title, eyebrow, actions, showAccount = true,
}: {
  title: string;
  /** 큰 제목 위 한 줄 (예: 날짜·지역) */
  eyebrow?: React.ReactNode;
  /** 제목 줄 오른쪽의 화면별 동작 */
  actions?: React.ReactNode;
  /** 오른쪽 위 로그인/계정 메뉴. 이미 내 화면이라 필요 없으면 false */
  showAccount?: boolean;
}) {
  const user = useAuthStore(s => s.user);
  // persist 복원 전에는 서버와 같은 화면을 그린다 (SiteHeader와 같은 방식)
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const signedIn = ready && !!user;

  // 큰 제목이 화면 위로 사라지면 막대에 작은 제목을 띄운다
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const el = titleRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
      rootMargin: '-48px 0px 0px 0px', // 막대(48px)에 가려지면 사라진 것으로 본다
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div className="hidden lg:block">
        <SiteHeader showSearch={false} showMyLink={showAccount} />
      </div>

      {/* 모바일 막대 */}
      <div
        data-collapsed={collapsed || undefined}
        className={`sticky top-0 z-20 flex h-12 items-center justify-between gap-2 px-3 transition-colors duration-quick ease-mb lg:hidden ${
          collapsed ? 'border-b border-line bg-cream/95 backdrop-blur' : 'border-b border-transparent bg-cream'
        }`}
      >
        <span
          aria-hidden="true"
          className={`min-w-0 truncate pl-2 font-serif text-[17px] font-bold text-ink transition-opacity duration-quick ease-mb ${collapsed ? 'opacity-100' : 'opacity-0'}`}
        >
          {title}
        </span>
        <div className="flex shrink-0 items-center">
          {showAccount && (signedIn ? <AccountMenu /> : ready && (
            <Link href="/login" className="press flex h-11 items-center rounded-control px-3 text-sm font-medium text-ink-2">
              로그인
            </Link>
          ))}
        </div>
      </div>

      {/* 큰 제목 줄 — 모바일·데스크톱 공통 */}
      <header className="mx-auto flex w-full max-w-shell items-end justify-between gap-2 px-5 pb-2 pt-1 lg:pt-3.5">
        <div className="min-w-0">
          {eyebrow && <div className="text-[13px] text-muted">{eyebrow}</div>}
          <h1 ref={titleRef} className="font-serif text-title font-bold text-ink">{title}</h1>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
    </>
  );
}
