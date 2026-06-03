import axios, { type AxiosError, type InternalAxiosRequestConfig, isAxiosError, type RawAxiosRequestHeaders } from "axios";

import { bootstrapPromise, setBootstrapPromise, setStoreBootstrapPromise, storeBootstrapPromise } from "@/lib/bootstrap-state";
import { type AuthTokens, useAuthStore } from "@/store/auth.store";

const BUYER_REFRESH_PATH = "/api/v1/auth/buyer/refresh";

type GorolaConfig = InternalAxiosRequestConfig & {
  _gorolaRefresh?: boolean;
  _gorolaRetry?: boolean;
};

type RefreshResponseBody = {
  success?: boolean;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    userId?: string;
    phone?: string;
    name?: string | null;
  };
};

export type FullBuyerSession = AuthTokens & {
  userId: string;
  phone: string;
  name: string | null;
};

function parseRefreshEnvelope(body: unknown): FullBuyerSession {
  if (body === null || typeof body !== "object") {
    throw new Error("Invalid refresh response");
  }
  const b = body as RefreshResponseBody;
  if (b.success !== true) {
    throw new Error("Refresh response not successful");
  }
  const data = b.data;
  if (!data || !data.accessToken || !data.refreshToken || !data.userId || !data.phone) {
    throw new Error("Missing session data in refresh response");
  }
  return {
    accessToken: data.accessToken,
    name: data.name ?? null,
    phone: data.phone,
    refreshToken: data.refreshToken,
    userId: data.userId
  };
}

export function getNormalizedApiBaseUrl(raw: string | undefined): string {
  if (raw === undefined || raw.length === 0) {
    return "";
  }
  return raw.replace(/\/+$/, "");
}

export type CreateApiClientOptions = {
  baseURL: string;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (tokens: AuthTokens) => void;
  clearSession: () => void;
};

/**
 * Configured HTTP client: bearer auth from in-memory store, 401 once → `POST` buyer refresh, retry, else logout.
 * Tokens are kept in `useAuthStore` (not `localStorage`).
 */
export function createApiClient(options: CreateApiClientOptions) {
  const baseURL = getNormalizedApiBaseUrl(options.baseURL);

  const instance = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
    withCredentials: true
  });

  let isRefreshing = false;
  let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
  }> = [];

  const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((promise) => {
      if (token) {
        promise.resolve(token);
      } else {
        promise.reject(error);
      }
    });
    failedQueue = [];
  };

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const c = config as GorolaConfig;
    if (c._gorolaRefresh === true) {
      return c;
    }
    const token = options.getAccessToken();
    if (token !== null && token.length > 0) {
      const h = c.headers as RawAxiosRequestHeaders;
      h.Authorization = `Bearer ${token}`;
    }
    return c;
  });

  async function handle401(error: AxiosError): Promise<unknown> {
    const original = error.config as GorolaConfig | undefined;
    if (original?._gorolaRefresh === true) {
      options.clearSession();
      return Promise.reject(error);
    }
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }
    if (original === undefined) {
      return Promise.reject(error);
    }
    if (original._gorolaRetry === true) {
      options.clearSession();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          const next: GorolaConfig = {
            ...original,
            _gorolaRetry: true
          };
          next.headers = next.headers || {};
          next.headers.Authorization = `Bearer ${token}`;
          return instance.request(next);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }

    const refresh = options.getRefreshToken();
    if (refresh === null || refresh.length === 0) {
      if (options.getAccessToken() !== null) {
        options.clearSession();
      }
      return Promise.reject(error);
    }

    isRefreshing = true;

    const role = useAuthStore.getState().role;
    const refreshPath = role === "STORE_OWNER"
      ? "/api/v1/auth/store-owner/refresh"
      : BUYER_REFRESH_PATH;

    try {
      const res = await instance.post<unknown>(refreshPath, { refreshToken: refresh }, {
        _gorolaRefresh: true
      } as InternalAxiosRequestConfig & { _gorolaRefresh?: true });
      
      let nextAccessToken = "";
      if (role === "STORE_OWNER") {
        const body = res.data as { success: boolean; data: { accessToken: string; refreshToken: string } };
        if (!body || body.success !== true || !body.data?.accessToken || !body.data?.refreshToken) {
          throw new Error("Invalid token refresh payload");
        }
        options.setTokens(body.data);
        nextAccessToken = body.data.accessToken;
      } else {
        const tokens = parseRefreshEnvelope(res.data);
        options.setTokens(tokens);
        nextAccessToken = tokens.accessToken;
      }

      isRefreshing = false;
      processQueue(null, nextAccessToken);

      const next: GorolaConfig = {
        ...original,
        _gorolaRetry: true
      };
      next.headers = next.headers || {};
      next.headers.Authorization = `Bearer ${nextAccessToken}`;
      return instance.request(next);
    } catch (err) {
      isRefreshing = false;
      processQueue(err, null);
      options.clearSession();
      return Promise.reject(err);
    }
  }

  instance.interceptors.response.use(
    (r) => r,
    async (err: unknown) => {
      if (!isAxiosError(err)) {
        return Promise.reject(err);
      }
      return handle401(err);
    }
  );

  return instance;
}

