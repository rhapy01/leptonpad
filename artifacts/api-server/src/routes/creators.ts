import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, desc, count, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  contentTable,
  followsTable,
  publicationsTable,
  publicationMembersTable,
} from "@workspace/db";
import { getOrCreateUser } from "./users";
import { notifySubscribersOfNewContent } from "../lib/broadcastSubscribers";
import {
  isSystemCreator,
  SYSTEM_CREATOR_ID,
  SYSTEM_CREATOR_PROFILE,
} from "../lib/systemCreator";

const router = Router();

async function fetchPublishedWorks(clerkId: string) {
  return db.select({
    id: contentTable.id,
    title: contentTable.title,
    type: contentTable.type,
    categorySlug: contentTable.categorySlug,
    coverImageUrl: contentTable.coverImageUrl,
    previewText: contentTable.previewText,
    price: contentTable.price,
    viewCount: contentTable.viewCount,
    purchaseCount: contentTable.purchaseCount,
    tags: contentTable.tags,
    slug: contentTable.slug,
    createdAt: contentTable.createdAt,
  })
    .from(contentTable)
    .where(and(eq(contentTable.creatorId, clerkId), eq(contentTable.published, true)))
    .orderBy(desc(contentTable.createdAt))
    .limit(50);
}

function mapWorks(works: Awaited<ReturnType<typeof fetchPublishedWorks>>) {
  return works.map(w => ({
    id: w.id,
    title: w.title,
    type: w.type,
    categorySlug: w.categorySlug,
    coverImageUrl: w.coverImageUrl,
    previewText: w.previewText,
    price: Number(w.price),
    viewCount: w.viewCount,
    purchaseCount: w.purchaseCount,
    tags: w.tags,
    slug: w.slug,
    createdAt: w.createdAt.toISOString(),
  }));
}

async function buildSystemCreatorProfile(userId: string | null) {
  const [followerRow] = await db.select({ c: count() }).from(followsTable).where(eq(followsTable.creatorId, SYSTEM_CREATOR_ID));
  const [contentCount] = await db.select({ c: count() }).from(contentTable)
    .where(and(eq(contentTable.creatorId, SYSTEM_CREATOR_ID), eq(contentTable.published, true)));

  let isFollowing = false;
  if (userId) {
    const f = await db.select().from(followsTable)
      .where(and(eq(followsTable.followerId, userId), eq(followsTable.creatorId, SYSTEM_CREATOR_ID))).limit(1);
    isFollowing = f.length > 0;
  }

  const works = await fetchPublishedWorks(SYSTEM_CREATOR_ID);

  return {
    ...SYSTEM_CREATOR_PROFILE,
    followerCount: Number(followerRow?.c ?? 0),
    subscriberCount: Number(followerRow?.c ?? 0),
    followingCount: 0,
    contentCount: Number(contentCount?.c ?? 0),
    isFollowing,
    isSubscribed: isFollowing,
    joinDate: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    works: mapWorks(works),
  };
}

// GET /api/creators — rising writers
router.get("/", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      creatorId: contentTable.creatorId,
      totalViews: sql<number>`sum(${contentTable.viewCount})`,
      totalPurchases: sql<number>`sum(${contentTable.purchaseCount})`,
      pieceCount: count(),
    })
    .from(contentTable)
    .where(eq(contentTable.published, true))
    .groupBy(contentTable.creatorId)
    .orderBy(desc(sql`sum(${contentTable.purchaseCount})`))
    .limit(12);

  const enriched = await Promise.all(rows.map(async r => {
    if (isSystemCreator(r.creatorId)) {
      const [fc] = await db.select({ c: count() }).from(followsTable).where(eq(followsTable.creatorId, SYSTEM_CREATOR_ID));
      return {
        clerkId: SYSTEM_CREATOR_ID,
        name: SYSTEM_CREATOR_PROFILE.name,
        imageUrl: SYSTEM_CREATOR_PROFILE.imageUrl,
        verified: true,
        totalViews: Number(r.totalViews ?? 0),
        totalPurchases: Number(r.totalPurchases ?? 0),
        pieceCount: Number(r.pieceCount ?? 0),
        followerCount: Number(fc?.c ?? 0),
      };
    }
    const u = await db.select().from(usersTable).where(eq(usersTable.clerkId, r.creatorId)).limit(1);
    const [fc] = await db.select({ c: count() }).from(followsTable).where(eq(followsTable.creatorId, r.creatorId));
    return {
      clerkId: r.creatorId,
      name: u[0]?.name ?? "Creator",
      imageUrl: u[0]?.imageUrl ?? null,
      verified: u[0]?.verified ?? false,
      totalViews: Number(r.totalViews ?? 0),
      totalPurchases: Number(r.totalPurchases ?? 0),
      pieceCount: Number(r.pieceCount ?? 0),
      followerCount: Number(fc?.c ?? 0),
    };
  }));

  res.json(enriched);
});

