import { Router } from "express";
import { getAuth } from "@clerk/express";
import { and, eq, inArray, desc, or } from "drizzle-orm";
import { db, contentTable, paymentsTable, followsTable } from "@workspace/db";
import { getOrCreateUser } from "./users";
import { enrichContent } from "../lib/enrichContent";
import { paymentGrantsAccess } from "../lib/recordPayment";

const router = Router();

// GET /api/dashboard/following — followed creators + category interests
router.get("/following", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getOrCreateUser(userId);
  const categories = user.selectedCategories ?? [];

  const followRows = await db
    .select({ creatorId: followsTable.creatorId })
    .from(followsTable)
    .where(eq(followsTable.followerId, userId));

  const followedCreators = followRows.map(f => f.creatorId);

  // Also include creators from purchases for backward compat
  const purchaseRows = await db
    .select({ creatorId: paymentsTable.creatorId })
    .from(paymentsTable)
    .where(eq(paymentsTable.readerId, userId));

  const purchasedCreators = [...new Set(purchaseRows.map(p => p.creatorId))];
  const allFollowed = [...new Set([...followedCreators, ...purchasedCreators])];

  let rows;
  if (categories.length > 0 && allFollowed.length > 0) {
    rows = await db
      .select()
      .from(contentTable)
      .where(
        and(
          eq(contentTable.published, true),
          or(
            inArray(contentTable.categorySlug, categories),
            inArray(contentTable.creatorId, allFollowed),
          ),
        ),
      )
      .orderBy(desc(contentTable.createdAt))
      .limit(24);
  } else if (categories.length > 0) {
    rows = await db
      .select()
      .from(contentTable)
      .where(and(eq(contentTable.published, true), inArray(contentTable.categorySlug, categories)))
      .orderBy(desc(contentTable.createdAt))
      .limit(24);
  } else if (allFollowed.length > 0) {
    rows = await db
      .select()
      .from(contentTable)
      .where(and(eq(contentTable.published, true), inArray(contentTable.creatorId, allFollowed)))
      .orderBy(desc(contentTable.createdAt))
      .limit(24);
  } else {
    rows = await db
      .select()
      .from(contentTable)
      .where(eq(contentTable.published, true))
      .orderBy(desc(contentTable.createdAt))
      .limit(12);
  }

  const enriched = await enrichContent(rows);

  res.json({
    categories,
    followedCreators: allFollowed,
    explicitFollows: followedCreators,
    items: enriched.map(r => ({
      id: r.id,
      title: r.title,
      type: r.type,
      categorySlug: r.categorySlug,
      previewText: r.previewText,
      coverImageUrl: r.coverImageUrl,
      price: r.price,
      creatorId: r.creatorId,
      creatorName: r.creatorName,
      creatorImageUrl: r.creatorImageUrl,
      creatorVerified: r.creatorVerified,
      featured: r.featured,
      createdAt: r.createdAt,
    })),
  });
});

// GET /api/dashboard/reader — reader stats summary
router.get("/reader", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getOrCreateUser(userId);

  const paymentRows = await db
    .select({
      amount: paymentsTable.amount,
      txHash: paymentsTable.txHash,
      splitTxHash: paymentsTable.splitTxHash,
    })
    .from(paymentsTable)
    .where(eq(paymentsTable.readerId, userId));

  const granted = paymentRows.filter((p) => paymentGrantsAccess(p));

  res.json({
    name: user.name,
    selectedCategories: user.selectedCategories,
    totalSpent: granted.reduce((sum, p) => sum + Number(p.amount), 0),
    purchaseCount: granted.length,
  });
});

export default router;
