import { writeRateLimit } from "../middlewares/rateLimit";
import { assertMaxLength, MAX_COMMENT_LENGTH } from "../lib/sanitizeHtml";
import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq, and, desc, sql, count } from "drizzle-orm";
import {
  db,
  followsTable,
  commentsTable,
  reactionsTable,
  collectionsTable,
  collectionItemsTable,
  readingProgressTable,
  notificationsTable,
  contentReportsTable,
  contentTable,
  usersTable,
  contentVersionsTable,
} from "@workspace/db";
import { getOrCreateUser } from "./users";

const router = Router();

async function getUserProfile(userId: string): Promise<{
  name: string;
  imageUrl: string | null;
  verified: boolean;
}> {
  const row = await db
    .select({ name: usersTable.name, imageUrl: usersTable.imageUrl, verified: usersTable.verified })
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId))
    .limit(1);

  if (row[0]) {
    return {
      name: row[0].name,
      imageUrl: row[0].imageUrl,
      verified: row[0].verified,
    };
  }

  try {
    const u = await clerkClient.users.getUser(userId);
    return {
      name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || "User",
      imageUrl: u.imageUrl ?? null,
      verified: false,
    };
  } catch {
    return { name: "User", imageUrl: null, verified: false };
  }
}

// ─── Follows ───────────────────────────────────────────────────────────────

router.post("/follow/:creatorId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const creatorId = req.params.creatorId;
  if (creatorId === userId) { res.status(400).json({ error: "Cannot follow yourself" }); return; }

  await getOrCreateUser(userId);
  const existing = await db.select().from(followsTable)
    .where(and(eq(followsTable.followerId, userId), eq(followsTable.creatorId, creatorId))).limit(1);
  if (existing.length) { res.json({ following: true, subscribed: true }); return; }

  await db.insert(followsTable).values({ followerId: userId, creatorId });
  const subscriber = await getUserProfile(userId);
  await db.insert(notificationsTable).values({
    userId: creatorId,
    type: "follow",
    message: `${subscriber.name} subscribed to your updates`,
    link: `/creator/${userId}`,
  });
  res.status(201).json({ following: true, subscribed: true });
});

router.delete("/follow/:creatorId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  await db.delete(followsTable)
    .where(and(eq(followsTable.followerId, userId), eq(followsTable.creatorId, req.params.creatorId)));
  res.json({ following: false, subscribed: false });
});

router.get("/follow/:creatorId/status", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  const creatorId = req.params.creatorId;
  const [row] = await db.select({ c: count() }).from(followsTable).where(eq(followsTable.creatorId, creatorId));
  const subscriberCount = Number(row?.c ?? 0);
  if (!userId) {
    res.json({ following: false, subscribed: false, followerCount: subscriberCount, subscriberCount });
    return;
  }
  const existing = await db.select().from(followsTable)
    .where(and(eq(followsTable.followerId, userId), eq(followsTable.creatorId, creatorId))).limit(1);
  const subscribed = existing.length > 0;
  res.json({
    following: subscribed,
    subscribed,
    followerCount: subscriberCount,
    subscriberCount,
  });
});

// ─── Comments ──────────────────────────────────────────────────────────────

