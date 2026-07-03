import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq, inArray, desc } from "drizzle-orm";
import { db, usersTable, contentTable, paymentsTable, categoriesTable } from "@workspace/db";
import {
  UpdateMeBody,
} from "@workspace/api-zod";
import { provisionUserWallet, reconcileWalletAddress } from "../lib/appWallet";
import { validateOptionalUrl } from "../lib/validateUrl";
import {
  parseInitialAdminEmails,
  extractClerkProfile,
  clerkMatchesAdminAllowlist,
  emailMatchesAdminAllowlist,
} from "../lib/clerkUserProfile";

const router = Router();

const INITIAL_ADMIN_EMAILS = parseInitialAdminEmails(process.env.INITIAL_ADMIN_EMAILS);

async function promoteAdminIfConfigured(user: typeof usersTable.$inferSelect) {
  if (user.isAdmin) return user;
  if (emailMatchesAdminAllowlist(user.email, INITIAL_ADMIN_EMAILS)) {
    const [updated] = await db
      .update(usersTable)
      .set({ isAdmin: true })
      .where(eq(usersTable.clerkId, user.clerkId))
      .returning();
    return updated ?? user;
  }

  try {
    const clerkUser = await clerkClient.users.getUser(user.clerkId);
    const profile = extractClerkProfile(clerkUser);
    if (!clerkMatchesAdminAllowlist(profile, INITIAL_ADMIN_EMAILS)) return user;
    const [updated] = await db
      .update(usersTable)
      .set({ isAdmin: true })
      .where(eq(usersTable.clerkId, user.clerkId))
      .returning();
    return updated ?? user;
  } catch {
    return user;
  }
}

async function syncUserFromClerk(
  user: typeof usersTable.$inferSelect,
  clerkUser: Awaited<ReturnType<typeof clerkClient.users.getUser>>,
) {
  const profile = extractClerkProfile(clerkUser);
  const patch: Partial<typeof usersTable.$inferInsert> = {};

  if (profile.name && profile.name !== user.name) patch.name = profile.name;
  if (profile.imageUrl !== user.imageUrl) patch.imageUrl = profile.imageUrl;

  const shouldBeAdmin =
    user.isAdmin || clerkMatchesAdminAllowlist(profile, INITIAL_ADMIN_EMAILS);
  if (shouldBeAdmin && !user.isAdmin) patch.isAdmin = true;

  const nextEmail = profile.primaryEmail || user.email;
  if (
    nextEmail &&
    nextEmail !== user.email.toLowerCase() &&
    !nextEmail.endsWith("@users.leptonpad.local")
  ) {
    const [conflict] = await db
      .select({ clerkId: usersTable.clerkId })
      .from(usersTable)
      .where(eq(usersTable.email, nextEmail))
      .limit(1);
    if (!conflict || conflict.clerkId === user.clerkId) {
      patch.email = nextEmail;
    }
  }

  if (Object.keys(patch).length === 0) return user;

  const [updated] = await db
    .update(usersTable)
    .set(patch)
    .where(eq(usersTable.clerkId, user.clerkId))
    .returning();
  return updated ?? user;
}

