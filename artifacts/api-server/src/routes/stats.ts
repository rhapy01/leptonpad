import { Router } from "express";
import { db, contentTable, paymentsTable, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

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
  });
});

export default router;
