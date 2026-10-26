'use client';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'OPERATOR' | 'PARTICIPANT' | 'CLIENT';

interface User { id: string; email: string; name: string; role: Role; }

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  /** 토큰 재발급·비밀번호 변경 후 토큰만 교체 */
  setTokens: (token: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      setAuth: (user, token, refreshToken) => set({ user, token, refreshToken }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      clearAuth: () => {
        // 로그아웃하면 본인 클릭 표시도 지운다 (같은 기기를 다른 사람이 쓸 수 있음)
        if (typeof document !== 'undefined') document.cookie = 'mb_self=; Path=/r; Max-Age=0; SameSite=Lax';
        set({ user: null, token: null, refreshToken: null });
      },
    }),
    { name: 'mombridge-auth' }
  )
);

/**
 * 저장해 둔 로그인 정보를 다 읽어 왔는지.
 *
 * 첫 그림(서버와 맞추는 렌더)에서는 저장소를 읽기 전이라 user가 null이다.
 * 그때 화면 가드가 돌면 토큰이 멀쩡한데도 /login으로 튕긴다
 * (주소창으로 열거나 새로고침할 때만 생기고, 앱 안에서 이동하면 멀쩡해 보인다).
 *
 * 그래서 **가드는 이 값이 true가 된 다음에만** 판단한다. 그 전에는 기존 로딩 화면을 보여 준다.
 */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // 이미 끝났으면 바로, 아직이면 끝날 때 알려 준다
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}

/** 로그아웃한 뒤 홈에서 한 번만 보여 줄 안내 (sessionStorage 열쇠) */
export const LOGOUT_NOTICE_KEY = 'mombridge-logout-notice';

/**
 * 로그아웃 — 화면마다 다르게 하지 않도록 한 곳에 둔다.
 * 저장된 로그인 정보를 지우고, 홈으로 보내고, 홈에서 "로그아웃했어요"를 한 번 보여 준다.
 *
 * 화면 이동이 필요 없는 곳(로그인 화면에서 '다른 계정으로 로그인')은 clearAuth()만 쓴다.
 */
export function logout(options: { redirectTo?: string } = {}): void {
  useAuthStore.getState().clearAuth();
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LOGOUT_NOTICE_KEY, '1');
  } catch { /* 저장소를 막아 둔 브라우저에서는 안내만 건너뛴다 */ }
  window.location.href = options.redirectTo ?? '/';
}
