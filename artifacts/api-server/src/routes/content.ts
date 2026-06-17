import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq, inArray, and, sql } from "drizzle-orm";
import { db, contentTable, categoriesTable, paymentsTable, usersTable } from "@workspace/db";
import {
  ListContentQueryParams,
  CreateContentBody,
  UpdateContentBody,
  GetContentParams,
  UpdateContentParams,
  DeleteContentParams,
  TrackContentViewParams,
} from "@workspace/api-zod";
import { getOrCreateUser } from "./users";

const router = Router();

async function enrichContent(rows: (typeof contentTable.$inferSelect)[], requestUserId?: string | null) {
  const creatorIds = [...new Set(rows.map(r => r.creatorId))];
  const nameMap: Record<string, { name: string; imageUrl: string | null }> = {};

  // Fetch Clerk profile info for each creator
  await Promise.all(
    creatorIds.map(async id => {
      try {
        const u = await clerkClient.users.getUser(id);
        nameMap[id] = {
          name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || "Creator",
          imageUrl: u.imageUrl ?? null,
        };
      } catch { nameMap[id] = { name: "Creator", imageUrl: null }; }
    })
  );

  // Fetch verified status from DB
  const dbUsers = creatorIds.length > 0
    ? await db.select({ clerkId: usersTable.clerkId, verified: usersTable.verified })
        .from(usersTable)
        .where(inArray(usersTable.clerkId, creatorIds))
    : [];
  const verifiedMap: Record<string, boolean> = Object.fromEntries(dbUsers.map(u => [u.clerkId, u.verified]));

  return rows.map(r => ({
    id: r.id,
    title: r.title,
    type: r.type,
    categorySlug: r.categorySlug,
    categoryName: r.categorySlug,
    price: Number(r.price),
    creatorId: r.creatorId,
    creatorName: nameMap[r.creatorId]?.name ?? "Creator",
    creatorImageUrl: nameMap[r.creatorId]?.imageUrl ?? null,
    creatorVerified: verifiedMap[r.creatorId] ?? false,
    previewText: r.previewText,
    audioUrl: r.audioUrl,
    videoUrl: r.videoUrl,
    viewCount: r.viewCount,
    purchaseCount: r.purchaseCount,
    published: r.published,
    createdAt: r.createdAt.toISOString(),
  }));
}

// GET /api/content
router.get("/", async (req, res): Promise<void> => {
  const parsed = ListContentQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
  const offset = parsed.success ? (parsed.data.offset ?? 0) : 0;
  const categoryFilter = parsed.success ? parsed.data.categories : undefined;
  const typeFilter = parsed.success ? parsed.data.type : undefined;
  const creatorFilter = parsed.success ? parsed.data.creatorId : undefined;

  let query = db.select().from(contentTable).where(eq(contentTable.published, true));

  const conditions = [eq(contentTable.published, true)];

  if (typeFilter) conditions.push(eq(contentTable.type, typeFilter));
  if (creatorFilter) conditions.push(eq(contentTable.creatorId, creatorFilter));
  if (categoryFilter) {
    const slugs = categoryFilter.split(",").map(s => s.trim()).filter(Boolean);
    if (slugs.length > 0) conditions.push(inArray(contentTable.categorySlug, slugs));
  }

  const [items, countResult] = await Promise.all([
    db.select().from(contentTable)
      .where(and(...conditions))
      .orderBy(sql`${contentTable.createdAt} desc`)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(contentTable).where(and(...conditions)),
  ]);

  const enriched = await enrichContent(items);

  // Attach category name
  const cats = await db.select().from(categoriesTable);
  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.name]));
  const result = enriched.map(e => ({ ...e, categoryName: catMap[e.categorySlug] ?? e.categorySlug }));

  res.json({ items: result, total: Number(countResult[0]?.count ?? 0), offset, limit });
});

// POST /api/content
router.post("/", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreateContentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await getOrCreateUser(userId);
  const { title, type, categorySlug, body, previewText, audioUrl, videoUrl, price, published } = parsed.data;

  // Auto-generate preview if not provided
  let preview = previewText ?? null;
  if (!preview && body) {
    preview = body.split("\n\n")[0]?.slice(0, 280) ?? null;
  }

  const [item] = await db.insert(contentTable).values({
    title,
    type,
    categorySlug,
    body: body ?? null,
    previewText: preview,
    audioUrl: audioUrl ?? null,
    videoUrl: videoUrl ?? null,
    price: String(price ?? 0),
    creatorId: userId,
    published: published ?? true,
  }).returning();

  const [enriched] = await enrichContent([item]);
  const cats = await db.select().from(categoriesTable);
  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.name]));
  res.status(201).json({ ...enriched, categoryName: catMap[enriched.categorySlug] ?? enriched.categorySlug });
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
    hasAccess = payment.length > 0;
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

  const [updated] = await db.update(contentTable)
    .set({ ...parsed.data, ...(parsed.data.price !== undefined ? { price: String(parsed.data.price) } : {}) })
    .where(eq(contentTable.id, id))
    .returning();

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
      sql`${contentTable.created_at} <= ${current.createdAt}`,
    ))
    .orderBy(sql`${contentTable.created_at} desc`)
    .limit(1);

  if (!next) {
    // Try any other published item in the category
    const [fallback] = await db.select().from(contentTable)
      .where(and(
        eq(contentTable.categorySlug, current.categorySlug),
        eq(contentTable.published, true),
        sql`${contentTable.id} != ${id}`,
      ))
      .orderBy(sql`${contentTable.created_at} desc`)
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

  await db.update(contentTable)
    .set({ viewCount: sql`${contentTable.viewCount} + 1` })
    .where(eq(contentTable.id, id));

  res.status(204).send();
});

export default router;