// JIT provision helper
async function getOrCreateUser(clerkId: string) {
  const clerkUser = await clerkClient.users.getUser(clerkId);
  const profile = extractClerkProfile(clerkUser);
  const email =
    profile.primaryEmail || `noemail+${clerkId}@users.leptonpad.local`;
  const { name, imageUrl } = profile;

  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (existing.length > 0) {
    const synced = await syncUserFromClerk(existing[0], clerkUser);
    const promoted = await promoteAdminIfConfigured(synced);
    if (!promoted.walletAddress) {
      return provisionUserWallet(clerkId);
    }
    return promoted;
  }

  // Same email, new Clerk user id (re-sign-up / OAuth vs email) — relink instead of failing unique constraint.
  if (profile.primaryEmail) {
    const byEmail = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (byEmail.length > 0) {
      const shouldBeAdmin =
        byEmail[0].isAdmin || clerkMatchesAdminAllowlist(profile, INITIAL_ADMIN_EMAILS);
      const [relinked] = await db
        .update(usersTable)
        .set({
          clerkId,
          name,
          imageUrl,
          isAdmin: shouldBeAdmin,
        })
        .where(eq(usersTable.email, email))
        .returning();
      const promoted = await promoteAdminIfConfigured(relinked);
      if (!promoted.walletAddress) {
        return provisionUserWallet(clerkId);
      }
      return promoted;
    }

    // Any allowlisted email on this Clerk account (e.g. secondary email) — relink existing row.
    for (const altEmail of profile.allEmails) {
      if (altEmail === email) continue;
      if (!emailMatchesAdminAllowlist(altEmail, INITIAL_ADMIN_EMAILS)) continue;
      const [byAlt] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, altEmail))
        .limit(1);
      if (byAlt.length > 0) {
        const [relinked] = await db
          .update(usersTable)
          .set({
            clerkId,
            name,
            imageUrl,
            email: profile.primaryEmail || byAlt[0].email,
            isAdmin: true,
          })
          .where(eq(usersTable.email, altEmail))
          .returning();
        const promoted = await promoteAdminIfConfigured(relinked);
        if (!promoted.walletAddress) {
          return provisionUserWallet(clerkId);
        }
        return promoted;
      }
    }
  }

  const isAdmin = clerkMatchesAdminAllowlist(profile, INITIAL_ADMIN_EMAILS);

  try {
    const [user] = await db
      .insert(usersTable)
      .values({
        clerkId,
        name,
        email,
        imageUrl,
        selectedCategories: [],
        onboardingComplete: false,
        isAdmin,
      })
      .returning();

    if (profile.primaryEmail) {
      const { sendWelcomeEmail } = await import("../lib/email");
      sendWelcomeEmail(profile.primaryEmail, name);
    }

    return provisionUserWallet(clerkId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("unique") || message.includes("duplicate")) {
      const fallback = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
      if (fallback.length > 0) return fallback[0];
      const byEmail = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (byEmail.length > 0) {
        const [relinked] = await db
          .update(usersTable)
          .set({ clerkId, name, imageUrl, isAdmin: byEmail[0].isAdmin || isAdmin })
          .where(eq(usersTable.email, email))
          .returning();
        if (!relinked.walletAddress) {
          return provisionUserWallet(clerkId);
        }
        return relinked;
      }
    }
    throw err;
  }
}

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    clerkId: user.clerkId,
    name: user.name,
    email: user.email,
    imageUrl: user.imageUrl,
    bannerUrl: user.bannerUrl,
    walletAddress: user.walletAddress,
    selectedCategories: user.selectedCategories,
    onboardingComplete: user.onboardingComplete,
    verified: user.verified,
    isAdmin: user.isAdmin,
    bio: user.bio,
    website: user.website,
    twitterUrl: user.twitterUrl,
    linkedinUrl: user.linkedinUrl,
    country: user.country,
    language: user.language,
    createdAt: user.createdAt.toISOString(),
  };
}

// GET /api/users/me
router.get("/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const user = await reconcileWalletAddress(await getOrCreateUser(userId));
    res.json(serializeUser(user));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load user";
    res.status(500).json({ error: message });
  }
});

// PUT /api/users/me
router.put("/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if ((req.body as { walletAddress?: string }).walletAddress !== undefined) {
    res.status(403).json({ error: "walletAddress cannot be changed — use your provisioned in-app wallet" });
    return;
  }

  await getOrCreateUser(userId);

  const before = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  const wasOnboarded = before[0]?.onboardingComplete ?? false;

  let website: string | null | undefined;
  let twitterUrl: string | null | undefined;
  let linkedinUrl: string | null | undefined;
  try {
    website = validateOptionalUrl((parsed.data as { website?: string }).website, "website");
    twitterUrl = validateOptionalUrl((parsed.data as { twitterUrl?: string }).twitterUrl, "twitter");
    linkedinUrl = validateOptionalUrl((parsed.data as { linkedinUrl?: string }).linkedinUrl, "linkedin");
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid URL" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({
      ...(parsed.data.selectedCategories !== undefined ? { selectedCategories: parsed.data.selectedCategories } : {}),
      ...(parsed.data.onboardingComplete !== undefined ? { onboardingComplete: parsed.data.onboardingComplete } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...((parsed.data as { bio?: string }).bio !== undefined ? { bio: (parsed.data as { bio?: string }).bio } : {}),
      ...(website !== undefined ? { website } : {}),
      ...(twitterUrl !== undefined ? { twitterUrl } : {}),
      ...(linkedinUrl !== undefined ? { linkedinUrl } : {}),
      ...((parsed.data as { imageUrl?: string }).imageUrl !== undefined ? { imageUrl: (parsed.data as { imageUrl?: string }).imageUrl } : {}),
      ...((parsed.data as { bannerUrl?: string }).bannerUrl !== undefined ? { bannerUrl: (parsed.data as { bannerUrl?: string }).bannerUrl } : {}),
      ...((parsed.data as { country?: string }).country !== undefined ? { country: (parsed.data as { country?: string }).country } : {}),
      ...((parsed.data as { language?: string }).language !== undefined ? { language: (parsed.data as { language?: string }).language } : {}),
    })
    .where(eq(usersTable.clerkId, userId))
    .returning();

  if (
    !wasOnboarded &&
    updated.onboardingComplete &&
    updated.email
  ) {
    const { sendOnboardingCompleteEmail } = await import("../lib/email");
    sendOnboardingCompleteEmail(updated.email, updated.name);
  }

  res.json(serializeUser(updated));
});

