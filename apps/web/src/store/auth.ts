import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@stealth/shared';

interface AuthState {
  user: AuthUser | null;
  /** Supabase JWT access token */
  token: string | null;
  /** Supabase refresh token — used to get a new access token when expired */
  refreshToken: string | null;
  /** Unix timestamp (seconds) when the access token expires */
  expiresAt: number | null;
  setAuth: (user: AuthUser, token: string, refreshToken: string, expiresAt: number) => void;
  clearAuth: () => void;
  isTokenExpired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      expiresAt: null,
      setAuth: (user, token, refreshToken, expiresAt) => {
        set({ user, token, refreshToken, expiresAt });
      },
      clearAuth: () => {
        set({ user: null, token: null, refreshToken: null, expiresAt: null });
      },
      isTokenExpired: () => {
        const { expiresAt } = get();
        if (!expiresAt) return true;
        return Date.now() / 1000 > expiresAt - 30; // 30s buffer
      },
    }),
    { name: 'stealth-auth', skipHydration: true }
  )
);
