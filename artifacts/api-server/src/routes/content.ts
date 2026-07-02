import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq, inArray, and, sql, desc, or, ilike } from "drizzle-orm";
import { db, contentTable, categoriesTable, paymentsTable, usersTable, contentVersionsTable, uniqueViewsTable } from "@workspace/db";
import {
  ListContentQueryParams,
  CreateContentBody,
  UpdateContentBody,
} from "@workspace/api-zod";
import { getOrCreateUser } from "./users";
import { uniqueSlug } from "../lib/slug";
import { publishDueScheduledContent } from "../lib/publishScheduled";
import { getCreatorVerifiedSnapshot } from "../lib/contentPublishSnapshot";
import { notifySubscribersOfNewContent } from "../lib/broadcastSubscribers";
import { enrichContent } from "../lib/enrichContent";
import { paymentGrantsAccess } from "../lib/recordPayment";

const router = Router();

// GET /api/content
router.get("/", async (req, res): Promise<void> => {
  await publishDueScheduledContent();

  const parsed = ListContentQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
  const offset = parsed.success ? (parsed.data.offset ?? 0) : 0;
  const categoryFilter = parsed.success ? parsed.data.categories : undefined;
  const typeFilter = parsed.success ? parsed.data.type : undefined;
  const creatorFilter = parsed.success ? parsed.data.creatorId : undefined;
  const searchQuery = parsed.success ? parsed.data.q?.trim() : undefined;
  const tagFilter = typeof req.query.tags === "string" ? req.query.tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean) : undefined;
  const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;

  const conditions = [eq(contentTable.published, true)];

  if (typeFilter) conditions.push(eq(contentTable.type, typeFilter));
  if (creatorFilter) conditions.push(eq(contentTable.creatorId, creatorFilter));
  if (categoryFilter) {
    const slugs = categoryFilter.split(",").map(s => s.trim()).filter(Boolean);
    if (slugs.length > 0) conditions.push(inArray(contentTable.categorySlug, slugs));
  }

  if (searchQuery) {
    const term = `%${searchQuery}%`;
    const matchingCreators = await db
      .select({ clerkId: usersTable.clerkId })
      .from(usersTable)
      .where(ilike(usersTable.name, term));
    const creatorIds = matchingCreators.map(c => c.clerkId);

    const searchConditions = [
      ilike(contentTable.title, term),
      ilike(contentTable.previewText, term),
    ];
    if (creatorIds.length > 0) {
      searchConditions.push(inArray(contentTable.creatorId, creatorIds));
    }
    conditions.push(or(...searchConditions)!);
  }

  if (tagFilter?.length) {
    conditions.push(sql`${contentTable.tags} && ${tagFilter}`);
  }

  // Creator's own drafts when filtering by creatorId + status
  const { userId } = getAuth(req);
  if (statusFilter && creatorFilter && userId === creatorFilter) {
    conditions.length = 0;
    conditions.push(eq(contentTable.creatorId, creatorFilter));
    if (statusFilter !== "all") conditions.push(eq(contentTable.status, statusFilter));
  } else if (statusFilter === "draft" && userId) {
    conditions.length = 0;
    conditions.push(eq(contentTable.creatorId, userId), eq(contentTable.status, "draft"));
  }

  const whereClause = and(...conditions);

  const [items, countResult] = await Promise.all([
    db.select().from(contentTable)
      .where(whereClause)
      .orderBy(sql`${contentTable.createdAt} desc`)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(contentTable).where(whereClause),
  ]);

  const enriched = await enrichContent(items);

  // Attach category name
  const cats = await db.select().from(categoriesTable);
  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.name]));
  const result = enriched.map(e => ({ ...e, categoryName: catMap[e.categorySlug] ?? e.categorySlug }));

  res.json({ items: result, total: Number(countResult[0]?.count ?? 0), offset, limit });
});

// GET /api/content/featured — one editorial pick per content type
router.get("/featured", async (_req, res): Promise<void> => {
  const { userId } = getAuth(_req);

  async function pickForType(type: string) {
    const featured = await db
      .select()
      .from(contentTable)
      .where(and(eq(contentTable.published, true), eq(contentTable.featured, true), eq(contentTable.type, type)))
      .orderBy(desc(contentTable.purchaseCount), desc(contentTable.createdAt))
      .limit(1);

    if (featured.length) return featured[0];

    const fallback = await db
      .select()
      .from(contentTable)
      .where(and(eq(contentTable.published, true), eq(contentTable.type, type)))
      .orderBy(desc(contentTable.purchaseCount), desc(contentTable.createdAt))
      .limit(1);

    return fallback[0] ?? null;
  }

  const [articleRow, videoRow, audioRow] = await Promise.all([
    pickForType("article"),
    pickForType("video"),
    pickForType("audio"),
  ]);

  const rows = [articleRow, videoRow, audioRow].filter((r): r is NonNullable<typeof r> => r !== null);
  const enriched = await enrichContent(rows);
  const enrichedMap = Object.fromEntries(enriched.map(e => [e.id, e]));
  const cats = await db.select().from(categoriesTable);
  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.name]));

  const mapRow = (row: typeof contentTable.$inferSelect | null) => {
    if (!row) return null;
    const e = enrichedMap[row.id];
    if (!e) return null;
    return { ...e, categoryName: catMap[e.categorySlug] ?? e.categorySlug };
  };

  res.json({
    article: mapRow(articleRow),
    video: mapRow(videoRow),
    audio: mapRow(audioRow),
  });
});

