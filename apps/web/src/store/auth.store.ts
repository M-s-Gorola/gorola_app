import { create } from "zustand";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type UserRole = "BUYER" | "STORE_OWNER" | "ADMIN";

export type BuyerSession = AuthTokens & {
  userId: string;
  name: string | null;
  phone: string;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  role: UserRole | null;
  isBootstrapPending: boolean;
  /** Buyer profile fields — null when logged out */
  userId: string | null;
  name: string | null;
  phone: string | null;
  setTokens: (tokens: AuthTokens) => void;
  setBuyerSession: (session: BuyerSession) => void;
  setRole: (role: UserRole | null) => void;
  setBootstrapPending: (pending: boolean) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  isBootstrapPending: true,
  name: null,
  phone: null,
  refreshToken: null,
  role: null,
  userId: null,
  clearSession: () =>
    set({
      accessToken: null,
      name: null,
      phone: null,
      refreshToken: null,
      role: null,
      userId: null
    }),
  setBuyerSession: (session) =>
    set({
      accessToken: session.accessToken,
      name: session.name,
      phone: session.phone,
      refreshToken: session.refreshToken,
      role: "BUYER",
      userId: session.userId
    }),
  setRole: (role) => set({ role }),
  setBootstrapPending: (pending) => set({ isBootstrapPending: pending }),
  /** Refresh flow only — leaves buyer profile untouched */
  setTokens: (tokens) =>
    set((state) => ({
      ...state,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }))
}));
