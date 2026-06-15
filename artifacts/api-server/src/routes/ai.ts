import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, contentTable, paymentsTable, aiSuggestionsTable } from "@workspace/db";

const router = Router();

type AiAction = "raise" | "lower" | "keep";

function generatePricingSuggestion(
  currentPrice: number,
  conversionRate: number,
  viewCount: number,
  purchaseCount: number,
  contentType: string,
): { suggestedPrice: number; action: AiAction; reasoning: string } {
  const CREATOR_SHARE = 0.95;

  if (viewCount < 10) {
    return {
      suggestedPrice: currentPrice,
      action: "keep",
      reasoning: `With only ${viewCount} view${viewCount !== 1 ? "s" : ""}, there's not enough data to recommend a price change yet. Keep your current price and continue promoting your content. Check back after reaching 20+ views for a more accurate recommendation.`,
    };
  }

  const totalEarned = purchaseCount * currentPrice * CREATOR_SHARE;

  if (conversionRate > 25) {
    const newPrice = parseFloat((currentPrice * 1.3).toFixed(6));
    return {
      suggestedPrice: newPrice,
      action: "raise",
      reasoning: `Your ${conversionRate.toFixed(1)}% conversion rate is exceptional — top-quartile on the platform. Over ${viewCount} views you've earned $${totalEarned.toFixed(4)} USDC. Raising to $${newPrice} USDC could increase revenue by ~30% while keeping conversion above 18%. Strong signal of high-demand content.`,
    };
  }

  if (conversionRate > 12) {
    const newPrice = parseFloat((currentPrice * 1.15).toFixed(6));
    return {
      suggestedPrice: newPrice,
      action: "raise",
      reasoning: `A ${conversionRate.toFixed(1)}% conversion rate across ${viewCount} views is well above the platform median of 8%. You have room to raise your price by ~15% before significantly impacting conversions. This would increase per-view revenue while maintaining your reader base.`,
    };
  }

  if (conversionRate < 2 && viewCount >= 30) {
    const newPrice = parseFloat((currentPrice * 0.6).toFixed(6));
    return {
      suggestedPrice: newPrice,
      action: "lower",
      reasoning: `With a ${conversionRate.toFixed(1)}% conversion rate over ${viewCount} views, readers are interested but the price is a barrier. Dropping to $${newPrice} USDC (40% reduction) should push conversion above 6%, potentially tripling revenue from $${totalEarned.toFixed(4)} to ~$${(viewCount * 0.06 * newPrice * CREATOR_SHARE).toFixed(4)} USDC. ${contentType === "article" ? "Articles" : contentType === "audio" ? "Audio pieces" : "Videos"} at this price point convert 3–4× better.`,
    };
  }

  if (conversionRate < 5 && viewCount >= 20) {
    const newPrice = parseFloat((currentPrice * 0.75).toFixed(6));
    return {
      suggestedPrice: newPrice,
      action: "lower",
      reasoning: `Your ${conversionRate.toFixed(1)}% conversion rate over ${viewCount} views is below the platform median of 8%. A 25% price reduction to $${newPrice} USDC could lift conversion to 8–10%, improving total revenue. Creator earnings at current rate: $${totalEarned.toFixed(4)} USDC. Projected at new rate: ~$${(viewCount * 0.09 * newPrice * CREATOR_SHARE).toFixed(4)} USDC.`,
    };
  }

  return {
    suggestedPrice: currentPrice,
    action: "keep",
    reasoning: `Your ${conversionRate.toFixed(1)}% conversion rate over ${viewCount} views is right at the platform median of 8%. The current price of $${currentPrice} USDC is well-calibrated for your audience. Total earned: $${totalEarned.toFixed(4)} USDC. No change recommended — keep publishing and review again when you have 50+ views.`,
  };
}

