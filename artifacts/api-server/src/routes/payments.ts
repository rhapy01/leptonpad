import { Router } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, contentTable, paymentsTable } from "@workspace/db";
import { UnlockContentBody, CheckContentAccessParams } from "@workspace/api-zod";
import { getOrCreateUser } from "./users";

const router = Router();

// POST /api/payments/unlock
router.post("/unlock", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = UnlockContentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { contentId, txHash } = parsed.data;

  const items = await db.select().from(contentTable).where(eq(contentTable.id, contentId)).limit(1);
  if (!items.length) { res.status(404).json({ error: "Content not found" }); return; }

  const content = items[0];
  const price = Number(content.price);

  if (price === 0) {
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

  // Check if already paid
  const existing = await db.select().from(paymentsTable)
    .where(and(eq(paymentsTable.contentId, contentId), eq(paymentsTable.readerId, userId)))
    .limit(1);

  if (existing.length > 0) {
    res.json({
      success: true,
      paymentId: existing[0].id,
      contentId,
      amountPaid: Number(existing[0].amount),
      creatorReceives: Number(existing[0].creatorAmount),
      settledAt: existing[0].paidAt.toISOString(),
    });
    return;
  }

  await getOrCreateUser(userId);

  const creatorAmount = price * 0.95;
  const platformAmount = price * 0.05;

  const [payment] = await db.insert(paymentsTable).values({
    contentId,
    readerId: userId,
    creatorId: content.creatorId,
    amount: String(price),
    creatorAmount: String(creatorAmount),
    platformAmount: String(platformAmount),
    txHash: txHash ?? null,
  }).returning();

  // Increment purchase count
  await db.update(contentTable)
    .set({ purchaseCount: content.purchaseCount + 1 })
    .where(eq(contentTable.id, contentId));

  res.json({
    success: true,
    paymentId: payment.id,
    contentId,
    amountPaid: Number(payment.amount),
    creatorReceives: Number(payment.creatorAmount),
    settledAt: payment.paidAt.toISOString(),
  });
});

// GET /api/payments/check/:contentId
router.get("/check/:contentId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);

  const rawId = Array.isArray(req.params.contentId) ? req.params.contentId[0] : req.params.contentId;
  const contentId = parseInt(rawId, 10);
  if (isNaN(contentId)) { res.status(400).json({ error: "Invalid contentId" }); return; }

  if (!userId) {
    res.json({ hasAccess: false, paymentId: null });
    return;
  }

  const items = await db.select().from(contentTable).where(eq(contentTable.id, contentId)).limit(1);
  if (!items.length) { res.status(404).json({ error: "Not found" }); return; }

  const content = items[0];

  // Free content or creator
  if (Number(content.price) === 0 || content.creatorId === userId) {
    res.json({ hasAccess: true, paymentId: null });
    return;
  }

  const payment = await db.select().from(paymentsTable)
    .where(and(eq(paymentsTable.contentId, contentId), eq(paymentsTable.readerId, userId)))
    .limit(1);

  res.json({
    hasAccess: payment.length > 0,
    paymentId: payment[0]?.id ?? null,
  });
});

export default router;
