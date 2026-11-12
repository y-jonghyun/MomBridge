'use client';
import { useEffect } from 'react';
import { create } from 'zustand';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

/**
 * 안 읽은 알림 수 — 하단 탭의 '내 활동' 숫자와 내 활동 화면의 알림 종이 같은 값을 본다.
 * 서버의 GET /notifications가 unreadCount를 함께 준다. 탭을 옮길 때마다 묻지 않도록 1분 동안은 다시 묻지 않는다.
 */
const FRESH_MS = 60_000;

interface UnreadState {
  count: number;
  fetchedAt: number;
  set: (count: number) => void;
}

export const useUnreadStore = create<UnreadState>(set => ({
  count: 0,
  fetchedAt: 0,
  set: count => set({ count, fetchedAt: Date.now() }),
}));

/** 참여자로 로그인했을 때만 안 읽은 알림 수를 불러온다 (운영자·고객사 탭에는 숫자를 띄우지 않는다) */
export function useUnreadCount(): number {
  const user = useAuthStore(s => s.user);
  const count = useUnreadStore(s => s.count);
  const isParticipant = user?.role === 'PARTICIPANT';

  useEffect(() => {
    if (!isParticipant) return;
    const { fetchedAt, set } = useUnreadStore.getState();
    if (Date.now() - fetchedAt < FRESH_MS) return;
    let alive = true;
    api.get('/notifications')
      .then(r => { if (alive) set(Number(r.data?.data?.unreadCount ?? 0)); })
      .catch(() => { /* 숫자가 없어도 탭은 동작한다 */ });
    return () => { alive = false; };
  }, [isParticipant]);

  return isParticipant ? count : 0;
}
