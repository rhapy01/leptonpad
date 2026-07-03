import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import {
  readDeviceId,
  isDeviceTrusted,
  touchTrustedDevice,
  ensureFirstDeviceTrusted,
  countTrustedDevices,
} from "../lib/deviceTrust";
import { isWalletUnlocked } from "../lib/walletSession";
import { countWalletPasskeys } from "../lib/walletPasskey";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireTrustedDevice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const deviceId = readDeviceId(req);
  if (!deviceId) {
    res.status(403).json({
      error: "Device identification required",
      code: "DEVICE_ID_REQUIRED",
    });
    return;
  }

  const trusted = await isDeviceTrusted(userId, deviceId);
  if (!trusted) {
    const count = await countTrustedDevices(userId);
    res.status(403).json({
      error:
        count > 0
          ? "This device is not verified. Complete email + authenticator verification."
          : "Verify this device to continue",
      code: "DEVICE_NOT_TRUSTED",
      requiresVerification: true,
      totpRequired: count > 0,
    });
    return;
  }

  void touchTrustedDevice(userId, deviceId);
  next();
}

export async function requireWalletUnlock(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select({ walletPinHash: usersTable.walletPinHash })
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId))
    .limit(1);

  const passkeySet = (await countWalletPasskeys(userId)) > 0;
  if (!user?.walletPinHash && !passkeySet) {
    res.status(403).json({
      error: "Set a wallet lock in Security settings first (PIN, password, or passkey)",
      code: "WALLET_LOCK_NOT_SET",
    });
    return;
  }

  if (!isWalletUnlocked(req, userId)) {
    res.status(403).json({
      error: "Unlock your wallet to continue",
      code: "WALLET_LOCKED",
    });
    return;
  }

  next();
}

/** Attach security status without blocking. */
export async function attachSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    next();
    return;
  }
  const deviceId = readDeviceId(req);
  if (deviceId) {
    const trusted = await isDeviceTrusted(userId, deviceId);
    if (!trusted) await ensureFirstDeviceTrusted(userId, deviceId);
  }
  next();
}
