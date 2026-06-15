import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable, contentTable, paymentsTable, categoriesTable } from "@workspace/db";
import {
  UpdateMeBody,
} from "@workspace/api-zod";

const router = Router();

// JIT provision helper
async function getOrCreateUser(clerkId: string) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (existing.length > 0) return existing[0];

  // Fetch from Clerk
  const clerkUser = await clerkClient.users.getUser(clerkId);
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || clerkUser.username || email.split("@")[0] || "Anonymous";
  const imageUrl = clerkUser.imageUrl ?? null;

  const [user] = await db.insert(usersTable).values({
    clerkId,
    name,
    email,
    imageUrl,
    selectedCategories: [],
    onboardingComplete: false,
  }).returning();
  return user;
}

// GET /api/users/me
router.get("/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getOrCreateUser(userId);
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    name: user.name,
    email: user.email,
    imageUrl: user.imageUrl,
    walletAddress: user.walletAddress,
    selectedCategories: user.selectedCategories,
    onboardingComplete: user.onboardingComplete,
    createdAt: user.createdAt.toISOString(),
  });
});

// PUT /api/users/me
router.put("/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await getOrCreateUser(userId);
  const [updated] = await db.update(usersTable)
    .set({
      ...(parsed.data.walletAddress !== undefined ? { walletAddress: parsed.data.walletAddress } : {}),
      ...(parsed.data.selectedCategories !== undefined ? { selectedCategories: parsed.data.selectedCategories } : {}),
      ...(parsed.data.onboardingComplete !== undefined ? { onboardingComplete: parsed.data.onboardingComplete } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    })
    .where(eq(usersTable.clerkId, userId))
    .returning();

  res.json({
    id: updated.id,
    clerkId: updated.clerkId,
    name: updated.name,
    email: updated.email,
    imageUrl: updated.imageUrl,
    walletAddress: updated.walletAddress,
    selectedCategories: updated.selectedCategories,
    onboardingComplete: updated.onboardingComplete,
    createdAt: updated.createdAt.toISOString(),
  });
});

// GET /api/users/me/purchases
router.get("/me/purchases", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({
      id: paymentsTable.id,
      contentId: paymentsTable.contentId,
      contentTitle: contentTable.title,
      contentType: contentTable.type,
      creatorId: paymentsTable.creatorId,
      amountPaid: paymentsTable.amount,
      paidAt: paymentsTable.paidAt,
    })
    .from(paymentsTable)
    .leftJoin(contentTable, eq(paymentsTable.contentId, contentTable.id))
    .where(eq(paymentsTable.readerId, userId))
    .orderBy(paymentsTable.paidAt);

  // Get creator names
  const creatorIds = [...new Set(rows.map(r => r.creatorId))];
  const nameMap: Record<string, string> = {};
  await Promise.all(
    creatorIds.map(async id => {
      try {
        const u = await clerkClient.users.getUser(id);
        nameMap[id] = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || "Creator";
      } catch { nameMap[id] = "Creator"; }
    })
  );

  res.json(rows.map(r => ({
    id: r.id,
    contentId: r.contentId,
    contentTitle: r.contentTitle ?? "Unknown",
    contentType: r.contentType ?? "article",
    creatorName: nameMap[r.creatorId] ?? "Creator",
    amountPaid: Number(r.amountPaid),
    paidAt: r.paidAt.toISOString(),
  })));
});

export { getOrCreateUser };
export default router;
