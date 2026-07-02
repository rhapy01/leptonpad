import { Router } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, contentTable, paymentsTable, usersTable } from "@workspace/db";
import { UnlockContentBody } from "@workspace/api-zod";
import { getOrCreateUser } from "./users";
import {
  formatGatewayPrice,
  getPaymentConfig,
  isMockPayments,
  PaidRequest,
  requireGatewaySettlement,
} from "../lib/gateway";
import { paymentGrantsAccess, isPendingPayment, recordContentPayment, toUnlockResult, tryCompletePendingSplit } from "../lib/recordPayment";
import { SettlementIncompleteError } from "../lib/settlementErrors";
import { parseGatewayAmountUsdc } from "../lib/settlementConfig";
import {
  activateGatewayWallet,
  getUserPaymentScheme,
} from "../lib/appWallet";
import { internalApiBase, payGatewayResource, gatewayAuthHeaders } from "../lib/gatewayPayServer";
import { resolveSellerAddress } from "../lib/settlementSeller";
import { getSettlementRailInfo } from "../lib/settlementRail";
import { isClientWalletMode, userUsesCustodialWallet } from "../lib/walletMode";

const router = Router();

async function loadContentPrice(contentId: number) {
  const items = await db
    .select()
    .from(contentTable)
    .where(eq(contentTable.id, contentId))
    .limit(1);
  if (!items.length) return null;
  return items[0];
}

function settlementIncompleteResponse(err: SettlementIncompleteError) {
  return {
    error: err.message,
    code: "SETTLEMENT_INCOMPLETE" as const,
    splitPending: true,
    retryable: true,
    hint: "Your USDC payment was received. The creator split is still landing on-chain — tap unlock again in a few seconds (you will not be charged twice).",
  };
}

async function retryPendingSplit(
  contentId: number,
  readerId: string,
  txHash: string | null,
  amountUsdc?: number,
) {
  return recordContentPayment({
    contentId,
    readerId,
    txHash,
    amountUsdc,
  });
}

// GET /api/payments/settlement — Arc settlement rail (x402 → LeptonSplit)
router.get("/settlement", (_req, res): void => {
  res.json(getSettlementRailInfo());
});

// GET /api/payments/config — public payment rail configuration for the frontend
router.get("/config", (_req, res): void => {
  const config = getPaymentConfig();
  res.json({
    enabled: config.enabled,
    mockMode: config.mockMode,
    chainId: config.chainId,
    network: config.network,
    chainName: config.chainName,
    facilitatorUrl: config.facilitatorUrl,
    sellerAddress: config.sellerAddress,
    minPrice: 0.000001,
    creatorShare: 0.95,
    inAppWallet: true,
    clientSideWallet: isClientWalletMode(),
  });
});