router.get("/content/:contentId/comments", async (req, res): Promise<void> => {
  const contentId = parseInt(req.params.contentId, 10);
  if (isNaN(contentId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.select().from(commentsTable)
    .where(eq(commentsTable.contentId, contentId))
    .orderBy(desc(commentsTable.createdAt));

  const enriched = await Promise.all(rows.map(async r => {
    const profile = await getUserProfile(r.userId);
    return {
      id: r.id,
      contentId: r.contentId,
      userId: r.userId,
      userName: profile.name,
      userImageUrl: profile.imageUrl,
      userVerified: profile.verified,
      body: r.body,
      parentId: r.parentId,
      createdAt: r.createdAt.toISOString(),
    };
  }));
  res.json(enriched);
});

router.post("/content/:contentId/comments", writeRateLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const contentId = parseInt(req.params.contentId, 10);
  const { body, parentId } = req.body as { body?: string; parentId?: number };
  if (!body?.trim()) { res.status(400).json({ error: "Comment body required" }); return; }

  try {
    assertMaxLength(body.trim(), MAX_COMMENT_LENGTH, "comment");
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Comment too long" });
    return;
  }

  await getOrCreateUser(userId);
  const [comment] = await db.insert(commentsTable).values({
    contentId,
    userId,
    body: body.trim(),
    parentId: parentId ?? null,
  }).returning();

  await db.update(contentTable)
    .set({ commentCount: sql`${contentTable.commentCount} + 1` })
    .where(eq(contentTable.id, contentId));

  const item = await db.select().from(contentTable).where(eq(contentTable.id, contentId)).limit(1);
  if (item[0] && item[0].creatorId !== userId) {
    await db.insert(notificationsTable).values({
      userId: item[0].creatorId,
      type: "comment",
      message: `New comment on "${item[0].title}"`,
      link: `/content/${contentId}`,
    });
  }

  if (parentId) {
    const parent = await db.select().from(commentsTable).where(eq(commentsTable.id, parentId)).limit(1);
    if (parent[0] && parent[0].userId !== userId) {
      await db.insert(notificationsTable).values({
        userId: parent[0].userId,
        type: "comment",
        message: `Someone replied to your comment on "${item[0]?.title ?? "content"}"`,
        link: `/content/${contentId}`,
      });
    }
  }

  const profile = await getUserProfile(userId);
  res.status(201).json({
    id: comment.id,
    contentId: comment.contentId,
    userId: comment.userId,
    userName: profile.name,
    userImageUrl: profile.imageUrl,
    userVerified: profile.verified,
    body: comment.body,
    parentId: comment.parentId,
    createdAt: comment.createdAt.toISOString(),
  });
});

// ─── Reactions ─────────────────────────────────────────────────────────────

router.post("/content/:contentId/react", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const contentId = parseInt(req.params.contentId, 10);
  const type = (req.body as { type?: string }).type ?? "clap";

  const existing = await db.select().from(reactionsTable)
    .where(and(eq(reactionsTable.contentId, contentId), eq(reactionsTable.userId, userId))).limit(1);

  if (existing.length) {
    await db.delete(reactionsTable).where(eq(reactionsTable.id, existing[0].id));
    await db.update(contentTable)
      .set({ reactionCount: sql`greatest(0, ${contentTable.reactionCount} - 1)` })
      .where(eq(contentTable.id, contentId));
    const [c] = await db.select({ c: contentTable.reactionCount }).from(contentTable).where(eq(contentTable.id, contentId));
    res.json({ reacted: false, count: c?.c ?? 0 });
    return;
  }

  await db.insert(reactionsTable).values({ contentId, userId, type });
  await db.update(contentTable)
    .set({ reactionCount: sql`${contentTable.reactionCount} + 1` })
    .where(eq(contentTable.id, contentId));
  const [c] = await db.select({ c: contentTable.reactionCount }).from(contentTable).where(eq(contentTable.id, contentId));
  res.json({ reacted: true, count: c?.c ?? 0 });
});

router.get("/content/:contentId/reactions", async (req, res): Promise<void> => {
  const contentId = parseInt(req.params.contentId, 10);
  const { userId } = getAuth(req);
  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reactionsTable)
    .where(eq(reactionsTable.contentId, contentId));
  let userReacted = false;
  if (userId) {
    const existing = await db.select().from(reactionsTable)
      .where(and(eq(reactionsTable.contentId, contentId), eq(reactionsTable.userId, userId))).limit(1);
    userReacted = existing.length > 0;
  }
  res.json({ count: countRow?.n ?? 0, userReacted });
});

// ─── Collections ───────────────────────────────────────────────────────────

async function ensureDefaultCollections(userId: string) {
  const existing = await db.select().from(collectionsTable).where(eq(collectionsTable.userId, userId));
  if (existing.length) return existing;
  const defaults = [
    { name: "Read Later", slug: "read-later", isDefault: true },
    { name: "Favorites", slug: "favorites", isDefault: true },
  ];
  const created = [];
  for (const d of defaults) {
    const [row] = await db.insert(collectionsTable).values({ userId, ...d }).returning();
    created.push(row);
  }
  return created;
}

router.get("/collections", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cols = await ensureDefaultCollections(userId);
  const withCounts = await Promise.all(cols.map(async col => {
    const [c] = await db.select({ n: count() }).from(collectionItemsTable).where(eq(collectionItemsTable.collectionId, col.id));
    return {
      id: col.id,
      name: col.name,
      slug: col.slug,
      isDefault: col.isDefault,
      itemCount: Number(c?.n ?? 0),
      createdAt: col.createdAt.toISOString(),
    };
  }));
  res.json(withCounts);
});

router.post("/collections", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const [col] = await db.insert(collectionsTable).values({ userId, name: name.trim(), slug }).returning();
  res.status(201).json({ id: col.id, name: col.name, slug: col.slug, isDefault: false, itemCount: 0 });
});

router.get("/collections/:id/items", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const collectionId = parseInt(req.params.id, 10);
  const col = await db.select().from(collectionsTable).where(eq(collectionsTable.id, collectionId)).limit(1);
  if (!col.length || col[0].userId !== userId) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db.select({ contentId: collectionItemsTable.contentId, addedAt: collectionItemsTable.addedAt })
    .from(collectionItemsTable)
    .where(eq(collectionItemsTable.collectionId, collectionId))
    .orderBy(desc(collectionItemsTable.addedAt));

  const contentIds = items.map(i => i.contentId);
  if (!contentIds.length) { res.json([]); return; }

  const rows = await db.select().from(contentTable).where(sql`${contentTable.id} = ANY(${contentIds})`);
  res.json(rows.map(r => ({
    id: r.id,
    title: r.title,
    type: r.type,
    categorySlug: r.categorySlug,
    coverImageUrl: r.coverImageUrl,
    price: Number(r.price),
    creatorId: r.creatorId,
    addedAt: items.find(i => i.contentId === r.id)?.addedAt.toISOString(),
  })));
});

