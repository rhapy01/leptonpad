import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, usersTable, contentTable, paymentsTable } from "@workspace/db";
import { getOrCreateUser } from "./users";
import { sendCreatorVerifiedEmail, sendNewsletterEmail, isEmailConfigured, htmlToPlainText } from "../lib/email";
import { randomUUID } from "node:crypto";

const router = Router();

async function requireAdmin(req: Parameters<typeof getAuth>[0]) {
  const { userId } = getAuth(req);
  if (!userId) return null;
  const user = await getOrCreateUser(userId);
  if (!user.isAdmin) return null;
  return user;
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

  res.json({
    totalUsdcPaid: Number(paymentStats?.totalUsdcPaid ?? 0),
    totalPayments: Number(paymentStats?.totalPayments ?? 0),
    totalContent: Number(contentStats?.totalContent ?? 0),
    featuredCount: Number(contentStats?.featuredCount ?? 0),
    totalUsers: Number(userStats?.totalUsers ?? 0),
    verifiedCreators: Number(userStats?.verifiedCreators ?? 0),
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
      sampleRecipient: withEmail[0]?.email ?? null,
    });
    return;
  }

  if (!isEmailConfigured()) {
    res.status(503).json({ error: "Email not configured — set SMTP_USER and SMTP_PASS in .env" });
    return;
  }

  const batchId = randomUUID();
  const subjectTrimmed = subject.trim();
  const bodyHtml = body.trim();
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
