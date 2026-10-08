import crypto from "node:crypto";

function getHmacSecret(): Buffer {
  const secret =
    process.env.HMAC_SECRET || "gorola_default_hmac_secret_key_32bytes!!";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Signs a tamper-evident device cooldown cookie value: `<expiryEpochSeconds>.<hmacHex>`
 */
export function signDeviceCookie(
  now: Date = new Date(),
  cooldownHours?: number
): string {
  const configuredHours =
    cooldownHours ??
    (parseInt(process.env.AGE_GATE_DEVICE_COOLDOWN_HOURS || "24", 10) || 24);
  const expiryEpochSeconds =
    Math.floor(now.getTime() / 1000) + configuredHours * 3600;
  const payload = `ag:${expiryEpochSeconds}`;
  const hmacHex = crypto
    .createHmac("sha256", getHmacSecret())
    .update(payload)
    .digest("hex");
  return `${expiryEpochSeconds}.${hmacHex}`;
}

/**
 * Verifies a device cooldown cookie. Returns true if signature is valid and not expired.
 */
export function verifyDeviceCookie(
  cookieValue: unknown,
  now: Date = new Date()
): boolean {
  if (typeof cookieValue !== "string" || !cookieValue) {
    return false;
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const expiryStr = parts[0];
  const hmacHex = parts[1];
  if (!expiryStr || !hmacHex) {
    return false;
  }

  const expiryEpoch = parseInt(expiryStr, 10);
  if (isNaN(expiryEpoch)) {
    return false;
  }

  const currentEpoch = Math.floor(now.getTime() / 1000);
  if (expiryEpoch <= currentEpoch) {
    return false;
  }

  try {
    const payload = `ag:${expiryEpoch}`;
    const expectedHmacHex = crypto
      .createHmac("sha256", getHmacSecret())
      .update(payload)
      .digest("hex");

    const providedBuf = Buffer.from(hmacHex, "hex");
    const expectedBuf = Buffer.from(expectedHmacHex, "hex");

    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}
