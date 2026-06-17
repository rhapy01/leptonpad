import { Router } from "express";
import { db, contentTable, paymentsTable, usersTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";

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

// Demo creator names for synthetic activity events
const DEMO_CREATORS = ["Mara Chen", "Oliver Voss", "Priya Nair", "Jalen Moore", "Sofía Reyes", "Kai Tanaka", "Amara Diallo", "Finn Larsen"];

// GET /api/stats/recent-activity
// Returns recent purchase events (real + synthetic demo fill)
router.get("/recent-activity", async (_req, res): Promise<void> => {
  // Real payments
  const realPayments = await db
    .select({
      contentTitle: contentTable.title,
      amount: paymentsTable.amount,
      paidAt: paymentsTable.paidAt,
    })
    .from(paymentsTable)
    .leftJoin(contentTable, sql`${paymentsTable.contentId} = ${contentTable.id}`)
    .orderBy(desc(paymentsTable.paidAt))
    .limit(8);

  const events: { contentTitle: string; amount: number; creatorName: string; secondsAgo: number }[] = realPayments.map(p => ({
    contentTitle: p.contentTitle ?? "Untitled",
    amount: Number(p.amount),
    creatorName: DEMO_CREATORS[Math.floor(Math.random() * DEMO_CREATORS.length)],
    secondsAgo: Math.floor((Date.now() - p.paidAt.getTime()) / 1000),
  }));

  // Fill in with synthetic demo events so the ticker always has content
  const syntheticPieces = await db
    .select({ id: contentTable.id, title: contentTable.title, price: contentTable.price })
    .from(contentTable)
    .where(sql`${contentTable.price}::numeric > 0`)
    .limit(10);

  if (syntheticPieces.length > 0 && events.length < 10) {
    const needed = 10 - events.length;
    for (let i = 0; i < needed; i++) {
      const piece = syntheticPieces[i % syntheticPieces.length];
      events.push({
        contentTitle: piece.title,
        amount: Number(piece.price),
        creatorName: DEMO_CREATORS[(i + events.length) % DEMO_CREATORS.length],
        secondsAgo: (i + 1) * 47 + Math.floor(Math.random() * 60),
      });
    }
  }

  res.json({ events });
});

export default router;
