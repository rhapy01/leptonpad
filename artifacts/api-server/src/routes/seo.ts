import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, contentTable } from "@workspace/db";

const router = Router();

// GET /api/seo/sitemap.xml
router.get("/sitemap.xml", async (_req, res): Promise<void> => {
  const baseUrl = process.env.PUBLIC_URL ?? "https://leptonpad.com";
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
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }

  const item = rows[0];
  const baseUrl = process.env.PUBLIC_URL ?? "https://leptonpad.com";
  const description = item.metaDescription ?? item.previewText ?? item.title;
  const url = `${baseUrl}/content/${item.id}`;

  res.json({
    title: item.title,
    description,
    canonicalUrl: url,
    og: {
      title: item.title,
      description,
      image: item.coverImageUrl,
      url,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description,
      image: item.coverImageUrl,
    },
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: item.title,
      description,
      image: item.coverImageUrl,
      datePublished: item.createdAt.toISOString(),
      dateModified: item.updatedAt.toISOString(),
      keywords: item.tags?.join(", "),
      inLanguage: item.language ?? "en",
    },
  });
});

export default router;
