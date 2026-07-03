import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, contentTable } from "@workspace/db";
import { buildContentSeoFields, getPublicBaseUrl, renderContentShareHtml } from "../lib/seoMeta";

const router = Router();

// GET /api/seo/sitemap.xml
router.get("/sitemap.xml", async (_req, res): Promise<void> => {
  const baseUrl = getPublicBaseUrl();
  const rows = await db.select({ id: contentTable.id, slug: contentTable.slug, updatedAt: contentTable.updatedAt })
    .from(contentTable)
    .where(eq(contentTable.published, true))
    .limit(500);

  const urls = [
    { loc: baseUrl, priority: "1.0" },
    { loc: `${baseUrl}/feed`, priority: "0.9" },
    ...rows.map(r => ({
      loc: `${baseUrl}/content/${r.id}`,
      lastmod: r.updatedAt.toISOString().split("T")[0],
      priority: "0.8",
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    ${"lastmod" in u && u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.send(xml);
});

// GET /api/seo/content/:id/meta
router.get("/content/:id/meta", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.select().from(contentTable).where(eq(contentTable.id, id)).limit(1);
  if (!rows.length || !rows[0].published) { res.status(404).json({ error: "Not found" }); return; }

  res.json(buildContentSeoFields(rows[0]));
});

// GET /api/seo/content/:id/card — HTML with Open Graph tags for social crawlers
router.get("/content/:id/card", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).send("Invalid id"); return; }

  const rows = await db.select().from(contentTable).where(eq(contentTable.id, id)).limit(1);
  if (!rows.length || !rows[0].published) { res.status(404).send("Not found"); return; }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
  res.send(renderContentShareHtml(rows[0]));
});

export default router;
