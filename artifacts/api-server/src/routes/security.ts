import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getOrCreateUser } from "./users";
import {
  readDeviceId,
  isDeviceTrusted,
  countTrustedDevices,
  ensureFirstDeviceTrusted,
  sendDeviceVerificationEmail,
  verifyNewDevice,
  getTotpSetupSecret,
  enableTotp,
} from "../lib/deviceTrust";
import { totpAuthUri } from "../lib/totp";
import { hashWalletPin, verifyWalletPin, validateWalletPin } from "../lib/walletPin";
import { decryptSecret } from "../lib/securityCrypto";
import { verifyTotp } from "../lib/totp";
import { setWalletUnlockCookie, clearWalletUnlockCookie, isWalletUnlocked } from "../lib/walletSession";
import { writeRateLimit } from "../middlewares/rateLimit";

const router = Router();

const otpRateLimit = writeRateLimit;

// GET /api/security/status
router.get("/status", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await getOrCreateUser(userId);
  const deviceId = readDeviceId(req);

  const [user] = await db
    .select({
      totpEnabled: usersTable.totpEnabled,
      walletPinHash: usersTable.walletPinHash,
      email: usersTable.email,
    })
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId))
    .limit(1);

  let deviceTrusted = false;
  let firstDevice = false;
  if (deviceId) {
    deviceTrusted = await isDeviceTrusted(userId, deviceId);
    if (!deviceTrusted) {
      firstDevice = await ensureFirstDeviceTrusted(userId, deviceId);
      deviceTrusted = firstDevice;
    }
  }

  const trustedCount = await countTrustedDevices(userId);
  const walletPinSet = Boolean(user?.walletPinHash);
  const walletUnlocked = isWalletUnlocked(req, userId);

  res.json({
    deviceTrusted,
    firstDevice,
    trustedDeviceCount: trustedCount,
    totpEnabled: user?.totpEnabled ?? false,
    walletPinSet,
    walletUnlocked,
    requiresDeviceVerification: Boolean(deviceId && !deviceTrusted && trustedCount > 0 && !firstDevice),
    canVerifyNewDevice: Boolean(user?.totpEnabled && trustedCount > 0),
    encryptionNote: "Wallet private keys are AES-256-GCM encrypted at rest — never stored in plaintext.",
  });
});

// POST /api/security/device/request-otp
router.post("/device/request-otp", otpRateLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const deviceId = readDeviceId(req);
  if (!deviceId) {
    res.status(400).json({ error: "Device ID required" });
    return;
  }

  if (await isDeviceTrusted(userId, deviceId)) {
    res.json({ sent: true, alreadyTrusted: true });
    return;
  }

  const result = await sendDeviceVerificationEmail(userId);
  if (!result.sent) {
    res.status(503).json({ error: result.error ?? "Could not send email" });
    return;
  }
  res.json({ sent: true });
});

// POST /api/security/device/verify — email OTP + Google Authenticator
router.post("/device/verify", otpRateLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const deviceId = readDeviceId(req);
  if (!deviceId) {
    res.status(400).json({ error: "Device ID required" });
    return;
  }

  const { emailCode, totpCode } = req.body as { emailCode?: string; totpCode?: string };
  if (!emailCode || !totpCode) {
    res.status(400).json({ error: "emailCode and totpCode are required" });
    return;
  }

  const result = await verifyNewDevice(userId, deviceId, emailCode, totpCode);
  if (!result.ok) {
    res.status(403).json({ error: result.error });
    return;
  }

  res.json({ verified: true, deviceTrusted: true });
});

// POST /api/security/totp/setup
router.post("/totp/setup", writeRateLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const deviceId = readDeviceId(req);
  if (!deviceId || !(await isDeviceTrusted(userId, deviceId))) {
    res.status(403).json({ error: "Set up 2FA from a trusted device only" });
    return;
  }

  await getOrCreateUser(userId);
  const [user] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId))
    .limit(1);

  const secret = await getTotpSetupSecret(userId);
  const uri = totpAuthUri(secret, user?.email ?? userId);

  res.json({
    secret,
    uri,
    instructions: "Scan in Google Authenticator, then confirm with a 6-digit code.",
  });
});

// POST /api/security/totp/enable
router.post("/totp/enable", writeRateLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { totpCode } = req.body as { totpCode?: string };
  if (!totpCode) {
    res.status(400).json({ error: "totpCode is required" });
    return;
  }

  const result = await enableTotp(userId, totpCode);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ enabled: true });
});

// POST /api/security/wallet-pin/set
router.post("/wallet-pin/set", writeRateLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const deviceId = readDeviceId(req);
  if (!deviceId || !(await isDeviceTrusted(userId, deviceId))) {
    res.status(403).json({ error: "Trusted device required" });
    return;
  }

  const { pin, totpCode } = req.body as { pin?: string; totpCode?: string };
  if (!pin) {
    res.status(400).json({ error: "pin is required" });
    return;
  }

  const pinErr = validateWalletPin(pin);
  if (pinErr) {
    res.status(400).json({ error: pinErr });
    return;
  }

  const [user] = await db
    .select({ totpEnabled: usersTable.totpEnabled, totpSecretEncrypted: usersTable.totpSecretEncrypted })
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId))
    .limit(1);

  if (user?.totpEnabled && user.totpSecretEncrypted) {
    if (!totpCode) {
      res.status(400).json({ error: "Authenticator code required when 2FA is enabled" });
      return;
    }
    const secret = decryptSecret(user.totpSecretEncrypted);
    if (!verifyTotp(secret, totpCode)) {
      res.status(403).json({ error: "Invalid authenticator code" });
      return;
    }
  }

  const hash = await hashWalletPin(pin);
  await db
    .update(usersTable)
    .set({ walletPinHash: hash })
    .where(eq(usersTable.clerkId, userId));

  setWalletUnlockCookie(res, userId);
  res.json({ set: true, walletUnlocked: true });
});

// POST /api/security/wallet-pin/verify — unlock wallet UI (step 3)
router.post("/wallet-pin/verify", writeRateLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const deviceId = readDeviceId(req);
  if (!deviceId || !(await isDeviceTrusted(userId, deviceId))) {
    res.status(403).json({ error: "Verify this device before accessing your wallet", code: "DEVICE_NOT_TRUSTED" });
    return;
  }

  const { pin } = req.body as { pin?: string };
  if (!pin) {
    res.status(400).json({ error: "pin is required" });
    return;
  }

  const [user] = await db
    .select({ walletPinHash: usersTable.walletPinHash })
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId))
    .limit(1);

  if (!user?.walletPinHash) {
    res.status(400).json({ error: "Set a wallet password first", code: "WALLET_PIN_NOT_SET" });
    return;
  }

  const ok = await verifyWalletPin(pin, user.walletPinHash);
  if (!ok) {
    res.status(403).json({ error: "Incorrect wallet password", code: "WALLET_PIN_INVALID" });
    return;
  }

  setWalletUnlockCookie(res, userId);
  res.json({ unlocked: true });
});

// POST /api/security/wallet-pin/lock
router.post("/wallet-pin/lock", async (req, res): Promise<void> => {
  clearWalletUnlockCookie(res);
  res.json({ locked: true });
});

export default router;
