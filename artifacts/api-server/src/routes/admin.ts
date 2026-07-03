import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, usersTable, contentTable, paymentsTable, contentReportsTable, adCampaignsTable, adSubmissionsTable } from "@workspace/db";
import { getOrCreateUser } from "./users";
import { sendCreatorVerifiedEmail, sendNewsletterEmail, isEmailConfigured, htmlToPlainText } from "../lib/email";
import { sanitizeNewsletterHtml, assertMaxLength, MAX_NEWSLETTER_BODY_LENGTH } from "../lib/sanitizeHtml";
import { validateOptionalUrl } from "../lib/validateUrl";
import { computeExpiresAt, deactivateExpiredAds, durationLabel, parseDurationDays } from "../lib/adCampaigns";
import { adminRateLimit } from "../middlewares/rateLimit";
import { randomUUID } from "node:crypto";

const router = Router();
router.use(adminRateLimit);

async function requireAdmin(req: Parameters<typeof getAuth>[0]) {
  const { userId } = getAuth(req);
  if (!userId) return null;
  const user = await getOrCreateUser(userId);
  if (!user.isAdmin) return null;
  return user;
}

type AdCampaignRow = typeof adCampaignsTable.$inferSelect;

function serializeAdCampaign(a: AdCampaignRow) {
  return {
    id: a.id,
    title: a.title,
    advertiser: a.advertiser,
    imageUrl: a.imageUrl,
    targetUrl: a.targetUrl,
    categorySlug: a.categorySlug,
    active: a.active,
    expiresAt: a.expiresAt?.toISOString() ?? null,
    submissionId: a.submissionId,
    impressionCount: a.impressionCount,
    clickCount: a.clickCount,
    createdAt: a.createdAt.toISOString(),
  };
}

type AdSubmissionRow = typeof adSubmissionsTable.$inferSelect;

function serializeAdSubmission(s: AdSubmissionRow) {
  return {
    id: s.id,
    contactName: s.contactName,
    contactEmail: s.contactEmail,
    businessName: s.businessName,
    headline: s.headline,
    targetUrl: s.targetUrl,
    imageUrl: s.imageUrl,
    durationDays: s.durationDays,
    durationLabel: durationLabel(s.durationDays),
    categorySlug: s.categorySlug,
    status: s.status,
    adminNote: s.adminNote,
    campaignId: s.campaignId,
    submitterUserId: s.submitterUserId,
    reviewedAt: s.reviewedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

type AdCampaignBody = {
  title?: string;
  advertiser?: string;
  imageUrl?: string | null;
  targetUrl?: string;
  categorySlug?: string | null;
  active?: boolean;
  durationDays?: number;
  expiresAt?: string | null;
};

function parseAdCampaignFields(
  body: AdCampaignBody,
  mode: "create" | "update",
): { ok: true; data: Partial<typeof adCampaignsTable.$inferInsert> } | { ok: false; error: string } {
  const patch: Partial<typeof adCampaignsTable.$inferInsert> = {};

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) return { ok: false, error: "title is required" };
    if (title.length > 120) return { ok: false, error: "title must be 120 characters or fewer" };
    patch.title = title;
  } else if (mode === "create") {
    return { ok: false, error: "title is required" };
  }

  if (body.advertiser !== undefined) {
    const advertiser = body.advertiser.trim();
    if (!advertiser) return { ok: false, error: "advertiser is required" };
    if (advertiser.length > 80) return { ok: false, error: "advertiser must be 80 characters or fewer" };
    patch.advertiser = advertiser;
  } else if (mode === "create") {
    return { ok: false, error: "advertiser is required" };
  }

  if (body.targetUrl !== undefined) {
    const targetUrl = body.targetUrl.trim();
    if (!targetUrl) return { ok: false, error: "targetUrl is required" };
    try {
      patch.targetUrl = validateOptionalUrl(targetUrl, "targetUrl") ?? undefined;
      if (!patch.targetUrl) return { ok: false, error: "Invalid targetUrl — use http:// or https://" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Invalid targetUrl" };
    }
  } else if (mode === "create") {
    return { ok: false, error: "targetUrl is required" };
  }

  if (body.imageUrl !== undefined) {
    if (body.imageUrl === null || body.imageUrl.trim() === "") {
      patch.imageUrl = null;
    } else {
      try {
        patch.imageUrl = validateOptionalUrl(body.imageUrl, "imageUrl") ?? null;
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Invalid imageUrl" };
      }
    }
  }

  if (body.categorySlug !== undefined) {
    const slug = body.categorySlug?.trim() ?? "";
    patch.categorySlug = slug ? slug.toLowerCase() : null;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") return { ok: false, error: "active must be a boolean" };
    patch.active = body.active;
  }

  if (body.durationDays !== undefined) {
    const durationDays = parseDurationDays(body.durationDays);
    if (!durationDays) return { ok: false, error: "durationDays must be 7, 14, or 30" };
    patch.expiresAt = computeExpiresAt(durationDays);
  }

  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null || body.expiresAt === "") {
      patch.expiresAt = null;
    } else {
      const expires = new Date(body.expiresAt);
      if (Number.isNaN(expires.getTime())) {
        return { ok: false, error: "Invalid expiresAt date" };
      }
      patch.expiresAt = expires;
    }
  }

  return { ok: true, data: patch };
}

