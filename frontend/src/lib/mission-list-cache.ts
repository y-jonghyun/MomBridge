'use client';
import { useAuthStore } from '@/store/auth';
import { useBookmarks } from '@/lib/bookmarks';

/**
 * 미션 목록을 잠시 기억해 두는 곳 — 목록 → 상세 → 뒤로 왔을 때 빈 뼈대 대신 바로 그리려고.
 *
 * 왜 필요한가: 뒤로 가면 목록 화면이 처음부터 다시 만들어진다. 목록을 다시 받는 동안 뼈대만 있어
 * 페이지가 짧으면, 브라우저가 스크롤을 되돌리는 순간 원래 위치까지 내려가지 못한다
 * (2026-11-13 측정: 뒤로 간 순간 페이지 874px → 308px 위치가 30px로 잘림).
 * 기억해 둔 목록을 처음부터 그리면 그 순간 페이지가 원래 길이라 브라우저가 제자리로 돌려 준다.
 *
 * - 메모리에만 둔다 (새로고침하면 사라진다). 브라우저 저장소에는 쓰지 않는다.
 * - 필터 조합마다 따로 기억하고, 오래된 것부터 지워 최대 MAX_ENTRIES개만 둔다.
 * - 계정이 바뀌면(로그아웃·다른 계정 로그인·자동 로그아웃) 모두 비운다. 찜 표시도 함께 비운다 —
 *   다른 사람의 정보가 화면에 남지 않게. 키에도 계정 id를 넣어 한 번 더 막는다.
 * - 기억한 목록은 화면을 그리는 데만 쓰고, 화면은 늘 뒤에서 새로 받아 바꾼다.
 */

const MAX_ENTRIES = 8;

export interface CachedList<T> { missions: T[]; savedAt: number }

const store = new Map<string, CachedList<unknown>>();

const owner = () => useAuthStore.getState?.()?.user?.id ?? 'guest';
const keyOf = (query: string) => `${owner()}|${query}`;

export function readMissionList<T>(query: string): CachedList<T> | undefined {
  return store.get(keyOf(query)) as CachedList<T> | undefined;
}

export function saveMissionList<T>(query: string, missions: T[]): void {
  const key = keyOf(query);
  store.delete(key); // 다시 넣어 '가장 최근'으로
  store.set(key, { missions, savedAt: Date.now() });
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
}

export function clearMissionListCache(): void {
  store.clear();
}

/** 테스트용 — 몇 개를 기억하고 있는지 */
export const missionListCacheSize = () => store.size;

// 계정이 바뀌면 비운다 (같은 기기를 다른 사람이 쓸 수 있다).
// ?.는 테스트에서 저장소를 가짜로 바꿔 둔 경우에도 이 파일을 불러올 수 있게 하려는 것이다
if (typeof window !== 'undefined') {
  useAuthStore.subscribe?.((state, prev) => {
    if (state.user?.id === prev.user?.id) return;
    clearMissionListCache();
    useBookmarks.getState?.()?.clear?.();
  });
}