// GET /api/payments/gateway/:contentId — x402-protected unlock (Circle Gateway nanopayments)
router.get(
  "/gateway/:contentId",
  async (req, res, next): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const rawId = Array.isArray(req.params.contentId)
      ? req.params.contentId[0]
      : req.params.contentId;
    const contentId = parseInt(rawId, 10);
    if (isNaN(contentId)) {
      res.status(400).json({ error: "Invalid contentId" });
      return;
    }

    const content = await loadContentPrice(contentId);
    if (!content) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const price = Number(content.price);

    if (price === 0 || content.creatorId === userId) {
      await getOrCreateUser(userId);
      res.json({
        success: true,
        paymentId: 0,
        contentId,
        amountPaid: 0,
        creatorReceives: 0,
        settledAt: new Date().toISOString(),
        free: true,
      });
      return;
    }

    const existing = await db
      .select()
      .from(paymentsTable)
      .where(
        and(eq(paymentsTable.contentId, contentId), eq(paymentsTable.readerId, userId)),
      )
      .limit(1);

    if (existing.length > 0 && paymentGrantsAccess(existing[0])) {
      res.json(
        toUnlockResult({
          paymentId: existing[0].id,
          contentId,
          amountPaid: Number(existing[0].amount),
          creatorReceives: Number(existing[0].creatorAmount),
          settledAt: existing[0].paidAt.toISOString(),
          alreadyExisted: true,
          txHash: existing[0].txHash,
          splitTxHash: existing[0].splitTxHash,
        }),
      );
      return;
    }

    if (existing.length > 0 && isPendingPayment(existing[0])) {
      await getOrCreateUser(userId);
      try {
        const recorded = await retryPendingSplit(
          contentId,
          userId,
          existing[0].txHash,
          Number(existing[0].amount),
        );
        if (!recorded) {
          res.status(404).json({ error: "Content not found" });
          return;
        }
        res.json(toUnlockResult(recorded));
      } catch (err) {
        if (err instanceof SettlementIncompleteError) {
          res.status(502).json(settlementIncompleteResponse(err));
          return;
        }
        throw err;
      }
      return;
    }

    if (isMockPayments()) {
      res.status(503).json({
        error:
          "Payments are not configured. Set MOCK_PAYMENTS=false and configure GATEWAY_SELLER_ADDRESS + TREASURY_PRIVATE_KEY.",
      });
      return;
    }

    const seller = await resolveSellerAddress(content.creatorId);
    if (!seller) {
      res.status(503).json({
        error:
          "Arc settlement not configured. Set GATEWAY_SELLER_ADDRESS in .env (platform wallet for seed content).",
      });
      return;
    }

    next();
  },
  requireGatewaySettlement(async (req) => {
    const rawId = Array.isArray(req.params.contentId)
      ? req.params.contentId[0]
      : req.params.contentId;
    const contentId = parseInt(rawId, 10);
    const content = await loadContentPrice(contentId);
    if (!content) return null;
    const price = Number(content.price);
    if (price <= 0) return null;

    const sellerAddress = await resolveSellerAddress(content.creatorId);
    if (!sellerAddress) return null;

    return {
      price: formatGatewayPrice(price),
      sellerAddress,
    };
  }),
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const rawId = Array.isArray(req.params.contentId)
      ? req.params.contentId[0]
      : req.params.contentId;
    const contentId = parseInt(rawId, 10);

    const paidReq = req as PaidRequest;
    const payment = paidReq.payment;

    if (!payment?.verified) {
      res.status(402).json({ error: "Payment required" });
      return;
    }

    await getOrCreateUser(userId);

    const price = Number((await loadContentPrice(contentId))?.price ?? 0);

    const settlementRef =
      payment.transaction ??
      `gw-${contentId}-${userId}-${payment.payer}-${payment.amount}`;

    try {
      const recorded = await recordContentPayment({
        contentId,
        readerId: userId,
        txHash: settlementRef,
        amountUsdc: parseGatewayAmountUsdc(payment.amount, price),
      });

      if (!recorded) {
        res.status(404).json({ error: "Content not found" });
        return;
      }

      res.json(toUnlockResult(recorded));
    } catch (err) {
      if (err instanceof SettlementIncompleteError) {
        res.status(502).json(settlementIncompleteResponse(err));
        return;
      }
      throw err;
    }
  },
);

