import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { db, contentTable, usersTable, paymentsTable } from "@workspace/db";
import { getOrCreateUser } from "./users";

const router = Router();

// GET /api/intelligence/overview — content intelligence for creators
router.get("/overview", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  await getOrCreateUser(userId);

  const myContent = await db.select().from(contentTable).where(eq(contentTable.creatorId, userId));
  const myCategories = [...new Set(myContent.map(c => c.categorySlug))];
  const myTags = [...new Set(myContent.flatMap(c => c.tags ?? []))];

  // Trending tags platform-wide (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentContent = await db.select().from(contentTable)
    .where(and(eq(contentTable.published, true), gte(contentTable.createdAt, thirtyDaysAgo)));

  const tagDemand: Record<string, { count: number; purchases: number; views: number }> = {};
  for (const c of recentContent) {
    for (const tag of c.tags ?? []) {
      if (!tagDemand[tag]) tagDemand[tag] = { count: 0, purchases: 0, views: 0 };
      tagDemand[tag].count++;
      tagDemand[tag].purchases += c.purchaseCount;
      tagDemand[tag].views += c.viewCount;
    }
  }

  const risingTags = Object.entries(tagDemand)
    .map(([tag, stats]) => ({ tag, ...stats, score: stats.purchases * 3 + stats.views }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Underserved: high demand tags creator hasn't used
  const myTagSet = new Set(myTags);
  const underservedTags = risingTags.filter(t => !myTagSet.has(t.tag)).slice(0, 5);

  // Category performance
  const categoryStats: Record<string, { pieces: number; views: number; purchases: number; revenue: number }> = {};
  for (const c of myContent) {
    if (!categoryStats[c.categorySlug]) {
      categoryStats[c.categorySlug] = { pieces: 0, views: 0, purchases: 0, revenue: 0 };
    }
    categoryStats[c.categorySlug].pieces++;
    categoryStats[c.categorySlug].views += c.viewCount;
    categoryStats[c.categorySlug].purchases += c.purchaseCount;
    categoryStats[c.categorySlug].revenue += c.purchaseCount * Number(c.price);
  }

  // Best performing content
  const topContent = [...myContent]
    .sort((a, b) => (b.purchaseCount * Number(b.price)) - (a.purchaseCount * Number(a.price)))
    .slice(0, 5)
    .map(c => ({
      id: c.id,
      title: c.title,
      conversionRate: c.viewCount > 0 ? ((c.purchaseCount / c.viewCount) * 100).toFixed(1) : "0",
      revenue: (c.purchaseCount * Number(c.price)).toFixed(4),
      views: c.viewCount,
    }));

  // Geographic interest
  const countryInterest: Record<string, number> = {};
  for (const c of recentContent) {
    if (c.country) {
      countryInterest[c.country] = (countryInterest[c.country] ?? 0) + c.purchaseCount + c.viewCount;
    }
  }
  const topCountries = Object.entries(countryInterest)
    .map(([country, score]) => ({ country, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  // Publishing time analysis (hour of day for creator's best performers)
  const hourPerformance: Record<number, { count: number; purchases: number }> = {};
  for (const c of myContent.filter(c => c.purchaseCount > 0)) {
    const hour = c.createdAt.getUTCHours();
    if (!hourPerformance[hour]) hourPerformance[hour] = { count: 0, purchases: 0 };
    hourPerformance[hour].count++;
    hourPerformance[hour].purchases += c.purchaseCount;
  }
  const bestHours = Object.entries(hourPerformance)
    .map(([hour, stats]) => ({ hour: Number(hour), ...stats }))
    .sort((a, b) => b.purchases - a.purchases)
    .slice(0, 3);

  // Content gaps: categories with high platform demand but creator has few pieces
  const platformCategoryDemand: Record<string, number> = {};
  for (const c of recentContent) {
    platformCategoryDemand[c.categorySlug] = (platformCategoryDemand[c.categorySlug] ?? 0) + c.purchaseCount;
  }
  const myCategoryCounts = Object.fromEntries(
    myCategories.map(cat => [cat, myContent.filter(c => c.categorySlug === cat).length]),
  );
  const contentGaps = Object.entries(platformCategoryDemand)
    .filter(([cat]) => (myCategoryCounts[cat] ?? 0) < 2)
    .map(([category, demand]) => ({ category, demand, yourPieces: myCategoryCounts[category] ?? 0 }))
    .sort((a, b) => b.demand - a.demand)
    .slice(0, 5);

  // Predicted engagement heuristic for next piece
  const avgConversion = myContent.length
    ? myContent.reduce((s, c) => s + (c.viewCount > 0 ? c.purchaseCount / c.viewCount : 0), 0) / myContent.length
    : 0.08;

  type Recommendation = {
    type: "topic" | "category" | "timing";
    title: string;
    reason: string;
    priority: "high" | "medium" | "low";
  };

  const recommendations: Recommendation[] = [
    ...underservedTags.map(t => ({
      type: "topic" as const,
      title: `Write about "${t.tag}"`,
      reason: `${t.count} recent pieces, ${t.purchases} purchases — you haven't covered this tag yet.`,
      priority: "high" as const,
    })),
    ...contentGaps.slice(0, 2).map(g => ({
      type: "category" as const,
      title: `More in ${g.category}`,
      reason: `High reader demand (${g.demand} purchases) but you only have ${g.yourPieces} piece(s).`,
      priority: "medium" as const,
    })),
  ];

  if (bestHours.length) {
    recommendations.push({
      type: "timing" as const,
      title: `Publish around ${bestHours[0].hour}:00 UTC`,
      reason: `Your best-performing pieces were published near this hour.`,
      priority: "low" as const,
    });
  }

  res.json({
    summary: {
      totalPieces: myContent.length,
      totalViews: myContent.reduce((s, c) => s + c.viewCount, 0),
      totalPurchases: myContent.reduce((s, c) => s + c.purchaseCount, 0),
      avgConversionRate: (avgConversion * 100).toFixed(1),
    },
    risingTags,
    underservedTags,
    categoryStats,
    topContent,
    topCountries,
    bestPublishHours: bestHours,
    contentGaps,
    recommendations,
  });
});

// GET /api/intelligence/export — export creator content as JSON
router.get("/export", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db.select().from(contentTable).where(eq(contentTable.creatorId, userId));
  const user = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);

  res.json({
    exportedAt: new Date().toISOString(),
    creator: user[0] ? {
      name: user[0].name,
      bio: user[0].bio,
      website: user[0].website,
      country: user[0].country,
    } : null,
    content: rows.map(r => ({
      id: r.id,
      title: r.title,
      type: r.type,
      categorySlug: r.categorySlug,
      body: r.body,
      previewText: r.previewText,
      tags: r.tags,
      price: Number(r.price),
      status: r.status,
      published: r.published,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

export default router;