// GET /api/admin/overview
router.get("/overview", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  const [paymentStats] = await db
    .select({
      totalUsdcPaid: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)`,
      totalPayments: sql<number>`count(*)`,
    })
    .from(paymentsTable);

  const [contentStats] = await db
    .select({
      totalContent: sql<number>`count(*)`,
      featuredCount: sql<number>`count(*) filter (where ${contentTable.featured} = true)`,
    })
    .from(contentTable);

  const [userStats] = await db
    .select({
      totalUsers: sql<number>`count(*)`,
      verifiedCreators: sql<number>`count(*) filter (where ${usersTable.verified} = true)`,
    })
    .from(usersTable);

  const [submissionStats] = await db
    .select({
      pendingAdSubmissions: sql<number>`count(*) filter (where ${adSubmissionsTable.status} = 'pending')`,
    })
    .from(adSubmissionsTable);

  res.json({
    totalUsdcPaid: Number(paymentStats?.totalUsdcPaid ?? 0),
    totalPayments: Number(paymentStats?.totalPayments ?? 0),
    totalContent: Number(contentStats?.totalContent ?? 0),
    featuredCount: Number(contentStats?.featuredCount ?? 0),
    totalUsers: Number(userStats?.totalUsers ?? 0),
    verifiedCreators: Number(userStats?.verifiedCreators ?? 0),
    pendingAdSubmissions: Number(submissionStats?.pendingAdSubmissions ?? 0),
    emailConfigured: isEmailConfigured(),
  });
});

// GET /api/admin/users
router.get("/users", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(50);

  res.json(
    users.map(u => ({
      id: u.id,
      clerkId: u.clerkId,
      name: u.name,
      email: u.email,
      verified: u.verified,
      isAdmin: u.isAdmin,
      onboardingComplete: u.onboardingComplete,
      createdAt: u.createdAt.toISOString(),
    })),
  );
});

// GET /api/admin/reports — review user-submitted content reports
router.get("/reports", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  const reports = await db
    .select()
    .from(contentReportsTable)
    .orderBy(desc(contentReportsTable.createdAt))
    .limit(100);

  res.json(reports.map(r => ({
    id: r.id,
    contentId: r.contentId,
    reporterId: r.reporterId,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  })));
});

// PATCH /api/admin/users/:clerkId/verified — assign or revoke verification badge
router.patch("/users/:clerkId/verified", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  const targetClerkId = req.params.clerkId;
  const { verified } = req.body as { verified?: boolean };
  if (typeof verified !== "boolean") {
    res.status(400).json({ error: "verified boolean required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, targetClerkId)).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ verified })
    .where(eq(usersTable.clerkId, targetClerkId))
    .returning();

  if (verified && updated.email) {
    sendCreatorVerifiedEmail(updated.email, updated.name);
  }

  const { afterCreatorVerifiedChange } = await import("../lib/verifyCreator");
  const onChainSync = await afterCreatorVerifiedChange(targetClerkId);

  res.json({
    clerkId: updated.clerkId,
    name: updated.name,
    verified: updated.verified,
    onChainSync,
  });
});

// PATCH /api/admin/content/:id/featured
router.patch("/content/:id/featured", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid content id" });
    return;
  }

  const { featured } = req.body as { featured?: boolean };
  if (typeof featured !== "boolean") {
    res.status(400).json({ error: "featured boolean required" });
    return;
  }

  const [updated] = await db
    .update(contentTable)
    .set({ featured })
    .where(eq(contentTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Content not found" });
    return;
  }

  res.json({ id: updated.id, title: updated.title, featured: updated.featured });
});

// DELETE /api/admin/content/:id — remove content that violates terms
router.delete("/content/:id", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid content id" });
    return;
  }

  const items = await db.select().from(contentTable).where(eq(contentTable.id, id)).limit(1);
  if (!items.length) {
    res.status(404).json({ error: "Content not found" });
    return;
  }

  const removed = items[0];
  await db.delete(contentTable).where(eq(contentTable.id, id));

  res.json({
    id,
    title: removed.title,
    deleted: true,
    reason: (req.body as { reason?: string })?.reason ?? "terms violation",
  });
});

// GET /api/admin/ads — manage feed sponsored campaigns
router.get("/ads", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  await deactivateExpiredAds();

  const rows = await db
    .select()
    .from(adCampaignsTable)
    .orderBy(desc(adCampaignsTable.createdAt));

  res.json(rows.map(serializeAdCampaign));
});

// POST /api/admin/ads
router.post("/ads", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  const parsed = parseAdCampaignFields(req.body as AdCampaignBody, "create");
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const durationDays = parseDurationDays((req.body as AdCampaignBody).durationDays);
  const expiresAt = durationDays ? computeExpiresAt(durationDays) : null;

  const [created] = await db
    .insert(adCampaignsTable)
    .values({
      title: parsed.data.title!,
      advertiser: parsed.data.advertiser!,
      targetUrl: parsed.data.targetUrl!,
      imageUrl: parsed.data.imageUrl ?? null,
      categorySlug: parsed.data.categorySlug ?? null,
      active: parsed.data.active ?? true,
      expiresAt: parsed.data.expiresAt ?? expiresAt,
    })
    .returning();

  res.status(201).json(serializeAdCampaign(created));
});

// PATCH /api/admin/ads/:id
router.patch("/ads/:id", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ad id" });
    return;
  }

  const parsed = parseAdCampaignFields(req.body as AdCampaignBody, "update");
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(adCampaignsTable)
    .set(parsed.data)
    .where(eq(adCampaignsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Ad campaign not found" });
    return;
  }

  res.json(serializeAdCampaign(updated));
});

// DELETE /api/admin/ads/:id
router.delete("/ads/:id", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ad id" });
    return;
  }

  const [removed] = await db
    .delete(adCampaignsTable)
    .where(eq(adCampaignsTable.id, id))
    .returning({ id: adCampaignsTable.id, title: adCampaignsTable.title });

  if (!removed) {
    res.status(404).json({ error: "Ad campaign not found" });
    return;
  }

  res.json({ id: removed.id, title: removed.title, deleted: true });
});

// GET /api/admin/ad-submissions
router.get("/ad-submissions", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const rows = status
    ? await db
        .select()
        .from(adSubmissionsTable)
        .where(eq(adSubmissionsTable.status, status))
        .orderBy(desc(adSubmissionsTable.createdAt))
        .limit(100)
    : await db
        .select()
        .from(adSubmissionsTable)
        .orderBy(desc(adSubmissionsTable.createdAt))
        .limit(100);

  res.json(rows.map(serializeAdSubmission));
});

// PATCH /api/admin/ad-submissions/:id — approve or reject
router.patch("/ad-submissions/:id", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req);
  if (!admin) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid submission id" });
    return;
  }

  const { status, adminNote } = req.body as { status?: string; adminNote?: string };
  if (status !== "approved" && status !== "rejected") {
    res.status(400).json({ error: "status must be approved or rejected" });
    return;
  }

  const [existing] = await db
    .select()
    .from(adSubmissionsTable)
    .where(eq(adSubmissionsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  if (existing.status !== "pending") {
    res.status(409).json({ error: `Submission already ${existing.status}` });
    return;
  }

  const reviewedAt = new Date();
  const note = typeof adminNote === "string" && adminNote.trim() ? adminNote.trim() : null;

  if (status === "rejected") {
    const [updated] = await db
      .update(adSubmissionsTable)
      .set({
        status: "rejected",
        adminNote: note,
        reviewedByClerkId: admin.clerkId,
        reviewedAt,
      })
      .where(eq(adSubmissionsTable.id, id))
      .returning();
    res.json(serializeAdSubmission(updated));
    return;
  }

  const expiresAt = computeExpiresAt(existing.durationDays);
  const [campaign] = await db
    .insert(adCampaignsTable)
    .values({
      title: existing.headline,
      advertiser: existing.businessName,
      imageUrl: existing.imageUrl,
      targetUrl: existing.targetUrl,
      categorySlug: existing.categorySlug,
      active: true,
      expiresAt,
      submissionId: existing.id,
    })
    .returning();

  const [updated] = await db
    .update(adSubmissionsTable)
    .set({
      status: "approved",
      adminNote: note,
      reviewedByClerkId: admin.clerkId,
      reviewedAt,
      campaignId: campaign.id,
    })
    .where(eq(adSubmissionsTable.id, id))
    .returning();

  res.json({
    submission: serializeAdSubmission(updated),
    campaign: serializeAdCampaign(campaign),
  });
});

// POST /api/admin/newsletter — broadcast email to all users with an address
router.post("/newsletter", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }

  const { subject, body, preview } = req.body as {
    subject?: string;
    body?: string;
    preview?: boolean;
  };

  if (!subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: "subject and body are required" });
    return;
  }

  let bodyHtml: string;
  try {
    assertMaxLength(body.trim(), MAX_NEWSLETTER_BODY_LENGTH, "body");
    bodyHtml = sanitizeNewsletterHtml(body.trim());
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid newsletter body" });
    return;
  }

  const recipients = await db
    .select({ email: usersTable.email, name: usersTable.name })
    .from(usersTable)
    .where(sql`${usersTable.email} <> ''`);

  const withEmail = recipients.filter(r => r.email.includes("@"));

  if (preview) {
    res.json({
      preview: true,
      recipientCount: withEmail.length,
      subject: subject.trim(),
    });
    return;
  }

  if (!isEmailConfigured()) {
    res.status(503).json({ error: "Email not configured — set SMTP_USER and SMTP_PASS in .env" });
    return;
  }

  const batchId = randomUUID();
  const subjectTrimmed = subject.trim();
  const bodyText = htmlToPlainText(bodyHtml);

  for (const user of withEmail) {
    sendNewsletterEmail({
      to: user.email,
      name: user.name,
      subject: subjectTrimmed,
      bodyHtml,
      bodyText,
      batchId,
    });
  }

  res.json({
    sent: withEmail.length,
    subject: subjectTrimmed,
    batchId,
  });
});

export default router;
