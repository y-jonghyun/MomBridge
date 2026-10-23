'use client';
import { create } from 'zustand';
import api from '@/lib/api';

/**
 * 찜한 미션 id 모음.
 * 카드 하트와 상세 버튼이 같은 상태를 보도록 한곳에 둔다.
 * 서버가 참이므로 실패하면 되돌린다(낙관적 갱신).
 */
interface BookmarkState {
  ids: Set<string>;
  loaded: boolean;
  load: () => Promise<void>;
  toggle: (missionId: string) => Promise<void>;
  clear: () => void;
}

export const useBookmarks = create<BookmarkState>((set, get) => ({
  ids: new Set(),
  loaded: false,

  load: async () => {
    try {
      const { data } = await api.get('/participant/bookmarks/ids');
      set({ ids: new Set<string>(data.data), loaded: true });
    } catch {
      // 로그인하지 않았거나 참여자가 아니면 찜이 없는 상태로 둔다
      set({ ids: new Set(), loaded: true });
    }
  },

  toggle: async (missionId: string) => {
    const before = get().ids;
    const next = new Set(before);
    const adding = !next.has(missionId);
    if (adding) next.add(missionId); else next.delete(missionId);
    set({ ids: next }); // 먼저 그려 두고

    try {
      if (adding) await api.put(`/participant/bookmarks/${missionId}`);
      else await api.delete(`/participant/bookmarks/${missionId}`);
    } catch {
      set({ ids: before }); // 실패하면 되돌린다
    }
  },

  clear: () => set({ ids: new Set(), loaded: false }),
}));
