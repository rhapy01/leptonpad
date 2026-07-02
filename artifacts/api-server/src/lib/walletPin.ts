import { scrypt, timingSafeEqual, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const MIN_PIN_LEN = 6;
const MAX_PIN_LEN = 64;

export function validateWalletPin(pin: string): string | null {
  const trimmed = pin.trim();
  if (trimmed.length < MIN_PIN_LEN) return `Wallet password must be at least ${MIN_PIN_LEN} characters`;
  if (trimmed.length > MAX_PIN_LEN) return `Wallet password must be at most ${MAX_PIN_LEN} characters`;
  return null;
}

export async function hashWalletPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(pin.trim(), salt, 32)) as Buffer;
  return `scrypt:${salt.toString("base64")}:${derived.toString("base64")}`;
}

export async function verifyWalletPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "base64");
  const expected = Buffer.from(parts[2], "base64");
  const derived = (await scryptAsync(pin.trim(), salt, 32)) as Buffer;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
