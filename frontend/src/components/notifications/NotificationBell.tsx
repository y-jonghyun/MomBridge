'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useUnreadStore } from '@/lib/unread-notifications';
import { BellIcon } from '@/components/ui/icons';

/**
 * 앱 막대의 알림 종 + 알림함 (내 활동과 로그인 후 홈이 같이 쓴다).
 * 안 읽은 수는 하단 탭 '내 활동' 숫자와 같은 저장소(useUnreadStore)에 맞춘다.
 * 미션 알림(새 미션 등)은 누르면 그 미션으로 가고, 그 알림은 읽음으로 바뀐다.
 */

interface Notice {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  resourceId?: string | null;
  resourceType?: string | null;
  createdAt: string;
}

const hrefOf = (n: Notice) => (n.resourceType === 'mission' && n.resourceId ? `/missions/${n.resourceId}` : null);

export default function NotificationBell() {
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/notifications');
      setItems(r.data.data.notifications ?? []);
      const n = Number(r.data.data.unreadCount ?? 0);
      setUnread(n);
      useUnreadStore.getState().set(n);
    } catch { /* 알림은 없어도 화면이 동작한다 */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setItems(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnread(0);
      useUnreadStore.getState().set(0);
    } catch { /* 실패해도 목록은 그대로 둔다 */ }
  }

  function markRead(n: Notice) {
    setOpen(false);
    if (n.isRead) return;
    setItems(prev => prev.map(x => (x.id === n.id ? { ...x, isRead: true } : x)));
    const left = Math.max(0, unread - 1);
    setUnread(left);
    useUnreadStore.getState().set(left);
    api.patch(`/notifications/${n.id}/read`).catch(() => { /* 다음에 다시 읽음으로 바꾼다 */ });
  }

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        aria-label={unread > 0 ? `알림, 안 읽은 알림 ${unread}개` : '알림'}
        aria-expanded={open}
        onClick={() => { setOpen(v => !v); if (!open) void load(); }}
        className="relative flex h-11 w-11 items-center justify-center text-ink"
      >
        <BellIcon />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-paper">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-card border border-line bg-paper shadow-lg">
          <div className="flex items-center justify-between border-b border-line-soft pl-4 pr-2">
            <span className="py-3 text-sm font-medium">알림</span>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="flex min-h-[44px] items-center px-2 text-xs text-muted">전체 읽음</button>
            )}
          </div>
          <ul className="m-0 max-h-80 list-none divide-y divide-line-soft overflow-y-auto p-0">
            {items.length === 0 ? (
              <li className="py-10 text-center text-sm text-muted">알림이 없습니다</li>
            ) : items.map(n => {
              const href = hrefOf(n);
              const inner = (
                <>
                  <p className={`text-sm ${n.isRead ? 'text-ink-2' : 'font-medium text-ink'}`}>{n.title}</p>
                  <p className="mt-0.5 break-keep text-xs leading-relaxed text-muted">{n.body}</p>
                </>
              );
              const cls = `block px-4 py-3 ${n.isRead ? '' : 'bg-cream'}`;
              return (
                <li key={n.id}>
                  {href ? <Link href={href} onClick={() => markRead(n)} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
