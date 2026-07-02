import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTION_VERSION = "v1";

function encryptionKey(): Buffer {
  const secret = process.env.WALLET_ENCRYPTION_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("WALLET_ENCRYPTION_SECRET is required for security features");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTION_VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== ENCRYPTION_VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function hashDeviceId(deviceId: string): string {
  const pepper = process.env.WALLET_ENCRYPTION_SECRET ?? "leptonpad-device";
  return createHash("sha256").update(`${pepper}:device:${deviceId}`).digest("hex");
}

export function hashOtpCode(code: string): string {
  const pepper = process.env.WALLET_ENCRYPTION_SECRET ?? "leptonpad-otp";
  return createHash("sha256").update(`${pepper}:otp:${code}`).digest("hex");
}

export function generateOtpCode(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, "0");
}
