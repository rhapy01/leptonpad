import { Router } from "express";
import { getAuth } from "@clerk/express";
import { verifyMessage, isAddress, type Address, type Hex } from "viem";
import {
  activateGatewayWallet,
  depositToGateway,
  fundWalletFromTreasury,
  getAppWalletStatus,
  withdrawFromGateway,
  registerClientWalletAddress,
  markClientGatewayReady,
  exportLegacyWalletKey,
} from "../lib/appWallet";
import { getOrCreateUser } from "./users";
import { walletFundRateLimit } from "../middlewares/rateLimit";
import { isClientWalletMode } from "../lib/walletMode";
import { requireTrustedDevice, requireWalletUnlock } from "../middlewares/deviceSecurity";
import { isWalletUnlocked } from "../lib/walletSession";

const router = Router();

const REGISTER_TTL_MS = 5 * 60 * 1000;

function registrationMessage(clerkId: string, timestamp: number): string {
  return `LeptonPad wallet registration\nclerkId:${clerkId}\ntimestamp:${timestamp}`;
}

function parseAmount(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const amount = (body as { amount?: unknown }).amount;
  if (typeof amount === "number" && Number.isFinite(amount)) return String(amount);
  if (typeof amount === "string" && amount.trim()) return amount.trim();
  return null;
}

// GET /api/wallet — wallet status (address only for client-side wallets)
router.get("/", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await getOrCreateUser(userId);
    const status = await getAppWalletStatus(userId);
    if (!isWalletUnlocked(req, userId)) {
      const addr = status.address;
      res.json({
        locked: true,
        address: addr,
        addressMasked: addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : null,
        gatewayReady: status.gatewayReady,
        mockMode: status.mockMode,
        clientSide: status.clientSide,
      });
      return;
    }
    res.json({ ...status, locked: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load wallet";
    res.status(500).json({ error: message });
  }
});

// POST /api/wallet/register — link browser-generated address (signature proves ownership)
router.post("/register", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!isClientWalletMode()) {
    res.status(400).json({ error: "Server wallet mode is custodial — client registration disabled" });
    return;
  }

  const { address, signature, timestamp } = req.body as {
    address?: string;
    signature?: Hex;
    timestamp?: number;
  };

  if (!address || !isAddress(address)) {
    res.status(400).json({ error: "Valid address required" });
    return;
  }
  if (!signature || typeof timestamp !== "number") {
    res.status(400).json({ error: "signature and timestamp required" });
    return;
  }
  if (Math.abs(Date.now() - timestamp) > REGISTER_TTL_MS) {
    res.status(400).json({ error: "Registration signature expired — try again" });
    return;
  }

  const message = registrationMessage(userId, timestamp);
  const valid = await verifyMessage({
    address: address as Address,
    message,
    signature,
  });
  if (!valid) {
    res.status(403).json({ error: "Invalid wallet signature" });
    return;
  }

  try {
    await getOrCreateUser(userId);
    const user = await registerClientWalletAddress(userId, address as Address);
    res.json({
      address: user.walletAddress,
      clientSide: true,
      registered: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    res.status(409).json({ error: message });
  }
});

// POST /api/wallet/export-legacy-key — one-time migration from custodial to client wallet
router.post("/export-legacy-key", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!isClientWalletMode()) {
    res.status(404).json({ error: "Not available" });
    return;
  }

  const exported = await exportLegacyWalletKey(userId);
  if (!exported) {
    res.status(404).json({ error: "No server-stored wallet to migrate" });
    return;
  }

  res.json(exported);
});

// POST /api/wallet/gateway-ready — client reports successful Gateway activation
router.post("/gateway-ready", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await getOrCreateUser(userId);
  await markClientGatewayReady(userId);
  res.json({ ready: true });
});

// POST /api/wallet/activate — custodial only; client wallets activate in the browser
router.post("/activate", requireTrustedDevice, requireWalletUnlock, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (isClientWalletMode()) {
    res.status(400).json({
      error: "Wallet activation runs in your browser — private keys never leave your device",
      clientSide: true,
    });
    return;
  }

  await getOrCreateUser(userId);

  try {
    const result = await activateGatewayWallet(userId);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Activation failed";
    res.status(500).json({ error: message });
  }
});

router.post("/withdraw", requireTrustedDevice, requireWalletUnlock, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (isClientWalletMode()) {
    res.status(400).json({ error: "Withdraw in the browser — keys stay on your device", clientSide: true });
    return;
  }

  const amount = parseAmount(req.body);
  if (!amount) {
    res.status(400).json({ error: "amount is required" });
    return;
  }

  await getOrCreateUser(userId);

  try {
    const result = await withdrawFromGateway(userId, amount);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Withdrawal failed";
    res.status(400).json({ error: message });
  }
});

router.post("/deposit", requireTrustedDevice, requireWalletUnlock, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (isClientWalletMode()) {
    res.status(400).json({ error: "Deposit in the browser — keys stay on your device", clientSide: true });
    return;
  }

  const amount = parseAmount(req.body);
  if (!amount) {
    res.status(400).json({ error: "amount is required" });
    return;
  }

  await getOrCreateUser(userId);

  try {
    const result = await depositToGateway(userId, amount);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deposit failed";
    res.status(400).json({ error: message });
  }
});

// POST /api/wallet/fund — treasury top-up (address only; no private key needed)
router.post("/fund", walletFundRateLimit, requireTrustedDevice, requireWalletUnlock, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const amount = parseAmount(req.body);
  if (!amount) {
    res.status(400).json({ error: "amount is required" });
    return;
  }

  await getOrCreateUser(userId);

  try {
    const result = await fundWalletFromTreasury(userId, amount);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Top-up failed";
    res.status(400).json({ error: message });
  }
});

export default router;
