import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "./auth.store";

describe("useAuthStore", () => {
  beforeEach(() => {
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
      result.current.clearSession();
    });
    expect(result.current.accessToken).toBeNull();
    expect(result.current.refreshToken).toBeNull();
    expect(result.current.userId).toBeNull();
    expect(result.current.phone).toBeNull();
  });
});