// POST /api/payments/unlock-app/:contentId — in-app wallet x402 unlock (no MetaMask)
router.post("/unlock-app/:contentId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rawId = Array.isArray(req.params.contentId)
    ? req.params.contentId[0]
    : req.params.contentId;
  const contentId = parseInt(rawId, 10);
  if (isNaN(contentId)) {
    res.status(400).json({ error: "Invalid contentId" });
    return;
  }

  const content = await loadContentPrice(contentId);
  if (!content) {
    res.status(404).json({ error: "Content not found" });
    return;
  }

  const price = Number(content.price);

  if (price === 0 || content.creatorId === userId) {
    await getOrCreateUser(userId);
    res.json({
      success: true,
      paymentId: 0,
      contentId,
      amountPaid: 0,
      creatorReceives: 0,
      settledAt: new Date().toISOString(),
      free: true,
    });
    return;
  }

  const existing = await db
    .select()
    .from(paymentsTable)
    .where(
      and(eq(paymentsTable.contentId, contentId), eq(paymentsTable.readerId, userId)),
    )
    .limit(1);

  if (existing.length > 0 && paymentGrantsAccess(existing[0])) {
    res.json(
      toUnlockResult({
        paymentId: existing[0].id,
        contentId,
        amountPaid: Number(existing[0].amount),
        creatorReceives: Number(existing[0].creatorAmount),
        settledAt: existing[0].paidAt.toISOString(),
        alreadyExisted: true,
        txHash: existing[0].txHash,
        splitTxHash: existing[0].splitTxHash,
      }),
    );
    return;
  }

  if (existing.length > 0 && isPendingPayment(existing[0])) {
    await getOrCreateUser(userId);
    try {
      const recorded = await retryPendingSplit(
        contentId,
        userId,
        existing[0].txHash,
        Number(existing[0].amount),
      );
      if (!recorded) {
        res.status(404).json({ error: "Content not found" });
        return;
      }
      res.json(toUnlockResult(recorded));
    } catch (err) {
      if (err instanceof SettlementIncompleteError) {
        res.status(502).json(settlementIncompleteResponse(err));
        return;
      }
      throw err;
    }
    return;
  }

  if (isMockPayments()) {
    await getOrCreateUser(userId);
    const recorded = await recordContentPayment({
      contentId,
      readerId: userId,
      txHash: `mock-${Date.now()}`,
    });
    if (!recorded) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    res.json(toUnlockResult(recorded));
    return;
  }

  try {
    const [userRow] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId))
      .limit(1);

    if (isClientWalletMode() && userRow && !userUsesCustodialWallet(userRow)) {
      res.status(400).json({
        error: "Pay with your in-browser wallet — private keys never leave your device",
        clientSide: true,
        gatewayUrl: `/api/payments/gateway/${contentId}`,
      });
      return;
    }

    const activation = await activateGatewayWallet(userId);
    if (!activation.ready) {
      res.status(402).json({
        error:
          "Your LeptonPad wallet needs test USDC in Circle Gateway. Try again in a few seconds.",
        gatewayAvailable: activation.gatewayAvailable,
        walletBalance: activation.walletBalance,
      });
      return;
    }

    const scheme = await getUserPaymentScheme(userId);
    const gatewayUrl = `${internalApiBase()}/api/payments/gateway/${contentId}`;
    const response = await payGatewayResource(gatewayUrl, scheme, {
      headers: gatewayAuthHeaders(req),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      res.status(response.status).json(err);
      return;
    }

    const result = await response.json();
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment failed";
    res.status(500).json({ error: message });
  }
});

// POST /api/payments/unlock — legacy unlock (free content, mock mode, or post-gateway fallback)
router.post("/unlock", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UnlockContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { contentId, txHash } = parsed.data;

  const content = await loadContentPrice(contentId);
  if (!content) {
    res.status(404).json({ error: "Content not found" });
    return;
  }

  const price = Number(content.price);

  if (price === 0 || content.creatorId === userId) {
    res.json({
      success: true,
      paymentId: 0,
      contentId,
      amountPaid: 0,
      creatorReceives: 0,
      settledAt: new Date().toISOString(),
    });
    return;
  }

  const existing = await db
    .select()
    .from(paymentsTable)
    .where(
      and(eq(paymentsTable.contentId, contentId), eq(paymentsTable.readerId, userId)),
    )
    .limit(1);

  if (existing.length > 0 && paymentGrantsAccess(existing[0])) {
    res.json({
      success: true,
      paymentId: existing[0].id,
      contentId,
      amountPaid: Number(existing[0].amount),
      creatorReceives: Number(existing[0].creatorAmount),
      settledAt: existing[0].paidAt.toISOString(),
      splitTxHash: existing[0].splitTxHash,
    });
    return;
  }

  // Paid content requires real Gateway settlement unless mock mode is enabled
  if (!isMockPayments()) {
    res.status(402).json({
      error:
        "USDC payment required. Use POST /api/payments/unlock-app/:contentId with your LeptonPad in-app wallet.",
      gatewayUrl: `/api/payments/gateway/${contentId}`,
    });
    return;
  }

  if (!txHash && process.env.MOCK_PAYMENTS !== "true") {
    res.status(400).json({ error: "txHash required in mock mode" });
    return;
  }

  await getOrCreateUser(userId);

  const recorded = await recordContentPayment({
    contentId,
    readerId: userId,
    txHash: txHash ?? `mock-${Date.now()}`,
  });

  if (!recorded) {
    res.status(404).json({ error: "Content not found" });
    return;
  }

  res.json(toUnlockResult(recorded));
});

