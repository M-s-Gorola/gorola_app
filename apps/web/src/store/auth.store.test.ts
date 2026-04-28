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
  });

  it("setTokens stores both tokens", () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setTokens({ accessToken: "a", refreshToken: "r" });
    });
    expect(result.current.accessToken).toBe("a");
    expect(result.current.refreshToken).toBe("r");
  });

  it("clearSession removes tokens", () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setTokens({ accessToken: "a", refreshToken: "r" });
      result.current.clearSession();
    });
    expect(result.current.accessToken).toBeNull();
    expect(result.current.refreshToken).toBeNull();
  });
});
