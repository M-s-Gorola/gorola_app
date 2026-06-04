import { create } from "zustand";

import { resetBootstrapState } from "@/lib/bootstrap-state";
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

export type AdminSession = AuthTokens & {
  userId: string;
  twoFactorVerified: boolean;
  twoFactorEnabled?: boolean;
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
  twoFactorEnabled: boolean | null;
  setTokens: (tokens: AuthTokens) => void;
  setBuyerSession: (session: BuyerSession) => void;
  setStoreOwnerSession: (session: StoreOwnerSession) => void;
  setAdminSession: (session: AdminSession) => void;
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
  twoFactorEnabled: null,
  clearSession: () => {
    useCartStore.getState().clear();
    queryClient.clear();
    // Reset bootstrap promise singletons so the next login triggers a fresh
    // bootstrap rather than returning the stale already-resolved promise.
    resetBootstrapState();
    set({
      accessToken: null,
      name: null,
      phone: null,
      refreshToken: null,
      role: null,
      userId: null,
      storeId: null,
      twoFactorVerified: null,
      twoFactorEnabled: null
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
      twoFactorVerified: null,
      twoFactorEnabled: null
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
      twoFactorVerified: true,
      twoFactorEnabled: true
    }),
  setAdminSession: (session) =>
    set({
      accessToken: session.accessToken,
      name: null,
      phone: null,
      refreshToken: session.refreshToken,
      role: "ADMIN",
      userId: session.userId,
      storeId: null,
      twoFactorVerified: session.twoFactorVerified,
      twoFactorEnabled: session.twoFactorEnabled ?? true
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
