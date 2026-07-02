import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

const WALLET_COOKIE = "lp_wallet_unlock";
const UNLOCK_TTL_MS = 30 * 60 * 1000;

function signingKey(): string {
  const secret = process.env.WALLET_ENCRYPTION_SECRET;
  if (!secret) throw new Error("WALLET_ENCRYPTION_SECRET required");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export function createWalletUnlockToken(clerkId: string): string {
  const exp = Date.now() + UNLOCK_TTL_MS;
  const body = `${clerkId}:${exp}`;
  return `${body}:${sign(body)}`;
}

export function verifyWalletUnlockToken(token: string, clerkId: string): boolean {
  const parts = token.split(":");
  if (parts.length < 3) return false;
  const sig = parts.pop()!;
  const body = parts.join(":");
  const expectedSig = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const [id, expStr] = body.split(":");
  if (id !== clerkId) return false;
  const exp = Number(expStr);
  return Number.isFinite(exp) && exp > Date.now();
}

export function setWalletUnlockCookie(res: Response, clerkId: string): void {
  const token = createWalletUnlockToken(clerkId);
  const secure = process.env.NODE_ENV === "production";
  res.cookie(WALLET_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: UNLOCK_TTL_MS,
    path: "/",
  });
}

export function clearWalletUnlockCookie(res: Response): void {
  res.clearCookie(WALLET_COOKIE, { path: "/" });
}

export function isWalletUnlocked(req: Request, clerkId: string): boolean {
  const token = req.cookies?.[WALLET_COOKIE];
  if (typeof token !== "string") return false;
  return verifyWalletUnlockToken(token, clerkId);
}

export { WALLET_COOKIE, UNLOCK_TTL_MS };
