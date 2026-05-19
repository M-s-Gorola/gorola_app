import { create } from "zustand";

import { queryClient } from "@/lib/query-client";

import { useCartStore } from "./cart.store";

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

export type StoreOwnerSession = AuthTokens & {
  userId: string;
  storeId: string;
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
  storeId: string | null;
  twoFactorVerified: boolean | null;
  setTokens: (tokens: AuthTokens) => void;
  setBuyerSession: (session: BuyerSession) => void;
  setStoreOwnerSession: (session: StoreOwnerSession) => void;
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
  storeId: null,
  twoFactorVerified: null,
  clearSession: () => {
    useCartStore.getState().clear();
    queryClient.clear();
    set({
      accessToken: null,
      name: null,
      phone: null,
      refreshToken: null,
      role: null,
      userId: null,
      storeId: null,
      twoFactorVerified: null
    });
  },
  setBuyerSession: (session) =>
    set({
      accessToken: session.accessToken,
      name: session.name,
      phone: session.phone,
      refreshToken: session.refreshToken,
      role: "BUYER",
      userId: session.userId,
      storeId: null,
      twoFactorVerified: null
    }),
  setStoreOwnerSession: (session) =>
    set({
      accessToken: session.accessToken,
      name: null,
      phone: null,
      refreshToken: session.refreshToken,
      role: "STORE_OWNER",
      userId: session.userId,
      storeId: session.storeId,
      twoFactorVerified: true
    }),
  setRole: (role) => set({ role }),
  setBootstrapPending: (pending) => set({ isBootstrapPending: pending }),
  /** Refresh flow only — leaves profile untouched */
  setTokens: (tokens) =>
    set((state) => ({
      ...state,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }))
}));
