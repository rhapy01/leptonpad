import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { getAuth } from "@clerk/express";

function clientKey(req: Request): string {
  const { userId } = getAuth(req);
  if (userId) return `user:${userId}`;
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    return `ip:${forwarded.split(",")[0]?.trim()}`;
  }
  return `ip:${req.ip ?? "unknown"}`;
}

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { error: "Too many requests — try again later" },
});

export const writeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { error: "Too many write requests — slow down" },
});

export const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { error: "AI request limit reached — try again later" },
});

export const walletFundRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { error: "Wallet top-up limit reached — try again in an hour" },
});

export const viewRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { error: "View rate limit exceeded" },
});

export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { error: "Upload limit reached — try again later" },
});

export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { error: "Admin action limit reached" },
});
