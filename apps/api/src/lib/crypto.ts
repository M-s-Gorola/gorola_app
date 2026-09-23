import crypto from "node:crypto";

function getCipherKey(): Buffer {
  const key =
    process.env.ENCRYPTION_KEY ||
    "gorola_default_pii_encryption_key_32bytes!!";
  return crypto.createHash("sha256").update(key).digest();
}

function getHmacSecret(): Buffer {
  const secret =
    process.env.HMAC_SECRET || "gorola_default_hmac_secret_key_32bytes!!";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptPII(text: string): string {
  if (!text) return text;
  if (text.startsWith("enc:")) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getCipherKey(), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  return `enc:${iv.toString("hex")}:${encrypted}:${authTag}`;
}

export function decryptPII(encryptedText: string): string {
  if (!encryptedText || !encryptedText.startsWith("enc:")) {
    return encryptedText;
  }

  const parts = encryptedText.split(":");
  if (parts.length !== 4) {
    return encryptedText;
  }

  const [, ivHex, ciphertextHex, authTagHex] = parts;
  if (!ivHex || !ciphertextHex || !authTagHex) {
    return encryptedText;
  }
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const tryDecrypt = (keyStr: string): string | null => {
    try {
      const keyBuffer = crypto.createHash("sha256").update(keyStr).digest();
      const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, undefined, "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch {
      return null;
    }
  };

  const configuredKey =
    process.env.ENCRYPTION_KEY ||
    "gorola_default_pii_encryption_key_32bytes!!";

  const primary = tryDecrypt(configuredKey);
  if (primary !== null) {
    return primary;
  }

  const defaultFallbackKey = "gorola_default_pii_encryption_key_32bytes!!";
  if (configuredKey !== defaultFallbackKey) {
    const fallback = tryDecrypt(defaultFallbackKey);
    if (fallback !== null) {
      return fallback;
    }
  }

  return encryptedText;
}

export function hashPII(text: string): string {
  if (!text) return "";
  const normalized = text.trim();
  return crypto
    .createHmac("sha256", getHmacSecret())
    .update(normalized)
    .digest("hex");
}

export function maskPhone(phone: string): string {
  if (!phone) return "";
  const plain = decryptPII(phone);
  if (plain.length <= 4) return plain;
  return "*".repeat(plain.length - 4) + plain.slice(-4);
}
