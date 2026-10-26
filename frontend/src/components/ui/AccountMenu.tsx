'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { logout, useAuthStore, type Role } from '@/store/auth';
import { UserIcon } from './icons';

/**
 * 상단 바의 계정 메뉴.
 * 누구로 로그인했는지 보여 주고, 내 화면으로 가거나 로그아웃한다.
 *
 * 전에는 종 아이콘이 '내 활동' 링크여서 알림으로 오해를 샀다 —
 * 진짜 알림 기능이 생기기 전까지 종은 쓰지 않는다.
 */

const HOME_BY_ROLE: Record<Role, string> = {
  PARTICIPANT: '/participant', CLIENT: '/client', OPERATOR: '/operator',
};
const ROLE_LABEL: Record<Role, string> = {
  PARTICIPANT: '참여자', CLIENT: '고객사', OPERATOR: '관리자',
};
const MY_LABEL: Record<Role, string> = {
  PARTICIPANT: '내 활동', CLIENT: '내 가게', OPERATOR: '관리자 화면',
};

const itemClass = 'flex min-h-[44px] w-full items-center px-4 text-left text-sm text-ink-2 hover:bg-cream';

export default function AccountMenu({ tone = 'ink' }: {
  /** 버튼 글자색 — 밝은 바탕 위(ink)와 어두운 바탕 위(paper) */
  tone?: 'ink' | 'paper';
}) {
  const user = useAuthStore(s => s.user);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`계정 메뉴 — ${user.name} ${ROLE_LABEL[user.role]}`}
        className={`flex h-11 w-11 items-center justify-center ${tone === 'paper' ? 'text-paper' : 'text-ink'}`}
      >
        <UserIcon />
      </button>

      {open && (
        <div
          id={menuId} role="menu" aria-label="계정"
          className="absolute right-0 top-[46px] z-50 w-[200px] overflow-hidden rounded-card border border-line bg-paper py-1"
        >
          <p className="px-4 pb-2 pt-2 text-[13px] text-muted">
            <span className="font-medium text-ink">{user.name}</span> · {ROLE_LABEL[user.role]}
          </p>
          <div className="border-t border-line-soft" />
          <Link
            href={HOME_BY_ROLE[user.role]} role="menuitem" className={itemClass}
            onClick={() => setOpen(false)}
          >
            {MY_LABEL[user.role]}
          </Link>
          <button type="button" role="menuitem" className={itemClass} onClick={() => logout()}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
