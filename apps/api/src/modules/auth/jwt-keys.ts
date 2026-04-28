import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject
} from "node:crypto";

let devEphemeralPair: { privateKey: KeyObject; publicKey: KeyObject } | null = null;

/**
 * RS256 key pair for buyer JWTs. Prefers `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` PEM from env.
 * In non-production, generates and caches an ephemeral RSA pair when env keys are missing.
 */
export function resolveBuyerJwtKeyPair(): { privateKey: KeyObject; publicKey: KeyObject } {
  const privPem = process.env.JWT_PRIVATE_KEY?.trim();
  const pubPem = process.env.JWT_PUBLIC_KEY?.trim();
  if (
    privPem !== undefined &&
    privPem.length > 0 &&
    pubPem !== undefined &&
    pubPem.length > 0 &&
    privPem.includes("BEGIN") &&
    pubPem.includes("BEGIN")
  ) {
    try {
      return {
        privateKey: createPrivateKey({ format: "pem", key: privPem }),
        publicKey: createPublicKey({ format: "pem", key: pubPem })
      };
    } catch {
      /** Invalid placeholder PEM in .env — fall through to ephemeral keys in dev/test */
    }
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be valid PEM strings in production");
  }
  if (devEphemeralPair === null) {
    devEphemeralPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  }
  return devEphemeralPair;
}
