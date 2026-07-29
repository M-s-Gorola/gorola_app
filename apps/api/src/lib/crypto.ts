import crypto from "node:crypto";

const DEFAULT_KEY =
  process.env.ENCRYPTION_KEY ||
  "gorola_default_pii_encryption_key_32bytes!!";
const DEFAULT_HMAC_SECRET =
  process.env.HMAC_SECRET || "gorola_default_hmac_secret_key_32bytes!!";

function getCipherKey(): Buffer {
  return crypto.createHash("sha256").update(DEFAULT_KEY).digest();
}

function getHmacSecret(): Buffer {
  return crypto.createHash("sha256").update(DEFAULT_HMAC_SECRET).digest();
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

  const decipher = crypto.createDecipheriv("aes-256-gcm", getCipherKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, undefined, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
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
