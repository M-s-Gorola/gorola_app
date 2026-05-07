export type SendOtpInput = {
  phone: string;
};

export type VerifyOtpInput = {
  phone: string;
  otp: string;
};

export type RefreshTokenInput = {
  refreshToken: string;
};

export type LogoutInput = {
  refreshToken: string;
};

export type AuthTokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type IssueTokensInput = {
  name: string | null;
  phone: string;
  userId: string;
};

/** Successful buyer verify or refresh: tokens + persisted user snapshot */
export type BuyerRefreshSuccess = AuthTokenPair & {
  name: string | null;
  phone: string;
  userId: string;
};

export type BuyerVerifySuccess = BuyerRefreshSuccess;

export type OtpStoreRecord = {
  hashedOtp: string;
  attempts: number;
  expiresAt: string;
  sentCount: number;
  sentWindowStartedAt: string;
};

export type OtpProvider = {
  sendOtp: (phone: string, otp: string) => Promise<void>;
};

export type TokenService = {
  issueTokens: (input: IssueTokensInput) => Promise<BuyerRefreshSuccess>;
  revokeRefreshToken: (refreshToken: string) => Promise<void>;
  /** Verifies and returns the payload of a refresh token. Does NOT revoke or rotate. */
  verifyRefreshToken: (refreshToken: string) => Promise<IssueTokensInput>;
};

export type AccessTokenPayload = {
  sub: string;
  role: "ADMIN" | "BUYER" | "STORE_OWNER";
};

export type AccessTokenVerifier = {
  verifyAccessToken: (token: string) => Promise<AccessTokenPayload>;
};

export type RedisLikeClient = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: "EX", ttlSeconds: number) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
};
