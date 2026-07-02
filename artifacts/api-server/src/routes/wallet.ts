import { Router } from "express";
import { getAuth } from "@clerk/express";
import {
  activateGatewayWallet,
  depositToGateway,
  fundWalletFromTreasury,
  getAppWalletStatus,
  withdrawFromGateway,
} from "../lib/appWallet";
import { getOrCreateUser } from "./users";

const router = Router();

function parseAmount(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const amount = (body as { amount?: unknown }).amount;
  if (typeof amount === "number" && Number.isFinite(amount)) return String(amount);
  if (typeof amount === "string" && amount.trim()) return amount.trim();
  return null;
}

// GET /api/wallet — in-app wallet status (auto-provisions on first call)
router.get("/", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await getOrCreateUser(userId);
    const status = await getAppWalletStatus(userId);
    res.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load wallet";
    res.status(500).json({ error: message });
  }
});

// POST /api/wallet/activate — fund + deposit into Circle Gateway (testnet)
router.post("/activate", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
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

// POST /api/wallet/withdraw — move USDC from Gateway to on-chain wallet
router.post("/withdraw", async (req, res): Promise<void> => {
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
    const result = await withdrawFromGateway(userId, amount);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Withdrawal failed";
    res.status(400).json({ error: message });
  }
});

// POST /api/wallet/deposit — move on-chain USDC into Gateway for spending
router.post("/deposit", async (req, res): Promise<void> => {
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
    const result = await depositToGateway(userId, amount);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deposit failed";
    res.status(400).json({ error: message });
  }
});

// POST /api/wallet/fund — request testnet USDC from treasury to on-chain wallet
router.post("/fund", async (req, res): Promise<void> => {
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
