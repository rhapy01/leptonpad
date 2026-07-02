import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, sql, desc } from "drizzle-orm";
import { db, contentTable, paymentsTable, aiSuggestionsTable, tipsTable } from "@workspace/db";
import { clerkClient } from "@clerk/express";
import { getSettlementRailInfo } from "../lib/settlementRail";
import { tryCompleteCreatorPendingSplits, isPendingPayment } from "../lib/recordPayment";

const router = Router();

// GET /api/earnings/summary
router.get("/summary", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [allTime] = await db
    .select({ total: sql<string>`coalesce(sum(${paymentsTable.creatorAmount}), 0)`, purchases: sql<number>`count(*)` })
    .from(paymentsTable)
    .where(eq(paymentsTable.creatorId, userId));

  const [tipStats] = await db
    .select({ total: sql<string>`coalesce(sum(${tipsTable.creatorAmount}), 0)`, tips: sql<number>`count(*)` })
    .from(tipsTable)
    .where(eq(tipsTable.toCreatorId, userId));

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [thisWeek] = await db
    .select({ total: sql<string>`coalesce(sum(${paymentsTable.creatorAmount}), 0)` })
    .from(paymentsTable)
    .where(sql`${paymentsTable.creatorId} = ${userId} and ${paymentsTable.paidAt} >= ${oneWeekAgo}`);

  const [tipsThisWeek] = await db
    .select({ total: sql<string>`coalesce(sum(${tipsTable.creatorAmount}), 0)` })
    .from(tipsTable)
    .where(sql`${tipsTable.toCreatorId} = ${userId} and ${tipsTable.createdAt} >= ${oneWeekAgo}`);

  // Conversion rate across all content
  const [viewData] = await db
    .select({ totalViews: sql<number>`coalesce(sum(${contentTable.viewCount}), 0)`, totalPurchases: sql<number>`coalesce(sum(${contentTable.purchaseCount}), 0)` })
    .from(contentTable)
    .where(eq(contentTable.creatorId, userId));

  const convRate = viewData && Number(viewData.totalViews) > 0
    ? (Number(viewData.totalPurchases) / Number(viewData.totalViews)) * 100
    : 0;

  res.json({
    totalEarnedAllTime: Number(allTime?.total ?? 0) + Number(tipStats?.total ?? 0),
    thisWeekEarnings: Number(thisWeek?.total ?? 0) + Number(tipsThisWeek?.total ?? 0),
    totalPurchases: Number(allTime?.purchases ?? 0),
    totalTips: Number(tipStats?.tips ?? 0),
    conversionRate: convRate,
  });
});

// GET /api/earnings/content
router.get("/content", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({
      id: contentTable.id,
      title: contentTable.title,
      type: contentTable.type,
      price: contentTable.price,
      viewCount: contentTable.viewCount,
      purchaseCount: contentTable.purchaseCount,
    })
    .from(contentTable)
    .where(eq(contentTable.creatorId, userId))
    .orderBy(desc(contentTable.createdAt));

  // Earnings per content
  const earnings = await db
    .select({
      contentId: paymentsTable.contentId,
      total: sql<string>`coalesce(sum(${paymentsTable.creatorAmount}), 0)`,
    })
    .from(paymentsTable)
    .where(eq(paymentsTable.creatorId, userId))
    .groupBy(paymentsTable.contentId);

  const earningsMap = Object.fromEntries(earnings.map(e => [e.contentId, Number(e.total)]));

  // AI suggestions
  const suggestions = await db
    .select({ contentId: aiSuggestionsTable.contentId })
    .from(aiSuggestionsTable)
    .where(sql`${aiSuggestionsTable.creatorId} = ${userId} AND ${aiSuggestionsTable.status} = 'pending'`);
  const suggestionSet = new Set(suggestions.map(s => s.contentId));

  const result = rows.map(r => {
    const conversionRate = r.viewCount > 0 ? (r.purchaseCount / r.viewCount) * 100 : 0;
    return {
      contentId: r.id,
      title: r.title,
      type: r.type,
      price: Number(r.price),
      views: r.viewCount,
      purchases: r.purchaseCount,
      conversionRate,
      totalEarned: earningsMap[r.id] ?? 0,
      hasSuggestion: suggestionSet.has(r.id),
    };
  });

  res.json(result);
});

// GET /api/earnings/settlement — creator settlement status on Arc
router.get("/settlement", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rail = getSettlementRailInfo();
  const rows = await db
    .select({
      splitTxHash: paymentsTable.splitTxHash,
      txHash: paymentsTable.txHash,
    })
    .from(paymentsTable)
    .where(eq(paymentsTable.creatorId, userId));

  const settled = rows.filter((r) => !!r.splitTxHash).length;
  const pending = rows.filter((r) => isPendingPayment(r)).length;

  res.json({
    ...rail,
    salesSettledOnChain: settled,
    salesPendingSplit: pending,
    totalSales: rows.length,
  });
});

// GET /api/earnings/recent
router.get("/recent", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  await tryCompleteCreatorPendingSplits(userId);

  const limit = parseInt(req.query.limit as string) || 20;

  const rows = await db
    .select({
      id: paymentsTable.id,
      contentId: paymentsTable.contentId,
      readerId: paymentsTable.readerId,
      amount: paymentsTable.amount,
      creatorAmount: paymentsTable.creatorAmount,
      paidAt: paymentsTable.paidAt,
      txHash: paymentsTable.txHash,
      splitTxHash: paymentsTable.splitTxHash,
      contentTitle: contentTable.title,
    })
    .from(paymentsTable)
    .leftJoin(contentTable, eq(paymentsTable.contentId, contentTable.id))
    .where(eq(paymentsTable.creatorId, userId))
    .orderBy(desc(paymentsTable.paidAt))
    .limit(limit);

  const readerIds = [...new Set(rows.map(r => r.readerId))];
  const nameMap: Record<string, string> = {};
  await Promise.all(
    readerIds.map(async id => {
      try {
        const u = await clerkClient.users.getUser(id);
        nameMap[id] = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || "Reader";
      } catch { nameMap[id] = "Reader"; }
    })
  );

  res.json(rows.map(r => ({
    id: r.id,
    contentId: r.contentId,
    contentTitle: r.contentTitle ?? "Untitled",
    readerName: nameMap[r.readerId] ?? "Reader",
    amount: Number(r.amount),
    creatorAmount: Number(r.creatorAmount),
    paidAt: r.paidAt.toISOString(),
    txHash: r.txHash,
    splitTxHash: r.splitTxHash,
    settlementStatus: r.splitTxHash ? "settled" : isPendingPayment(r) ? "pending" : "recorded",
  })));
});

export default router;