// POST /api/content
router.post("/", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreateContentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await getOrCreateUser(userId);
  const body = parsed.data;
  const {
    title, type, categorySlug, previewText, coverImageUrl, audioUrl, videoUrl, price,
  } = body;
  const rawBody = body.body;
  const tags = (body as { tags?: string[] }).tags ?? [];
  const status = (body as { status?: string }).status ?? "published";
  const scheduledAt = (body as { scheduledAt?: string }).scheduledAt;
  const metaDescription = (body as { metaDescription?: string }).metaDescription;
  const language = (body as { language?: string }).language ?? "en";
  const country = (body as { country?: string }).country;
  const publicationId = (body as { publicationId?: number }).publicationId;

  let published = body.published ?? true;
  let finalStatus = status;
  if (finalStatus === "draft") published = false;
  else if (finalStatus === "scheduled" && scheduledAt) published = false;
  else if (finalStatus === "published") published = true;

  const slug = await uniqueSlug(title, async (s) => {
    const existing = await db.select().from(contentTable).where(eq(contentTable.slug, s)).limit(1);
    return existing.length > 0;
  });

  const priceNum = Number(price ?? 0);

  // Auto-generate preview if not provided
  let preview = previewText ?? null;
  if (!preview && rawBody) {
    const text = rawBody.replace(/<[^>]+>/g, " ");
    preview = text.split("\n\n")[0]?.slice(0, 280) ?? null;
  }

  const [item] = await db.insert(contentTable).values({
    title,
    slug,
    type,
    categorySlug,
    body: rawBody ?? null,
    previewText: preview,
    coverImageUrl: coverImageUrl ?? null,
    audioUrl: audioUrl ?? null,
    videoUrl: videoUrl ?? null,
    price: String(price ?? 0),
    creatorId: userId,
    published,
    status: finalStatus,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    tags: tags.map(t => t.toLowerCase()),
    metaDescription: metaDescription ?? preview?.slice(0, 160) ?? null,
    language,
    country: country ?? null,
    publicationId: publicationId ?? null,
    creatorVerifiedAtPublish:
      published && priceNum > 0 ? await getCreatorVerifiedSnapshot(userId) : null,
  }).returning();

  if (published) {
    void notifySubscribersOfNewContent(userId, {
      id: item.id,
      title: item.title,
      previewText: item.previewText,
      type: item.type,
    });
  }

  const [enriched] = await enrichContent([item]);
  const cats = await db.select().from(categoriesTable);
  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.name]));
  res.status(201).json({ ...enriched, categoryName: catMap[enriched.categorySlug] ?? enriched.categorySlug });
});

// GET /api/content/mine/drafts — creator's drafts (must be before /:id)
router.get("/mine/drafts", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db.select().from(contentTable)
    .where(and(eq(contentTable.creatorId, userId), eq(contentTable.status, "draft")))
    .orderBy(desc(contentTable.updatedAt));

  const enriched = await enrichContent(rows);
  res.json(enriched);
});

// GET /api/content/:id
router.get("/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { userId } = getAuth(req);
  const items = await db.select().from(contentTable).where(eq(contentTable.id, id)).limit(1);
  if (!items.length) { res.status(404).json({ error: "Not found" }); return; }

  const item = items[0];
  const [enriched] = await enrichContent([item]);

  const cats = await db.select().from(categoriesTable);
  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.name]));

  // Check access
  let hasAccess = Number(item.price) === 0 || item.creatorId === userId;
  if (!hasAccess && userId) {
    const payment = await db.select().from(paymentsTable)
      .where(and(eq(paymentsTable.contentId, id), eq(paymentsTable.readerId, userId)))
      .limit(1);
    hasAccess = payment.length > 0 && paymentGrantsAccess(payment[0]);
  }

  // Reading time estimate (200 wpm)
  const wordCount = (item.body ?? "").split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : null;

  res.json({
    ...enriched,
    categoryName: catMap[enriched.categorySlug] ?? enriched.categorySlug,
    body: hasAccess ? item.body : null,
    readingTimeMinutes,
    hasAccess,
  });
});

