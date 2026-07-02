import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  tipsTable,
  adCampaignsTable,
  adImpressionsTable,
} from "@workspace/db";
import {
  formatGatewayPrice,
  isMockPayments,
  PaidRequest,
  requireGatewaySettlement,
} from "../lib/gateway";
import { recordTip } from "../lib/recordTip";
import { SettlementIncompleteError } from "../lib/settlementErrors";
import { activateGatewayWallet, getUserPaymentScheme } from "../lib/appWallet";
import { internalApiBase, payGatewayResource, gatewayAuthHeaders } from "../lib/gatewayPayServer";
import { resolveSellerAddress } from "../lib/settlementSeller";
import { getOrCreateUser } from "./users";

const router = Router();

function parseTipAmount(raw: unknown): number | null {
  const amount = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

// GET /api/monetization/gateway/tip — x402-protected tip (settles USDC to creator wallet)
router.get(
  "/gateway/tip",
  async (req, res, next): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const toCreatorId = req.query.toCreatorId as string | undefined;
    const amount = parseTipAmount(req.query.amount);
    if (!toCreatorId || amount == null) {
      res.status(400).json({ error: "toCreatorId and amount query params required" });
      return;
    }

    if (toCreatorId === userId) {
      res.status(400).json({ error: "Cannot tip yourself" });
      return;
    }

    if (isMockPayments()) {
      res.status(503).json({ error: "Mock payments disabled — use real Arc settlement." });
      return;
    }

    const seller = await resolveSellerAddress(toCreatorId);
    if (!seller) {
      res.status(503).json({ error: "Creator payout wallet not available" });
      return;
    }

    next();
  },
  requireGatewaySettlement(async (req) => {
    const toCreatorId = req.query.toCreatorId as string;
    const amount = parseTipAmount(req.query.amount);
    if (!toCreatorId || amount == null) return null;

    const sellerAddress = await resolveSellerAddress(toCreatorId);
    if (!sellerAddress) return null;

    return {
      price: formatGatewayPrice(amount),
      sellerAddress,
    };
  }),
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const toCreatorId = req.query.toCreatorId as string;
    const amount = parseTipAmount(req.query.amount)!;
    const message = (req.query.message as string | undefined) ?? null;
    const contentIdRaw = req.query.contentId as string | undefined;
    const contentId = contentIdRaw ? parseInt(contentIdRaw, 10) : undefined;

    const paidReq = req as PaidRequest;
    if (!paidReq.payment?.verified) {
      res.status(402).json({ error: "Payment required" });
      return;
    }

    await getOrCreateUser(userId);

    try {
      const tip = await recordTip({
        fromUserId: userId,
        toCreatorId,
        amount,
        message,
        contentId: contentId && !isNaN(contentId) ? contentId : null,
        txHash: paidReq.payment.transaction ?? null,
      });

      res.status(201).json(tip);
    } catch (err) {
      if (err instanceof SettlementIncompleteError) {
        res.status(502).json({
          error: err.message,
          code: "SETTLEMENT_INCOMPLETE",
          splitPending: true,
          retryable: true,
          hint: "Tip USDC was received. Retry in a few seconds — you will not be charged twice.",
        });
        return;
      }
      throw err;
    }
  },
);

// POST /api/monetization/tips-app — in-app wallet x402 tip
router.post("/tips-app", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { toCreatorId, amount, message, contentId } = req.body as {
    toCreatorId?: string;
    amount?: number;
    message?: string;
    contentId?: number;
  };

  if (!toCreatorId || !amount || amount <= 0) {
    res.status(400).json({ error: "toCreatorId and amount required" });
    return;
  }

  if (toCreatorId === userId) {
    res.status(400).json({ error: "Cannot tip yourself" });
    return;
  }

  if (isMockPayments()) {
    const tip = await recordTip({
      fromUserId: userId,
      toCreatorId,
      amount,
      message,
      contentId,
      txHash: `mock-tip-${Date.now()}`,
    });
    res.status(201).json(tip);
    return;
  }

  try {
    const activation = await activateGatewayWallet(userId);
    if (!activation.ready) {
      res.status(402).json({
        error: "Fund your LeptonPad wallet via Circle Gateway before tipping.",
        gatewayAvailable: activation.gatewayAvailable,
        walletBalance: activation.walletBalance,
      });
      return;
    }

    const scheme = await getUserPaymentScheme(userId);
    const params = new URLSearchParams({
      toCreatorId,
      amount: String(amount),
    });
    if (message) params.set("message", message);
    if (contentId != null) params.set("contentId", String(contentId));

    const gatewayUrl = `${internalApiBase()}/api/monetization/gateway/tip?${params}`;
    const response = await payGatewayResource(gatewayUrl, scheme, {
      headers: gatewayAuthHeaders(req),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      res.status(response.status).json(err);
      return;
    }

    const tip = await response.json();
    res.status(201).json(tip);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Tip payment failed";
    res.status(500).json({ error: msg });
  }
});

// POST /api/monetization/tips — legacy (redirects clients to tips-app)
router.post("/tips", async (req, res): Promise<void> => {
  if (!isMockPayments()) {
    res.status(402).json({
      error: "USDC tip required. Use POST /api/monetization/tips-app with your LeptonPad wallet.",
    });
    return;
  }

  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { toCreatorId, amount, message, contentId } = req.body as {
    toCreatorId?: string;
    amount?: number;
    message?: string;
    contentId?: number;
  };
  if (!toCreatorId || !amount || amount <= 0) {
    res.status(400).json({ error: "toCreatorId and amount required" });
    return;
  }

  const tip = await recordTip({
    fromUserId: userId,
    toCreatorId,
    amount,
    message,
    contentId,
    txHash: `mock-tip-${Date.now()}`,
  });
  res.status(201).json(tip);
});

router.get("/creators/:creatorId/tips", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(tipsTable)
    .where(eq(tipsTable.toCreatorId, req.params.creatorId))
    .orderBy(desc(tipsTable.createdAt))
    .limit(20);
  res.json(
    rows.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      creatorAmount: Number(t.creatorAmount ?? t.amount),
      message: t.message,
      txHash: t.txHash,
      createdAt: t.createdAt.toISOString(),
    })),
  );
});

// ─── Ads (platform revenue share — optional discovery monetization) ──────────

router.get("/ads/feed", async (req, res): Promise<void> => {
  const category = req.query.category as string | undefined;
  const rows = await db
    .select()
    .from(adCampaignsTable)
    .where(eq(adCampaignsTable.active, true))
    .orderBy(sql`random()`)
    .limit(3);

  const filtered = category
    ? rows.filter((r) => !r.categorySlug || r.categorySlug === category)
    : rows;

  res.json(
    filtered.map((a) => ({
      id: a.id,
      title: a.title,
      advertiser: a.advertiser,
      imageUrl: a.imageUrl,
      targetUrl: a.targetUrl,
    })),
  );
});

router.post("/ads/:id/impression", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { userId } = getAuth(req);
  const { clicked } = req.body as { clicked?: boolean };

  await db.insert(adImpressionsTable).values({
    campaignId: id,
    userId: userId ?? null,
    clicked: !!clicked,
  });

  if (clicked) {
    await db
      .update(adCampaignsTable)
      .set({ clickCount: sql`${adCampaignsTable.clickCount} + 1` })
      .where(eq(adCampaignsTable.id, id));
  } else {
    await db
      .update(adCampaignsTable)
      .set({ impressionCount: sql`${adCampaignsTable.impressionCount} + 1` })
      .where(eq(adCampaignsTable.id, id));
  }

  res.json({ ok: true });
});

export default router;
