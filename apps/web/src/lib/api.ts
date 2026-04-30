import axios, { type AxiosError, type InternalAxiosRequestConfig, isAxiosError, type RawAxiosRequestHeaders } from "axios";

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
  };
};

function parseRefreshEnvelope(body: unknown): AuthTokens {
  if (body === null || typeof body !== "object") {
    throw new Error("Invalid refresh response");
  }
  const b = body as RefreshResponseBody;
  if (b.success !== true) {
    throw new Error("Refresh response not successful");
  }
  const access = b.data?.accessToken;
  const refresh = b.data?.refreshToken;
  if (access === undefined || access.length === 0 || refresh === undefined || refresh.length === 0) {
    throw new Error("Missing tokens in refresh response");
  }
  return { accessToken: access, refreshToken: refresh };
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
  if (baseURL.length === 0) {
    throw new Error("createApiClient: baseURL is required");
  }

  const instance = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
    withCredentials: true
  });

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

  instance.interceptors.response.use(
    (r) => r,
    async (err: unknown) => {
      if (!isAxiosError(err)) {
        return Promise.reject(err);
      }
      return handle401(err, options, instance);
    }
  );

  return instance;
}

async function handle401(
  error: AxiosError,
  options: CreateApiClientOptions,
  instance: ReturnType<typeof axios.create>
): Promise<unknown> {
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
  const refresh = options.getRefreshToken();
  if (refresh === null || refresh.length === 0) {
    options.clearSession();
    return Promise.reject(error);
  }
  try {
    const res = await instance.post<unknown>(BUYER_REFRESH_PATH, { refreshToken: refresh }, {
      _gorolaRefresh: true
    } as InternalAxiosRequestConfig & { _gorolaRefresh?: true });
    const tokens = parseRefreshEnvelope(res.data);
    options.setTokens(tokens);
  } catch {
    options.clearSession();
    return Promise.reject(error);
  }
  const next: GorolaConfig = {
    ...original,
    _gorolaRetry: true
  };
  return instance.request(next);
}

/**
 * Shared axios instance wired to in-memory `useAuthStore` (null when `VITE_API_BASE_URL` is unset).
 */
export const api: ReturnType<typeof createApiClient> | null = (() => {
  const base = getNormalizedApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (base.length === 0) {
    return null;
  }
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
 */
export async function bootstrapBuyerAuthSession(): Promise<void> {
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
    const tokens = parseRefreshEnvelope(res.data);
    const auth = useAuthStore.getState();
    auth.setTokens(tokens);
    if (auth.role === null) {
      auth.setRole("BUYER");
    }
  } catch {
    // No valid refresh cookie/token on startup; keep anonymous state.
  } finally {
    useAuthStore.getState().setBootstrapPending(false);
  }
}