/**
 * Shared axios instance wired to in-memory `useAuthStore` (null when `VITE_API_BASE_URL` is unset).
 */
export const api: ReturnType<typeof createApiClient> | null = (() => {
  const base = getNormalizedApiBaseUrl(import.meta.env.VITE_API_BASE_URL || "");
  // We allow empty base for relative path proxying in dev/e2e
  return createApiClient({
    baseURL: base, 
    getAccessToken: () => useAuthStore.getState().accessToken,
    getRefreshToken: () => useAuthStore.getState().refreshToken,
    setTokens: (t) => {
      useAuthStore.getState().setTokens(t);
    },
    clearSession: () => {
      useAuthStore.getState().clearSession();
    }
  });
})();

/**
 * Startup auth bootstrap: try cookie-backed refresh once so reload keeps buyer session.
 * Deduplicated via bootstrapPromise to prevent race conditions during React StrictMode double-mount.
 */
export async function bootstrapBuyerAuthSession(): Promise<void> {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  const p = (async () => {
    if (api === null) {
      useAuthStore.getState().setBootstrapPending(false);
      return;
    }
    if (useAuthStore.getState().accessToken !== null) {
      useAuthStore.getState().setBootstrapPending(false);
      return;
    }
    useAuthStore.getState().setBootstrapPending(true);
    try {
      const res = await api.post<unknown>(BUYER_REFRESH_PATH, {});
      const session = parseRefreshEnvelope(res.data);
      useAuthStore.getState().setBuyerSession(session);
    } catch {
      // No valid refresh cookie/token on startup; keep anonymous state.
    } finally {
      useAuthStore.getState().setBootstrapPending(false);
    }
  })();
  setBootstrapPromise(p);
  return p;
}

/**
 * Startup auth bootstrap for store owner: try cookie-backed refresh once so reload keeps store owner session.
 */
export async function bootstrapStoreOwnerAuthSession(): Promise<void> {
  if (storeBootstrapPromise) {
    return storeBootstrapPromise;
  }

  const p = (async () => {
    if (api === null) {
      useAuthStore.getState().setBootstrapPending(false);
      return;
    }
    if (useAuthStore.getState().accessToken !== null) {
      useAuthStore.getState().setBootstrapPending(false);
      return;
    }
    useAuthStore.getState().setBootstrapPending(true);
    try {
      const res = await api.post<unknown>("/api/v1/auth/store-owner/refresh", {});
      const body = res.data as { success: boolean; data: { accessToken: string; refreshToken: string } };
      if (body?.success === true && body.data?.accessToken && body.data?.refreshToken) {
        // Decode JWT payload
        const tokenPart = body.data.accessToken.split(".")[1];
        if (tokenPart) {
          const payload = JSON.parse(atob(tokenPart)) as {
            sub: string;
            storeId: string;
            role: "STORE_OWNER";
          };
          useAuthStore.getState().setStoreOwnerSession({
            accessToken: body.data.accessToken,
            refreshToken: body.data.refreshToken,
            userId: payload.sub,
            storeId: payload.storeId
          });
        }
      }
    } catch {
      // No valid refresh cookie/token on startup
    } finally {
      useAuthStore.getState().setBootstrapPending(false);
    }
  })();
  setStoreBootstrapPromise(p);
  return p;
}

/**
 * Fetches a boolean feature flag value.
 */
export async function getFeatureFlag(key: string): Promise<boolean> {
  if (api === null) return false;
  try {
    const res = await api.get<{ success: boolean; data: { key: string; value: boolean } }>(
      `/api/v1/feature-flags/${key}`
    );
    return res.data.data.value;
  } catch {
    return false;
  }
}