// PUT /api/content/:id
router.put("/:id", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const items = await db.select().from(contentTable).where(eq(contentTable.id, id)).limit(1);
  if (!items.length) { res.status(404).json({ error: "Not found" }); return; }
  if (items[0].creatorId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = UpdateContentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = items[0];
  if (parsed.data.body && existing.body !== parsed.data.body) {
    await db.insert(contentVersionsTable).values({
      contentId: id,
      title: existing.title,
      body: existing.body,
    });
  }

  const extra = req.body as {
    tags?: string[];
    status?: string;
    scheduledAt?: string;
    metaDescription?: string;
    language?: string;
    country?: string;
    published?: boolean;
  };

  const updateData: Record<string, unknown> = {
    ...parsed.data,
    ...(parsed.data.price !== undefined ? { price: String(parsed.data.price) } : {}),
  };
  if (extra.tags) updateData.tags = extra.tags.map(t => t.toLowerCase());
  if (extra.status) updateData.status = extra.status;
  if (extra.scheduledAt !== undefined) updateData.scheduledAt = extra.scheduledAt ? new Date(extra.scheduledAt) : null;
  if (extra.metaDescription !== undefined) updateData.metaDescription = extra.metaDescription;
  if (extra.language) updateData.language = extra.language;
  if (extra.country !== undefined) updateData.country = extra.country;
  if (extra.status === "published" || extra.published === true) {
    updateData.published = true;
    updateData.status = "published";
  } else if (extra.status === "draft") {
    updateData.published = false;
  } else if (extra.status === "scheduled") {
    updateData.published = false;
  }

  const willPublishPaid =
    (extra.status === "published" || extra.published === true) &&
    Number(parsed.data.price ?? existing.price) > 0;

  if (willPublishPaid && existing.creatorVerifiedAtPublish == null) {
    updateData.creatorVerifiedAtPublish = await getCreatorVerifiedSnapshot(userId);
  }

  const [updated] = await db.update(contentTable)
    .set(updateData)
    .where(eq(contentTable.id, id))
    .returning();

  const becamePublished = updated.published && !existing.published;
  if (becamePublished) {
    void notifySubscribersOfNewContent(userId, {
      id: updated.id,
      title: updated.title,
      previewText: updated.previewText,
      type: updated.type,
    });
  }

  const [enriched] = await enrichContent([updated]);
  const cats = await db.select().from(categoriesTable);
  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.name]));
  res.json({ ...enriched, categoryName: catMap[enriched.categorySlug] ?? enriched.categorySlug });
});

// DELETE /api/content/:id
router.delete("/:id", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const items = await db.select().from(contentTable).where(eq(contentTable.id, id)).limit(1);
  if (!items.length) { res.status(404).json({ error: "Not found" }); return; }
  if (items[0].creatorId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(contentTable).where(eq(contentTable.id, id));
  res.status(204).send();
});

// GET /api/content/:id/next — next published item in same category
router.get("/:id/next", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const items = await db.select().from(contentTable).where(eq(contentTable.id, id)).limit(1);
  if (!items.length) { res.status(404).json({ error: "Not found" }); return; }

  const current = items[0];

  const [next] = await db.select().from(contentTable)
    .where(and(
      eq(contentTable.categorySlug, current.categorySlug),
      eq(contentTable.published, true),
      sql`${contentTable.id} != ${id}`,
      sql`${contentTable.createdAt} <= ${current.createdAt}`,
    ))
    .orderBy(desc(contentTable.createdAt))
    .limit(1);

  if (!next) {
    // Try any other published item in the category
    const [fallback] = await db.select().from(contentTable)
      .where(and(
        eq(contentTable.categorySlug, current.categorySlug),
        eq(contentTable.published, true),
        sql`${contentTable.id} != ${id}`,
      ))
      .orderBy(desc(contentTable.createdAt))
      .limit(1);

    if (!fallback) { res.status(204).send(); return; }
    const [enriched] = await enrichContent([fallback]);
    const cats = await db.select().from(categoriesTable);
    const catMap = Object.fromEntries(cats.map(c => [c.slug, c.name]));
    res.json({ ...enriched, categoryName: catMap[enriched.categorySlug] ?? enriched.categorySlug });
    return;
  }

  const [enriched] = await enrichContent([next]);
  const cats = await db.select().from(categoriesTable);
  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.name]));
  res.json({ ...enriched, categoryName: catMap[enriched.categorySlug] ?? enriched.categorySlug });
});

// POST /api/content/:id/view
router.post("/:id/view", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { userId } = getAuth(req);
  const viewerId = userId ?? (req.headers["x-session-id"] as string) ?? "anonymous";

  await db.update(contentTable)
    .set({ viewCount: sql`${contentTable.viewCount} + 1` })
    .where(eq(contentTable.id, id));

  if (viewerId !== "anonymous") {
    const existing = await db.select().from(uniqueViewsTable)
      .where(and(eq(uniqueViewsTable.contentId, id), eq(uniqueViewsTable.viewerId, viewerId))).limit(1);
    if (!existing.length) {
      await db.insert(uniqueViewsTable).values({ contentId: id, viewerId }).catch(() => {});
    }
  }

  res.status(204).send();
});

export default router;
