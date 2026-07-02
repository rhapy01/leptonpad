import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, desc } from "drizzle-orm";
import { db, userStreaksTable, userBadgesTable, contentTable } from "@workspace/db";
import { getOrCreateUser } from "./users";

const router = Router();

const BADGE_DEFS: Record<string, { name: string; description: string; icon: string }> = {
  "first-read": { name: "First Chapter", description: "Read your first article", icon: "📖" },
  "streak-7": { name: "Week Warrior", description: "7-day reading streak", icon: "🔥" },
  "streak-30": { name: "Monthly Devotee", description: "30-day reading streak", icon: "⭐" },
  "first-publish": { name: "Published Author", description: "Published your first piece", icon: "✍" },
  "ten-pieces": { name: "Prolific Writer", description: "Published 10 pieces", icon: "🏆" },
  "african-voice": { name: "African Voice", description: "Published in African Stories category", icon: "🌍" },
  "verified": { name: "Verified Creator", description: "Earned verification badge", icon: "✓" },
  "top-earner": { name: "Top Earner", description: "100+ purchases on your content", icon: "💰" },
};

async function awardBadge(userId: string, slug: string) {
  const existing = await db.select().from(userBadgesTable)
    .where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badgeSlug, slug))).limit(1);
  if (existing.length) return;
  await db.insert(userBadgesTable).values({ userId, badgeSlug: slug });
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// POST /api/gamification/read — record a read for streak
router.post("/read", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  await getOrCreateUser(userId);
  const today = todayStr();
  const yesterday = yesterdayStr();

  const existing = await db.select().from(userStreaksTable).where(eq(userStreaksTable.userId, userId)).limit(1);

  if (!existing.length) {
    await db.insert(userStreaksTable).values({
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastReadDate: today,
      totalReads: 1,
      xp: 10,
    });
    await awardBadge(userId, "first-read");
  } else {
    const s = existing[0];
    let streak = s.currentStreak;
    if (s.lastReadDate === today) {
      // already counted today
    } else if (s.lastReadDate === yesterday) {
      streak = s.currentStreak + 1;
    } else {
      streak = 1;
    }
    const longest = Math.max(s.longestStreak, streak);
    await db.update(userStreaksTable)
      .set({
        currentStreak: streak,
        longestStreak: longest,
        lastReadDate: today,
        totalReads: s.totalReads + 1,
        xp: s.xp + 10,
        writerLevel: Math.floor((s.xp + 10) / 100) + 1,
      })
      .where(eq(userStreaksTable.userId, userId));

    if (streak >= 7) await awardBadge(userId, "streak-7");
    if (streak >= 30) await awardBadge(userId, "streak-30");
  }

  const updated = await db.select().from(userStreaksTable).where(eq(userStreaksTable.userId, userId)).limit(1);
  res.json({
    currentStreak: updated[0]?.currentStreak ?? 1,
    longestStreak: updated[0]?.longestStreak ?? 1,
    totalReads: updated[0]?.totalReads ?? 1,
    xp: updated[0]?.xp ?? 10,
    writerLevel: updated[0]?.writerLevel ?? 1,
  });
});

// POST /api/gamification/publish — award writer badges
router.post("/publish", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const pieces = await db.select().from(contentTable).where(eq(contentTable.creatorId, userId));
  if (pieces.length === 1) await awardBadge(userId, "first-publish");
  if (pieces.length >= 10) await awardBadge(userId, "ten-pieces");
  if (pieces.some(p => p.categorySlug === "african-stories")) await awardBadge(userId, "african-voice");
  const totalPurchases = pieces.reduce((s, p) => s + p.purchaseCount, 0);
  if (totalPurchases >= 100) await awardBadge(userId, "top-earner");

  res.json({ ok: true });
});

router.get("/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const streak = await db.select().from(userStreaksTable).where(eq(userStreaksTable.userId, userId)).limit(1);
  const badges = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, userId));

  res.json({
    streak: streak[0] ? {
      currentStreak: streak[0].currentStreak,
      longestStreak: streak[0].longestStreak,
      totalReads: streak[0].totalReads,
      xp: streak[0].xp,
      writerLevel: streak[0].writerLevel,
    } : { currentStreak: 0, longestStreak: 0, totalReads: 0, xp: 0, writerLevel: 1 },
    badges: badges.map(b => ({
      slug: b.badgeSlug,
      earnedAt: b.earnedAt.toISOString(),
      ...BADGE_DEFS[b.badgeSlug],
    })),
    allBadges: Object.entries(BADGE_DEFS).map(([slug, def]) => ({
      slug,
      ...def,
      earned: badges.some(b => b.badgeSlug === slug),
    })),
  });
});

router.get("/leaderboard", async (_req, res): Promise<void> => {
  const rows = await db.select().from(userStreaksTable)
    .orderBy(desc(userStreaksTable.xp))
    .limit(20);
  res.json(rows.map(r => ({
    userId: r.userId,
    xp: r.xp,
    writerLevel: r.writerLevel,
    currentStreak: r.currentStreak,
  })).reverse());
});

export { awardBadge, BADGE_DEFS };
export default router;
