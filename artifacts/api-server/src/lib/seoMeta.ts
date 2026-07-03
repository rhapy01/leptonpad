import type { InferSelectModel } from "drizzle-orm";
import type { contentTable } from "@workspace/db";

export type ContentSeoRow = Pick<
  InferSelectModel<typeof contentTable>,
  | "id"
  | "title"
  | "slug"
  | "previewText"
  | "metaDescription"
  | "coverImageUrl"
  | "published"
  | "createdAt"
  | "updatedAt"
  | "tags"
  | "language"
>;

export function getPublicBaseUrl(): string {
  const explicit = process.env.PUBLIC_URL ?? process.env.APP_URL;
  if (explicit?.trim()) {
    return explicit.trim().replace(/\/$/, "");
  }
  return "https://lepton-pad.vercel.app";
}

export function absolutizePublicUrl(url: string | null | undefined, base = getPublicBaseUrl()): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("https://")) return optimizeOgImage(trimmed);
  if (trimmed.startsWith("http://")) return optimizeOgImage(trimmed.replace(/^http:\/\//i, "https://"));
  if (trimmed.startsWith("//")) return optimizeOgImage(`https:${trimmed}`);
  return optimizeOgImage(`${base}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`);
}

/** Twitter/X cards render best at 1200×630. */
function optimizeOgImage(url: string): string {
  if (url.includes("res.cloudinary.com") && url.includes("/upload/") && !url.includes("/upload/w_")) {
    return url.replace("/upload/", "/upload/w_1200,h_630,c_fill,f_auto,q_auto/");
  }
  return url;
}

export function buildContentSeoFields(item: ContentSeoRow, base = getPublicBaseUrl()) {
  const description = (item.metaDescription ?? item.previewText ?? item.title).trim();
  const canonicalUrl = `${base}/content/${item.id}`;
  const image = absolutizePublicUrl(item.coverImageUrl, base);

  return {
    title: item.title.trim(),
    description,
    canonicalUrl,
    image,
    og: {
      title: item.title.trim(),
      description,
      image,
      url: canonicalUrl,
      type: "article" as const,
      siteName: "LeptonPad",
    },
    twitter: {
      card: "summary_large_image" as const,
      title: item.title.trim(),
      description,
      image,
    },
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: item.title,
      description,
      image,
      datePublished: item.createdAt.toISOString(),
      dateModified: item.updatedAt.toISOString(),
      keywords: item.tags?.join(", "),
      inLanguage: item.language ?? "en",
      mainEntityOfPage: canonicalUrl,
    },
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderContentShareHtml(
  item: ContentSeoRow,
  base = getPublicBaseUrl(),
): string {
  const meta = buildContentSeoFields(item, base);
  const title = escapeHtml(`${meta.title} | LeptonPad`);
  const headline = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const url = escapeHtml(meta.canonicalUrl);
  const image = meta.image ? escapeHtml(meta.image) : "";

  const imageTags = image
    ? `
    <meta property="og:image" content="${image}" />
    <meta property="og:image:secure_url" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:image" content="${image}" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:site_name" content="LeptonPad" />
    <meta property="og:title" content="${headline}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${url}" />${imageTags}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${headline}" />
    <meta name="twitter:description" content="${description}" />
    <script type="application/ld+json">${JSON.stringify(meta.structuredData)}</script>
  </head>
  <body>
    <p><a href="${url}">${headline}</a></p>
    <script>window.location.replace(${JSON.stringify(meta.canonicalUrl)});</script>
  </body>
</html>`;
}
