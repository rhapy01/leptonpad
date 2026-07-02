import { Router } from "express";
import { db, contentTable, paymentsTable, usersTable } from "@workspace/db";
import { sql, desc, eq } from "drizzle-orm";

const router = Router();

// GET /api/stats/platform
router.get("/platform", async (_req, res): Promise<void> => {
  const [paymentStats] = await db
    .select({
      totalUsdcPaid: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)`,
      totalPayments: sql<number>`count(*)`,
    })
    .from(paymentsTable);

  const [contentStats] = await db
    .select({ totalContent: sql<number>`count(*)` })
    .from(contentTable);

  const [userStats] = await db
    .select({ totalUsers: sql<number>`count(*)` })
    .from(usersTable);

  res.json({
    totalUsdcPaid: Number(paymentStats?.totalUsdcPaid ?? 0),
    totalPayments: Number(paymentStats?.totalPayments ?? 0),
    totalContent: Number(contentStats?.totalContent ?? 0),
    totalCreators: Number(userStats?.totalUsers ?? 0),
    since: "2026-06-15T00:00:00.000Z",
  });
});

// GET /api/stats/recent-activity — real purchase events only
router.get("/recent-activity", async (_req, res): Promise<void> => {
  const realPayments = await db
    .select({
      contentTitle: contentTable.title,
      amount: paymentsTable.amount,
      paidAt: paymentsTable.paidAt,
      creatorName: usersTable.name,
      creatorVerified: usersTable.verified,
    })
    .from(paymentsTable)
    .leftJoin(contentTable, sql`${paymentsTable.contentId} = ${contentTable.id}`)
    .leftJoin(usersTable, eq(contentTable.creatorId, usersTable.clerkId))
    .orderBy(desc(paymentsTable.paidAt))
    .limit(8);

  const events: {
    contentTitle: string;
    amount: number;
    creatorName: string;
    creatorVerified: boolean;
    secondsAgo: number;
  }[] = realPayments.map(p => ({
    contentTitle: p.contentTitle ?? "Untitled",
    amount: Number(p.amount),
    creatorName: p.creatorName ?? "Creator",
    creatorVerified: p.creatorVerified ?? false,
    secondsAgo: Math.floor((Date.now() - p.paidAt.getTime()) / 1000),
  }));

  res.json({ events });
});

export default router;
