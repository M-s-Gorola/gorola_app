import MockAdapter from "axios-mock-adapter";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/store/auth.store";

import { api, bootstrapBuyerAuthSession, createApiClient, type CreateApiClientOptions, getNormalizedApiBaseUrl } from "./api";

vi.mock("@/store/auth.store", () => ({
  useAuthStore: {
    getState: vi.fn(() => ({ role: "BUYER" })),
  },
}));

function opts(over: Partial<CreateApiClientOptions> = {}): CreateApiClientOptions {
  return {
    baseURL: "https://api.example",
    getAccessToken: () => "access",
    getRefreshToken: () => "refresh",
    setTokens: vi.fn(),
    clearSession: vi.fn(),
    ...over
  };
}

describe("getNormalizedApiBaseUrl", () => {
  it("trims trailing slashes", () => {
    expect(getNormalizedApiBaseUrl("https://x.com/")).toBe("https://x.com");
  });

  it("returns empty for missing or empty", () => {
    expect(getNormalizedApiBaseUrl("")).toBe("");
    expect(getNormalizedApiBaseUrl(undefined)).toBe("");
  });
});

describe("createApiClient", () => {
  let mock: MockAdapter;

  afterEach(() => {
    mock?.restore();
  });

  it("sends Authorization when access token is present", async () => {
    const client = createApiClient({
      baseURL: "https://api.example",
      getAccessToken: () => "tok",
      getRefreshToken: () => null,
      setTokens: vi.fn(),
      clearSession: vi.fn()
    });
    mock = new MockAdapter(client);
    mock.onGet("/me").reply((config) => {
      expect(config.headers?.Authorization).toBe("Bearer tok");
      return [200, { ok: true }];
    });
    const res = await client.get("/me");
    expect(res.data).toEqual({ ok: true });
  });

  it("on 401, refreshes once and retries the request", async () => {
    const setTokens = vi.fn();
    const clearSession = vi.fn();
    const client = createApiClient(
      opts({
        getAccessToken: () => "old-access",
        getRefreshToken: () => "refresh-1",
        setTokens,
        clearSession
      })
    );
    mock = new MockAdapter(client);
    mock.onGet("/data").replyOnce(401);
    mock.onGet("/data").replyOnce(200, { ok: "retry" });
    mock.onPost("/api/v1/auth/buyer/refresh").reply(200, {
      success: true,
      data: {
        accessToken: "new-a",
        refreshToken: "new-r",
        userId: "u1",
        phone: "+9199"
      },
      meta: { requestId: "r" }
    });

    const res = await client.get("/data");
    expect(res.data).toEqual({ ok: "retry" });
    expect(setTokens).toHaveBeenCalledWith({
      accessToken: "new-a",
      refreshToken: "new-r",
      userId: "u1",
      phone: "+9199",
      name: null,
      privacyPolicyVersionAccepted: "1.0"
    });
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("on 401, when refresh fails, clears session", async () => {
    const clearSession = vi.fn();
    const client = createApiClient(
      opts({
        getAccessToken: () => "old",
        getRefreshToken: () => "bad-refresh",
        clearSession
      })
    );
    mock = new MockAdapter(client);
    mock.onGet("/x").reply(401);
    mock.onPost("/api/v1/auth/buyer/refresh").reply(401);
    await expect(client.get("/x")).rejects.toBeTruthy();
    expect(clearSession).toHaveBeenCalled();
  });

  it("on 401, when refresh returns 403 AGE_CONFIRMATION_REQUIRED, clears session and redirects to login", async () => {
    const clearSession = vi.fn();
    const client = createApiClient(
      opts({
        getAccessToken: () => "old-token",
        getRefreshToken: () => "legacy-unconfirmed-refresh",
        clearSession
      })
    );
    mock = new MockAdapter(client);
    mock.onGet("/api/v1/cart").reply(401);
    mock.onPost("/api/v1/auth/buyer/refresh").reply(403, {
      success: false,
      error: {
        code: "AGE_CONFIRMATION_REQUIRED",
        message: "Age confirmation required"
      }
    });

    await expect(client.get("/api/v1/cart")).rejects.toBeTruthy();
    expect(clearSession).toHaveBeenCalled();
  });

  it("on direct 403 ACCOUNT_SUSPENDED, immediately clears session without refresh attempt", async () => {
    const clearSession = vi.fn();
    const client = createApiClient(
      opts({
        getAccessToken: () => "suspended-access-token",
        getRefreshToken: () => "some-refresh-token",
        clearSession
      })
    );
    mock = new MockAdapter(client);
    mock.onGet("/api/v1/user/profile").reply(403, {
      success: false,
      error: {
        code: "ACCOUNT_SUSPENDED",
        message: "Account suspended"
      }
    });

    await expect(client.get("/api/v1/user/profile")).rejects.toBeTruthy();
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it("on direct 403 USER_SUSPENDED, immediately clears session without refresh attempt", async () => {
    const clearSession = vi.fn();
    const client = createApiClient(
      opts({
        getAccessToken: () => "suspended-access-token",
        getRefreshToken: () => "some-refresh-token",
        clearSession
      })
    );
    mock = new MockAdapter(client);
    mock.onGet("/api/v1/cart").reply(403, {
      success: false,
      error: {
        code: "USER_SUSPENDED",
        message: "User is suspended"
      }
    });

    await expect(client.get("/api/v1/cart")).rejects.toBeTruthy();
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it("on concurrent 401s, deduplicates refresh and retries both requests successfully", async () => {
    const setTokens = vi.fn();
    const clearSession = vi.fn();
    const client = createApiClient(
      opts({
        getAccessToken: () => "old-access",
        getRefreshToken: () => "refresh-1",
        setTokens,
        clearSession
      })
    );
    mock = new MockAdapter(client);

    mock.onGet("/data-1").replyOnce(401);
    mock.onGet("/data-1").replyOnce(200, { ok: "data-1-retry" });
    
    mock.onGet("/data-2").replyOnce(401);
    mock.onGet("/data-2").replyOnce(200, { ok: "data-2-retry" });

    let refreshCallCount = 0;
    mock.onPost("/api/v1/auth/buyer/refresh").reply(() => {
      refreshCallCount++;
      return [200, {
        success: true,
        data: {
          accessToken: "new-a",
          refreshToken: "new-r",
          userId: "u1",
          phone: "+9199"
        },
        meta: { requestId: "r" }
      }];
    });

    const [res1, res2] = await Promise.all([
      client.get("/data-1"),
      client.get("/data-2")
    ]);

    expect(res1.data).toEqual({ ok: "data-1-retry" });
    expect(res2.data).toEqual({ ok: "data-2-retry" });
    expect(refreshCallCount).toBe(1);
    expect(clearSession).not.toHaveBeenCalled();
    expect(setTokens).toHaveBeenCalledTimes(1);
  });
});

describe("bootstrapBuyerAuthSession", () => {
  let mock: MockAdapter;

  it("hydrates full buyer session on success", async () => {
    const setBuyerSession = vi.fn();
    const setBootstrapPending = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useAuthStore.getState as any).mockReturnValue({
      accessToken: null,
      setBuyerSession,
      setBootstrapPending,
    });

    if (api) {
      mock = new MockAdapter(api);
      mock.onPost("/api/v1/auth/buyer/refresh").reply(200, {
        success: true,
        data: {
          accessToken: "a",
          name: "N",
          phone: "P",
          refreshToken: "r",
          userId: "u"
        }
      });
    }

    await bootstrapBuyerAuthSession();

    expect(setBuyerSession).toHaveBeenCalledWith({
      accessToken: "a",
      name: "N",
      phone: "P",
      privacyPolicyVersionAccepted: "1.0",
      refreshToken: "r",
      userId: "u"
    });
  });
});
