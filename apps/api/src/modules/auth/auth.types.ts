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
  phone: string;
  userId: string;
};

/** Successful buyer verify: tokens + persisted user snapshot */
export type BuyerVerifySuccess = AuthTokenPair & {
  name: string | null;
  phone: string;
  userId: string;
};

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
  issueTokens: (input: IssueTokensInput) => Promise<AuthTokenPair>;
  revokeRefreshToken: (refreshToken: string) => Promise<void>;
  rotateRefreshToken: (refreshToken: string) => Promise<AuthTokenPair>;
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