router.get("/publications/list", async (_req, res): Promise<void> => {
  const rows = await db.select().from(publicationsTable).orderBy(desc(publicationsTable.createdAt)).limit(50);
  res.json(rows.map(p => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    coverImageUrl: p.coverImageUrl,
    ownerId: p.ownerId,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.post("/publications", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { name, description, coverImageUrl } = req.body as {
    name?: string;
    description?: string;
    coverImageUrl?: string;
  };
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const [pub] = await db.insert(publicationsTable).values({
    name: name.trim(),
    slug,
    description: description ?? null,
    coverImageUrl: coverImageUrl ?? null,
    ownerId: userId,
  }).returning();

  await db.insert(publicationMembersTable).values({
    publicationId: pub.id,
    userId,
    role: "owner",
  });

  res.status(201).json({
    id: pub.id,
    name: pub.name,
    slug: pub.slug,
    description: pub.description,
    coverImageUrl: pub.coverImageUrl,
    ownerId: pub.ownerId,
  });
});

router.get("/:clerkId/rss", async (req, res): Promise<void> => {
  const clerkId = req.params.clerkId;

  if (isSystemCreator(clerkId)) {
    const works = await fetchPublishedWorks(SYSTEM_CREATOR_ID);
    const baseUrl = process.env.PUBLIC_URL ?? "https://lepton-pad.vercel.app";
    const items = works.map(w => `
    <item>
      <title><![CDATA[${w.title}]]></title>
      <link>${baseUrl}/content/${w.id}</link>
      <guid>${baseUrl}/content/${w.id}</guid>
      <pubDate>${w.createdAt.toUTCString()}</pubDate>
      <description><![CDATA[${w.previewText ?? ""}]]></description>
    </item>`).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${SYSTEM_CREATOR_PROFILE.name} on LeptonPad</title>
    <link>${baseUrl}/creator/${SYSTEM_CREATOR_ID}</link>
    <description>${SYSTEM_CREATOR_PROFILE.bio}</description>
    ${items}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/rss+xml");
    res.send(xml);
    return;
  }

  const user = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (!user.length) { res.status(404).send("Not found"); return; }

  const works = await db.select().from(contentTable)
    .where(and(eq(contentTable.creatorId, clerkId), eq(contentTable.published, true)))
    .orderBy(desc(contentTable.createdAt))
    .limit(20);

  const baseUrl = process.env.PUBLIC_URL ?? "https://leptonpad.com";
  const items = works.map(w => `
    <item>
      <title><![CDATA[${w.title}]]></title>
      <link>${baseUrl}/content/${w.id}</link>
      <guid>${baseUrl}/content/${w.id}</guid>
      <pubDate>${w.createdAt.toUTCString()}</pubDate>
      <description><![CDATA[${w.previewText ?? ""}]]></description>
    </item>`).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${user[0].name} on LeptonPad</title>
    <link>${baseUrl}/creator/${clerkId}</link>
    <description>${user[0].bio ?? "Published works"}</description>
    ${items}
  </channel>
</rss>`;

  res.setHeader("Content-Type", "application/rss+xml");
  res.send(xml);
});

// POST /api/creators/me/broadcast — email all subscribers about a published work
router.post("/me/broadcast", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const contentId = (req.body as { contentId?: number }).contentId;

  let content;
  if (contentId) {
    const rows = await db.select().from(contentTable)
      .where(and(eq(contentTable.id, contentId), eq(contentTable.creatorId, userId), eq(contentTable.published, true)))
      .limit(1);
    content = rows[0];
  } else {
    const [latest] = await db.select().from(contentTable)
      .where(and(eq(contentTable.creatorId, userId), eq(contentTable.published, true)))
      .orderBy(desc(contentTable.createdAt))
      .limit(1);
    content = latest;
  }

  if (!content) {
    res.status(404).json({ error: "No published content to broadcast" });
    return;
  }

  const result = await notifySubscribersOfNewContent(userId, {
    id: content.id,
    title: content.title,
    previewText: content.previewText,
    type: content.type,
  });

  res.json({
    ok: true,
    contentId: content.id,
    title: content.title,
    ...result,
  });
});

router.get("/:clerkId", async (req, res): Promise<void> => {
  const clerkId = req.params.clerkId;
  const { userId } = getAuth(req);

  if (isSystemCreator(clerkId)) {
    res.json(await buildSystemCreatorProfile(userId ?? null));
    return;
  }

  let user = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (!user.length) {
    try {
      await getOrCreateUser(clerkId);
      user = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
    } catch {
      res.status(404).json({ error: "Creator not found" });
      return;
    }
  }

  const u = user[0];
  const [followerRow] = await db.select({ c: count() }).from(followsTable).where(eq(followsTable.creatorId, clerkId));
  const [followingRow] = await db.select({ c: count() }).from(followsTable).where(eq(followsTable.followerId, clerkId));
  const [contentCount] = await db.select({ c: count() }).from(contentTable)
    .where(and(eq(contentTable.creatorId, clerkId), eq(contentTable.published, true)));

  let isFollowing = false;
  if (userId) {
    const f = await db.select().from(followsTable)
      .where(and(eq(followsTable.followerId, userId), eq(followsTable.creatorId, clerkId))).limit(1);
    isFollowing = f.length > 0;
  }

  const works = await fetchPublishedWorks(clerkId);

  res.json({
    clerkId: u.clerkId,
    name: u.name,
    imageUrl: u.imageUrl,
    bannerUrl: u.bannerUrl,
    bio: u.bio,
    website: u.website,
    twitterUrl: u.twitterUrl,
    linkedinUrl: u.linkedinUrl,
    country: u.country,
    language: u.language,
    verified: u.verified,
    followerCount: Number(followerRow?.c ?? 0),
    subscriberCount: Number(followerRow?.c ?? 0),
    followingCount: Number(followingRow?.c ?? 0),
    contentCount: Number(contentCount?.c ?? 0),
    isFollowing,
    isSubscribed: isFollowing,
    joinDate: u.createdAt.toISOString(),
    works: mapWorks(works),
  });
});

export default router;