// POST /api/payments/retry-split/:contentId — finish pending split without charging again
router.post("/retry-split/:contentId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rawId = Array.isArray(req.params.contentId)
    ? req.params.contentId[0]
    : req.params.contentId;
  const contentId = parseInt(rawId, 10);
  if (isNaN(contentId)) {
    res.status(400).json({ error: "Invalid contentId" });
    return;
  }

  const existing = await db
    .select()
    .from(paymentsTable)
    .where(
      and(eq(paymentsTable.contentId, contentId), eq(paymentsTable.readerId, userId)),
    )
    .limit(1);

  if (!existing.length || !isPendingPayment(existing[0])) {
    res.status(404).json({ error: "No pending settlement to retry" });
    return;
  }

  await getOrCreateUser(userId);

  try {
    const recorded = await retryPendingSplit(
      contentId,
      userId,
      existing[0].txHash,
      Number(existing[0].amount),
    );
    if (!recorded) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    res.json(toUnlockResult(recorded));
  } catch (err) {
    if (err instanceof SettlementIncompleteError) {
      res.status(502).json(settlementIncompleteResponse(err));
      return;
    }
    throw err;
  }
});

// GET /api/payments/check/:contentId
router.get("/check/:contentId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);

  const rawId = Array.isArray(req.params.contentId)
    ? req.params.contentId[0]
    : req.params.contentId;
  const contentId = parseInt(rawId, 10);
  if (isNaN(contentId)) {
    res.status(400).json({ error: "Invalid contentId" });
    return;
  }

  const content = await loadContentPrice(contentId);
  if (!content) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (Number(content.price) === 0) {
    res.json({ hasAccess: true, paymentId: null });
    return;
  }

  if (!userId) {
    res.json({ hasAccess: false, paymentId: null });
    return;
  }

  if (content.creatorId === userId) {
    res.json({ hasAccess: true, paymentId: null });
    return;
  }

  const payment = await db
    .select()
    .from(paymentsTable)
    .where(
      and(eq(paymentsTable.contentId, contentId), eq(paymentsTable.readerId, userId)),
    )
    .limit(1);

  if (payment.length > 0 && isPendingPayment(payment[0])) {
    await tryCompletePendingSplit(contentId, userId);
    const refreshed = await db
      .select()
      .from(paymentsTable)
      .where(
        and(eq(paymentsTable.contentId, contentId), eq(paymentsTable.readerId, userId)),
      )
      .limit(1);
    if (refreshed.length) {
      payment[0] = refreshed[0];
    }
  }

  res.json({
    hasAccess: payment.length > 0 && paymentGrantsAccess(payment[0]),
    paymentId: payment[0]?.id ?? null,
    splitPending: payment.length > 0 && isPendingPayment(payment[0]),
    splitTxHash: payment[0]?.splitTxHash ?? null,
    txHash: payment[0]?.txHash ?? null,
  });
});

export default router;