router.post("/collections/:id/items", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const collectionId = parseInt(req.params.id, 10);
  const contentId = (req.body as { contentId?: number }).contentId;
  if (!contentId) { res.status(400).json({ error: "contentId required" }); return; }

  const col = await db.select().from(collectionsTable).where(eq(collectionsTable.id, collectionId)).limit(1);
  if (!col.length || col[0].userId !== userId) { res.status(404).json({ error: "Not found" }); return; }

  const existing = await db.select().from(collectionItemsTable)
    .where(and(eq(collectionItemsTable.collectionId, collectionId), eq(collectionItemsTable.contentId, contentId))).limit(1);
  if (!existing.length) {
    await db.insert(collectionItemsTable).values({ collectionId, contentId });
    await db.update(contentTable)
      .set({ bookmarkCount: sql`${contentTable.bookmarkCount} + 1` })
      .where(eq(contentTable.id, contentId));
  }
  res.status(201).json({ saved: true });
});

router.delete("/collections/:id/items/:contentId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const collectionId = parseInt(req.params.id, 10);
  const contentId = parseInt(req.params.contentId, 10);
  const col = await db.select().from(collectionsTable).where(eq(collectionsTable.id, collectionId)).limit(1);
  if (!col.length || col[0].userId !== userId) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(collectionItemsTable)
    .where(and(eq(collectionItemsTable.collectionId, collectionId), eq(collectionItemsTable.contentId, contentId)));
  await db.update(contentTable)
    .set({ bookmarkCount: sql`greatest(0, ${contentTable.bookmarkCount} - 1)` })
    .where(eq(contentTable.id, contentId));
  res.json({ saved: false });
});

// ─── Reading progress ──────────────────────────────────────────────────────

router.get("/reading-progress/:contentId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.json({ progressPct: 0, scrollPosition: 0, completed: false }); return; }
  const contentId = parseInt(req.params.contentId, 10);
  const rows = await db.select().from(readingProgressTable)
    .where(and(eq(readingProgressTable.userId, userId), eq(readingProgressTable.contentId, contentId))).limit(1);
  if (!rows.length) { res.json({ progressPct: 0, scrollPosition: 0, completed: false }); return; }
  res.json({
    progressPct: rows[0].progressPct,
    scrollPosition: rows[0].scrollPosition,
    completed: rows[0].completed,
  });
});

router.put("/reading-progress/:contentId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const contentId = parseInt(req.params.contentId, 10);
  if (!Number.isFinite(contentId)) {
    res.status(400).json({ error: "Invalid content id" });
    return;
  }

  const { progressPct, scrollPosition, completed } = req.body as {
    progressPct?: number;
    scrollPosition?: number;
    completed?: boolean;
  };

  try {
    const existing = await db.select().from(readingProgressTable)
      .where(and(eq(readingProgressTable.userId, userId), eq(readingProgressTable.contentId, contentId))).limit(1);

    if (existing.length) {
      await db.update(readingProgressTable)
        .set({
          progressPct: progressPct ?? existing[0].progressPct,
          scrollPosition: scrollPosition ?? existing[0].scrollPosition,
          completed: completed ?? existing[0].completed,
        })
        .where(eq(readingProgressTable.id, existing[0].id));
    } else {
      await db.insert(readingProgressTable).values({
        userId,
        contentId,
        progressPct: progressPct ?? 0,
        scrollPosition: scrollPosition ?? 0,
        completed: completed ?? false,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("reading-progress save failed", err);
    res.status(500).json({ error: "Failed to save reading progress" });
  }
});

// ─── Notifications ─────────────────────────────────────────────────────────

router.get("/notifications", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(rows.map(r => ({
    id: r.id,
    type: r.type,
    message: r.message,
    link: r.link,
    read: r.read,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/notifications/read-all", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.userId, userId));
  res.json({ ok: true });
});

router.post("/notifications/:id/read", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.id, id)));
  res.json({ ok: true });
});

// ─── Reports ───────────────────────────────────────────────────────────────

router.post("/content/:contentId/report", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const contentId = parseInt(req.params.contentId, 10);
  const { reason } = req.body as { reason?: string };
  if (!reason?.trim()) { res.status(400).json({ error: "Reason required" }); return; }
  await db.insert(contentReportsTable).values({ contentId, reporterId: userId, reason: reason.trim() });
  res.status(201).json({ reported: true });
});

// ─── Version history ───────────────────────────────────────────────────────

router.get("/content/:contentId/versions", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const contentId = parseInt(req.params.contentId, 10);
  const item = await db.select().from(contentTable).where(eq(contentTable.id, contentId)).limit(1);
  if (!item.length || item[0].creatorId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const versions = await db.select().from(contentVersionsTable)
    .where(eq(contentVersionsTable.contentId, contentId))
    .orderBy(desc(contentVersionsTable.createdAt));
  res.json(versions.map(v => ({
    id: v.id,
    title: v.title,
    createdAt: v.createdAt.toISOString(),
  })));
});

export { contentVersionsTable };
export default router;
