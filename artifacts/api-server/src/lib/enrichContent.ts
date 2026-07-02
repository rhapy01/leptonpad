import { clerkClient } from "@clerk/express";
import { inArray, sql } from "drizzle-orm";
import { db, contentTable, usersTable, reactionsTable } from "@workspace/db";
import { isSystemCreator, SYSTEM_CREATOR_PROFILE } from "./systemCreator";

export async function enrichContent(rows: (typeof contentTable.$inferSelect)[]) {
  const creatorIds = [...new Set(rows.map(r => r.creatorId))];
  const nameMap: Record<string, { name: string; imageUrl: string | null }> = {};

  await Promise.all(
    creatorIds.map(async id => {
      if (isSystemCreator(id)) {
        nameMap[id] = { name: SYSTEM_CREATOR_PROFILE.name, imageUrl: SYSTEM_CREATOR_PROFILE.imageUrl };
        return;
      }
      try {
        const u = await clerkClient.users.getUser(id);
        nameMap[id] = {
          name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || "Creator",
          imageUrl: u.imageUrl ?? null,
        };
      } catch {
        nameMap[id] = { name: "Creator", imageUrl: null };
      }
    }),
  );

  const dbUsers = creatorIds.length > 0
    ? await db.select({
        clerkId: usersTable.clerkId,
        verified: usersTable.verified,
        imageUrl: usersTable.imageUrl,
        name: usersTable.name,
      })
        .from(usersTable)
        .where(inArray(usersTable.clerkId, creatorIds))
    : [];
  const profileMap = Object.fromEntries(dbUsers.map(u => [u.clerkId, u]));

  const contentIds = rows.map(r => r.id);
  const reactionCounts: Record<number, number> = {};
  if (contentIds.length > 0) {
    const counts = await db
      .select({
        contentId: reactionsTable.contentId,
        n: sql<number>`count(*)::int`,
      })
      .from(reactionsTable)
      .where(inArray(reactionsTable.contentId, contentIds))
      .groupBy(reactionsTable.contentId);
    for (const row of counts) reactionCounts[row.contentId] = row.n;
  }

  return rows.map(r => {
    const profile = profileMap[r.creatorId];
    const clerkProfile = nameMap[r.creatorId];
    return {
    id: r.id,
    title: r.title,
    type: r.type,
    categorySlug: r.categorySlug,
    categoryName: r.categorySlug,
    price: Number(r.price),
    creatorId: r.creatorId,
    creatorName: profile?.name || clerkProfile?.name || (isSystemCreator(r.creatorId) ? SYSTEM_CREATOR_PROFILE.name : "Creator"),
    creatorImageUrl: profile?.imageUrl ?? clerkProfile?.imageUrl ?? null,
    creatorVerified: isSystemCreator(r.creatorId) ? true : (profile?.verified ?? false),
    creatorVerifiedAtPublish: r.creatorVerifiedAtPublish ?? null,
    creatorShareAtPublish: (r.creatorVerifiedAtPublish ?? false) ? 1 : 0.95,
    previewText: r.previewText,
    coverImageUrl: r.coverImageUrl,
    audioUrl: r.audioUrl,
    videoUrl: r.videoUrl,
    viewCount: r.viewCount,
    purchaseCount: r.purchaseCount,
    featured: r.featured,
    published: r.published,
    slug: r.slug,
    tags: r.tags ?? [],
    status: r.status,
    scheduledAt: r.scheduledAt?.toISOString() ?? null,
    metaDescription: r.metaDescription,
    bookmarkCount: r.bookmarkCount,
    commentCount: r.commentCount,
    reactionCount: reactionCounts[r.id] ?? 0,
    language: r.language,
    country: r.country,
    createdAt: r.createdAt.toISOString(),
  };
  });
}
