'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'OPERATOR' | 'PARTICIPANT' | 'CLIENT';

interface User { id: string; email: string; name: string; role: Role; }

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      setAuth: (user, token, refreshToken) => set({ user, token, refreshToken }),
      clearAuth: () => set({ user: null, token: null, refreshToken: null }),
    }),
    { name: 'mombridge-auth' }
  )
);
