import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "./auth.store";
import { useCartStore } from "./cart.store";

const { resetBootstrapStateMock } = vi.hoisted(() => ({
  resetBootstrapStateMock: vi.fn()
}));

vi.mock("@/lib/bootstrap-state", () => ({
  resetBootstrapState: resetBootstrapStateMock,
  setBootstrapPromise: vi.fn(),
  setStoreBootstrapPromise: vi.fn()
}));

describe("useAuthStore", () => {
  beforeEach(() => {
    resetBootstrapStateMock.mockReset();
    act(() => {
      useAuthStore.getState().clearSession();
    });
  });

  it("starts with no session", () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.accessToken).toBeNull();
    expect(result.current.refreshToken).toBeNull();
    expect(result.current.role).toBeNull();
    expect(result.current.userId).toBeNull();
    expect(result.current.name).toBeNull();
    expect(result.current.phone).toBeNull();
  });

  it("setTokens stores both tokens without clearing buyer profile", () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setBuyerSession({
        accessToken: "a0",
        name: "N",
        phone: "+919876543210",
        refreshToken: "r0",
        userId: "buyer-1"
      });
      result.current.setTokens({ accessToken: "a1", refreshToken: "r1" });
    });
    expect(result.current.accessToken).toBe("a1");
    expect(result.current.refreshToken).toBe("r1");
    expect(result.current.userId).toBe("buyer-1");
    expect(result.current.phone).toBe("+919876543210");
  });

  it("clearSession removes tokens and buyer fields", () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setBuyerSession({
        accessToken: "a",
        name: null,
        phone: "+919876543210",
        refreshToken: "r",
        userId: "u"
      });
      useCartStore.getState().addOrMergeLine({ productVariantId: "v1", quantity: 2 });
      result.current.clearSession();
    });
    expect(result.current.accessToken).toBeNull();
    expect(result.current.refreshToken).toBeNull();
    expect(result.current.userId).toBeNull();
    expect(result.current.phone).toBeNull();
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it("clearSession calls resetBootstrapState", () => {
    act(() => {
      useAuthStore.getState().setStoreOwnerSession({
        accessToken: "at",
        refreshToken: "rt",
        userId: "u1",
        storeId: "s1"
      });
    });
    resetBootstrapStateMock.mockReset();
    act(() => {
      useAuthStore.getState().clearSession();
    });
    expect(resetBootstrapStateMock).toHaveBeenCalledTimes(1);
  });
});
