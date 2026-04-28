import { create } from "zustand";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type UserRole = "BUYER" | "STORE_OWNER" | "ADMIN";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  role: UserRole | null;
  setTokens: (tokens: AuthTokens) => void;
  setRole: (role: UserRole | null) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  role: null,
  setTokens: (tokens) => set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
  setRole: (role) => set({ role }),
  clearSession: () => set({ accessToken: null, refreshToken: null, role: null })
}));