// POST /api/users/:clerkId/verify — admin only
router.post("/:clerkId/verify", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Check if requester is an admin
  const requester = await getOrCreateUser(userId);
  if (!requester.isAdmin) { res.status(403).json({ error: "Forbidden: admin only" }); return; }

  const targetClerkId = req.params.clerkId;
  const { verified } = req.body as { verified: boolean };

  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, targetClerkId)).limit(1);
  if (!existing.length) { res.status(404).json({ error: "User not found" }); return; }

  const [updated] = await db.update(usersTable)
    .set({ verified: !!verified })
    .where(eq(usersTable.clerkId, targetClerkId))
    .returning();

  if (verified && updated.email) {
    const { sendCreatorVerifiedEmail } = await import("../lib/email");
    sendCreatorVerifiedEmail(updated.email, updated.name);
  }

  const { afterCreatorVerifiedChange } = await import("../lib/verifyCreator");
  const onChainSync = await afterCreatorVerifiedChange(targetClerkId);

  res.json({ ...serializeUser(updated), onChainSync });
});

// GET /api/users/me/purchases
router.get("/me/purchases", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { paymentGrantsAccess } = await import("../lib/recordPayment");

  const rows = await db
    .select({
      id: paymentsTable.id,
      contentId: paymentsTable.contentId,
      contentTitle: contentTable.title,
      contentType: contentTable.type,
      creatorId: paymentsTable.creatorId,
      amountPaid: paymentsTable.amount,
      paidAt: paymentsTable.paidAt,
      txHash: paymentsTable.txHash,
      splitTxHash: paymentsTable.splitTxHash,
    })
    .from(paymentsTable)
    .leftJoin(contentTable, eq(paymentsTable.contentId, contentTable.id))
    .where(eq(paymentsTable.readerId, userId))
    .orderBy(desc(paymentsTable.paidAt));

  const granted = rows.filter((r) =>
    paymentGrantsAccess({ txHash: r.txHash, splitTxHash: r.splitTxHash }),
  );

  // Get creator names and verified status
  const creatorIds = [...new Set(granted.map(r => r.creatorId))];
  const nameMap: Record<string, string> = {};
  const verifiedMap: Record<string, boolean> = {};
  const dbUsers = creatorIds.length > 0
    ? await db.select({ clerkId: usersTable.clerkId, verified: usersTable.verified })
        .from(usersTable)
        .where(inArray(usersTable.clerkId, creatorIds))
    : [];
  for (const u of dbUsers) verifiedMap[u.clerkId] = u.verified;

  await Promise.all(
    creatorIds.map(async id => {
      try {
        const u = await clerkClient.users.getUser(id);
        nameMap[id] = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username || "Creator";
      } catch { nameMap[id] = "Creator"; }
    })
  );

  res.json(granted.map(r => ({
    id: r.id,
    contentId: r.contentId,
    contentTitle: r.contentTitle ?? "Unknown",
    contentType: r.contentType ?? "article",
    creatorName: nameMap[r.creatorId] ?? "Creator",
    creatorVerified: verifiedMap[r.creatorId] ?? false,
    amountPaid: Number(r.amountPaid),
    paidAt: r.paidAt.toISOString(),
    txHash: r.txHash,
    splitTxHash: r.splitTxHash,
    settlementStatus: r.splitTxHash ? "settled" : r.txHash ? "pending" : "recorded",
  })));
});

export { getOrCreateUser };
export default router;