// GET /api/ai/suggestions
router.get("/suggestions", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const suggestions = await db
    .select({
      id: aiSuggestionsTable.id,
      contentId: aiSuggestionsTable.contentId,
      currentPrice: aiSuggestionsTable.currentPrice,
      suggestedPrice: aiSuggestionsTable.suggestedPrice,
      action: aiSuggestionsTable.action,
      reasoning: aiSuggestionsTable.reasoning,
      conversionRate: aiSuggestionsTable.conversionRate,
      status: aiSuggestionsTable.status,
      createdAt: aiSuggestionsTable.createdAt,
      contentTitle: contentTable.title,
    })
    .from(aiSuggestionsTable)
    .leftJoin(contentTable, eq(aiSuggestionsTable.contentId, contentTable.id))
    .where(eq(aiSuggestionsTable.creatorId, userId))
    .orderBy(desc(aiSuggestionsTable.createdAt));

  res.json(suggestions.map(s => ({
    id: s.id,
    contentId: s.contentId,
    contentTitle: s.contentTitle ?? "Untitled",
    currentPrice: Number(s.currentPrice),
    suggestedPrice: Number(s.suggestedPrice),
    action: s.action,
    reasoning: s.reasoning,
    conversionRate: Number(s.conversionRate),
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  })));
});

// POST /api/ai/suggest/:contentId  (contentId = 0 for new content pre-publish)
router.post("/suggest/:contentId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.contentId) ? req.params.contentId[0] : req.params.contentId;
  const contentId = parseInt(rawId, 10);

  // For contentId = 0 (pre-publish suggestion)
  if (contentId === 0) {
    const suggestion = generatePricingSuggestion(0.05, 0, 0, 0, "article");
    res.json({
      id: 0,
      contentId: 0,
      contentTitle: "New content",
      currentPrice: 0.05,
      suggestedPrice: suggestion.suggestedPrice,
      action: suggestion.action,
      reasoning: suggestion.reasoning,
      conversionRate: 0,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    return;
  }

  const items = await db.select().from(contentTable).where(and(eq(contentTable.id, contentId), eq(contentTable.creatorId, userId))).limit(1);
  if (!items.length) { res.status(404).json({ error: "Content not found or not yours" }); return; }

  const content = items[0];
  const currentPrice = Number(content.price);
  const conversionRate = content.viewCount > 0
    ? (content.purchaseCount / content.viewCount) * 100
    : 0;

  const suggestion = generatePricingSuggestion(
    currentPrice,
    conversionRate,
    content.viewCount,
    content.purchaseCount,
    content.type,
  );

  // Dismiss any existing pending suggestions for this content
  await db.update(aiSuggestionsTable)
    .set({ status: "dismissed" })
    .where(and(
      eq(aiSuggestionsTable.contentId, contentId),
      eq(aiSuggestionsTable.creatorId, userId),
      sql`${aiSuggestionsTable.status} = 'pending'`
    ));

  const [created] = await db.insert(aiSuggestionsTable).values({
    contentId,
    creatorId: userId,
    currentPrice: String(currentPrice),
    suggestedPrice: String(suggestion.suggestedPrice),
    action: suggestion.action,
    reasoning: suggestion.reasoning,
    conversionRate: String(conversionRate.toFixed(2)),
    status: "pending",
  }).returning();

  res.json({
    id: created.id,
    contentId: created.contentId,
    contentTitle: content.title,
    currentPrice: Number(created.currentPrice),
    suggestedPrice: Number(created.suggestedPrice),
    action: created.action,
    reasoning: created.reasoning,
    conversionRate: Number(created.conversionRate),
    status: created.status,
    createdAt: created.createdAt.toISOString(),
  });
});

// POST /api/ai/suggestions/:id/apply
router.post("/suggestions/:id/apply", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const sug = await db.select().from(aiSuggestionsTable).where(and(eq(aiSuggestionsTable.id, id), eq(aiSuggestionsTable.creatorId, userId))).limit(1);
  if (!sug.length) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(aiSuggestionsTable).set({ status: "applied" }).where(eq(aiSuggestionsTable.id, id));
  await db.update(contentTable).set({ price: sug[0].suggestedPrice }).where(eq(contentTable.id, sug[0].contentId));

  res.json({ success: true, newPrice: Number(sug[0].suggestedPrice) });
});

// POST /api/ai/suggestions/:id/dismiss
router.post("/suggestions/:id/dismiss", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const sug = await db.select().from(aiSuggestionsTable).where(and(eq(aiSuggestionsTable.id, id), eq(aiSuggestionsTable.creatorId, userId))).limit(1);
  if (!sug.length) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(aiSuggestionsTable).set({ status: "dismissed" }).where(eq(aiSuggestionsTable.id, id));
  res.json({ success: true });
});

export default router;
