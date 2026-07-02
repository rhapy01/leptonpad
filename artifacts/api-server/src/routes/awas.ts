import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, desc, gt } from "drizzle-orm";
import {
  db,
  competitionsTable,
  competitionEntriesTable,
  contentRightsTable,
  rightsInquiriesTable,
  contentTable,
} from "@workspace/db";
import { getOrCreateUser } from "./users";

const router = Router();

// ─── Competitions ────────────────────────────────────────────────────────────

router.get("/competitions", async (req, res): Promise<void> => {
  const status = (req.query.status as string) ?? "open";
  const now = new Date();
  const rows = await db.select().from(competitionsTable)
    .where(status === "open"
      ? and(eq(competitionsTable.status, "open"), gt(competitionsTable.deadline, now))
      : eq(competitionsTable.status, status))
    .orderBy(desc(competitionsTable.deadline));

  res.json(rows.map(c => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    description: c.description,
    theme: c.theme,
    region: c.region,
    language: c.language,
    prizeDescription: c.prizeDescription,
    deadline: c.deadline.toISOString(),
    status: c.status,
    coverImageUrl: c.coverImageUrl,
  })));
});

router.get("/competitions/:slug", async (req, res): Promise<void> => {
  const rows = await db.select().from(competitionsTable)
    .where(eq(competitionsTable.slug, req.params.slug)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }

  const c = rows[0];
  const entries = await db.select().from(competitionEntriesTable)
    .where(eq(competitionEntriesTable.competitionId, c.id))
    .orderBy(desc(competitionEntriesTable.createdAt))
    .limit(50);

  res.json({
    ...c,
    deadline: c.deadline.toISOString(),
    createdAt: c.createdAt.toISOString(),
    entryCount: entries.length,
    entries: entries.map(e => ({
      id: e.id,
      title: e.title,
      excerpt: e.excerpt,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

router.post("/competitions/:id/enter", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const competitionId = parseInt(req.params.id, 10);
  const { title, excerpt, contentId } = req.body as {
    title?: string; excerpt?: string; contentId?: number;
  };
  if (!title?.trim()) { res.status(400).json({ error: "title required" }); return; }

  const comp = await db.select().from(competitionsTable).where(eq(competitionsTable.id, competitionId)).limit(1);
  if (!comp.length || comp[0].deadline < new Date()) {
    res.status(400).json({ error: "Competition closed" });
    return;
  }

  await getOrCreateUser(userId);
  const [entry] = await db.insert(competitionEntriesTable).values({
    competitionId,
    userId,
    contentId: contentId ?? null,
    title: title.trim(),
    excerpt: excerpt ?? null,
  }).returning();

  res.status(201).json({
    id: entry.id,
    title: entry.title,
    status: entry.status,
    createdAt: entry.createdAt.toISOString(),
  });
});

// ─── Rights & licensing ──────────────────────────────────────────────────────

router.get("/rights", async (req, res): Promise<void> => {
  const type = req.query.type as string | undefined;
  const baseQuery = db.select({
    right: contentRightsTable,
    contentTitle: contentTable.title,
    contentCover: contentTable.coverImageUrl,
  })
    .from(contentRightsTable)
    .leftJoin(contentTable, eq(contentRightsTable.contentId, contentTable.id))
    .orderBy(desc(contentRightsTable.createdAt))
    .limit(50);

  const rows = type
    ? await baseQuery.where(eq(contentRightsTable.rightsType, type))
    : await baseQuery;

  res.json(rows.map(r => ({
    id: r.right.id,
    contentId: r.right.contentId,
    contentTitle: r.contentTitle,
    contentCover: r.contentCover,
    rightsType: r.right.rightsType,
    territory: r.right.territory,
    language: r.right.language,
    status: r.right.status,
    licenseTerms: r.right.licenseTerms,
  })));
});

router.post("/rights", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { contentId, rightsType, territory, language, licenseTerms, contactEmail } = req.body as {
    contentId?: number; rightsType?: string; territory?: string;
    language?: string; licenseTerms?: string; contactEmail?: string;
  };
  if (!contentId || !rightsType) { res.status(400).json({ error: "contentId and rightsType required" }); return; }

  const content = await db.select().from(contentTable).where(eq(contentTable.id, contentId)).limit(1);
  if (!content.length || content[0].creatorId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const [right] = await db.insert(contentRightsTable).values({
    contentId,
    ownerId: userId,
    rightsType,
    territory: territory ?? null,
    language: language ?? null,
    licenseTerms: licenseTerms ?? null,
    contactEmail: contactEmail ?? null,
    status: "available",
  }).returning();

  res.status(201).json({
    id: right.id,
    contentId: right.contentId,
    rightsType: right.rightsType,
    status: right.status,
  });
});

router.post("/rights/:id/inquire", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rightsId = parseInt(req.params.id, 10);
  const { message } = req.body as { message?: string };
  if (!message?.trim()) { res.status(400).json({ error: "message required" }); return; }

  const [inq] = await db.insert(rightsInquiriesTable).values({
    rightsId,
    inquirerId: userId,
    message: message.trim(),
  }).returning();

  res.status(201).json({ id: inq.id, status: inq.status });
});

router.get("/rights/mine", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db.select({
    right: contentRightsTable,
    contentTitle: contentTable.title,
  })
    .from(contentRightsTable)
    .leftJoin(contentTable, eq(contentRightsTable.contentId, contentTable.id))
    .where(eq(contentRightsTable.ownerId, userId));

  const inquiries = await db.select().from(rightsInquiriesTable)
    .where(eq(rightsInquiriesTable.inquirerId, userId));

  res.json({
    listings: rows.map(r => ({
      id: r.right.id,
      contentTitle: r.contentTitle,
      rightsType: r.right.rightsType,
      status: r.right.status,
    })),
    inquiries: inquiries.map(i => ({
      id: i.id,
      rightsId: i.rightsId,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
    })),
  });
});

export default router;
