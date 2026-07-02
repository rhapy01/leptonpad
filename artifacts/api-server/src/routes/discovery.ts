import { Router } from "express";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { db, contentTable } from "@workspace/db";
import { publishDueScheduledContent } from "../lib/publishScheduled";
import { enrichContent } from "../lib/enrichContent";

const router = Router();

// GET /api/discovery/trending?period=today|week|all
router.get("/trending", async (req, res): Promise<void> => {
  await publishDueScheduledContent();

  const period = (req.query.period as string) ?? "week";
  const now = new Date();
  let since: Date | null = null;
  if (period === "today") {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "week") {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const conditions = [eq(contentTable.published, true)];
  if (since) {
    conditions.push(gte(contentTable.createdAt, since));
  }

  const rows = await db.select().from(contentTable)
    .where(and(...conditions))
    .orderBy(
      desc(sql`(${contentTable.purchaseCount} * 3 + ${contentTable.viewCount} + ${contentTable.bookmarkCount} * 2 + ${contentTable.reactionCount})`),
      desc(contentTable.createdAt),
    )
    .limit(24);

  res.json(await enrichContent(rows));
});

// GET /api/discovery/most-bookmarked
router.get("/most-bookmarked", async (_req, res): Promise<void> => {
  const rows = await db.select().from(contentTable)
    .where(eq(contentTable.published, true))
    .orderBy(desc(contentTable.bookmarkCount), desc(contentTable.viewCount))
    .limit(24);
  res.json(await enrichContent(rows));
});

// GET /api/discovery/by-country/:country
router.get("/by-country/:country", async (req, res): Promise<void> => {
  const country = req.params.country;
  const rows = await db.select().from(contentTable)
    .where(and(eq(contentTable.published, true), eq(contentTable.country, country)))
    .orderBy(desc(contentTable.purchaseCount))
    .limit(24);
  res.json(await enrichContent(rows));
});

// GET /api/discovery/tags/:tag
router.get("/tags/:tag", async (req, res): Promise<void> => {
  const tag = req.params.tag.toLowerCase();
  const rows = await db.select().from(contentTable)
    .where(and(
      eq(contentTable.published, true),
      sql`${tag} = ANY(${contentTable.tags})`,
    ))
    .orderBy(desc(contentTable.createdAt))
    .limit(24);
  res.json(await enrichContent(rows));
});

// GET /api/discovery/personalized — requires auth via optional clerk
router.get("/personalized", async (req, res): Promise<void> => {
  const { getAuth } = await import("@clerk/express");
  const { userId } = getAuth(req);

  if (!userId) {
    const rows = await db.select().from(contentTable)
      .where(eq(contentTable.published, true))
      .orderBy(desc(contentTable.purchaseCount))
      .limit(12);
    res.json({ items: await enrichContent(rows), reason: "popular" });
    return;
  }

  const { getOrCreateUser } = await import("./users");
  const { followsTable } = await import("@workspace/db");
  const { inArray, or } = await import("drizzle-orm");

  const user = await getOrCreateUser(userId);
  const followRows = await db.select({ creatorId: followsTable.creatorId })
    .from(followsTable).where(eq(followsTable.followerId, userId));
  const followedIds = followRows.map(f => f.creatorId);
  const categories = user.selectedCategories ?? [];

  let rows;
  if (categories.length > 0 || followedIds.length > 0) {
    const ors = [];
    if (categories.length) ors.push(inArray(contentTable.categorySlug, categories));
    if (followedIds.length) ors.push(inArray(contentTable.creatorId, followedIds));
    rows = await db.select().from(contentTable)
      .where(and(eq(contentTable.published, true), or(...ors)!))
      .orderBy(desc(contentTable.createdAt))
      .limit(24);
  } else {
    rows = await db.select().from(contentTable)
      .where(eq(contentTable.published, true))
      .orderBy(desc(contentTable.purchaseCount))
      .limit(12);
  }

  res.json({ items: await enrichContent(rows), reason: "interests_and_follows" });
});

export default router;
