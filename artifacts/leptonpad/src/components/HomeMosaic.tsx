import { Link } from "wouter";
import { ContentCover } from "@/components/ContentCover";
import { CreatorName } from "@/components/CreatorName";
import { Reveal } from "@/components/Reveal";
import type { FeaturedByType, FeaturedContent } from "@/lib/dashboardApi";
import type { Content } from "@workspace/api-client-react";

export type MosaicItem = {
  id: number;
  title: string;
  type: string;
  categoryName: string;
  categorySlug: string;
  coverImageUrl: string | null;
  price: number;
  creatorName: string;
  creatorVerified?: boolean;
  previewText?: string | null;
};

function toMosaic(item: Content | FeaturedContent): MosaicItem {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    categoryName: item.categoryName,
    categorySlug: item.categorySlug,
    coverImageUrl: item.coverImageUrl ?? null,
    price: item.price,
    creatorName: item.creatorName,
    creatorVerified: "creatorVerified" in item ? item.creatorVerified : false,
    previewText: item.previewText,
  };
}

export function buildMosaicItems(
  featured: FeaturedByType,
  feed: Content[],
): { rest: MosaicItem[] } {
  const featuredIds = new Set(
    [featured.article?.id, featured.video?.id, featured.audio?.id].filter(
      (id): id is number => id != null,
    ),
  );

  const rest = feed
    .filter(i => !featuredIds.has(i.id))
    .slice(0, 8)
    .map(toMosaic);

  return { rest };
}

/** Same vertical card layout as the feed — image on top, metadata below. */
function PublicationCard({
  item,
  variant,
}: {
  item: MosaicItem;
  variant: "lead" | "medium" | "small";
}) {
  const isLead = variant === "lead";
  const isFree = Number(item.price) === 0;

  return (
    <Link href={`/content/${item.id}`} className="content-card-link block w-full">
      <article
        className="editorial-card group flex w-full flex-col"
        style={{
          background: "#FFFFFF",
          border: "1px solid rgba(28,25,23,0.12)",
          cursor: "pointer",
        }}
      >
        <div className="content-card-cover">
          <ContentCover
            coverImageUrl={item.coverImageUrl}
            categorySlug={item.categorySlug}
            id={item.id}
            title={item.title}
            size={isLead ? "featured" : "compact"}
          />
        </div>

        <div className="content-card-body flex min-w-0 flex-col" style={{ padding: isLead ? "20px 22px" : "14px 16px" }}>
          <div className="content-card-meta">
            <span className="editorial-label">{item.categoryName}</span>
          </div>

          <div style={{ borderTop: "1px solid rgba(28,25,23,0.15)", marginBottom: "12px" }} />

          <h3
            className="homepage-display mb-3 leading-snug"
            style={{
              fontSize: isLead ? "1.25rem" : variant === "medium" ? "1.05rem" : "0.95rem",
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            {item.title}
          </h3>

          {isLead && item.previewText && (
            <p className="homepage-body mb-4 line-clamp-2" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
              {item.previewText}
            </p>
          )}

          <div
            className="flex flex-wrap items-center justify-between gap-2 pt-3"
            style={{ borderTop: "1px solid rgba(28,25,23,0.08)" }}
          >
            <CreatorName
              name={item.creatorName}
              verified={item.creatorVerified}
              style={{ fontSize: "11px", color: "var(--color-ink-muted)" }}
            />
            {isFree ? (
              <span
                className="text-xs font-medium px-2 py-0.5"
                style={{
                  background: "rgba(28,25,23,0.06)",
                  color: "var(--color-ink-muted)",
                  borderRadius: "2px",
                  fontSize: "10px",
                }}
              >
                FREE
              </span>
            ) : (
              <span
                className="font-bold"
                style={{
                  color: "#C8960C",
                  fontSize: "13px",
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}
              >
                ${Number(item.price).toFixed(Number(item.price) < 0.01 ? 6 : 2)}
                <span style={{ fontSize: "10px", fontWeight: 400, fontFamily: "Inter, sans-serif", color: "#A07810", marginLeft: "2px" }}>
                  USDC
                </span>
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

export function HomeMosaic({
  featured,
  feed,
}: {
  featured: FeaturedByType;
  feed: Content[];
}) {
  const { rest } = buildMosaicItems(featured, feed);

  if (rest.length === 0) {
    return (
      <div className="homepage-body py-16 text-center">
        <p>No publications yet.</p>
        <Link href="/dashboard/creator" className="mt-3 inline-block text-sm font-semibold" style={{ color: "#C8960C" }}>
          Open creator dashboard →
        </Link>
      </div>
    );
  }

  return (
    <section className="py-4" style={{ borderTop: "2px solid #1C1917" }}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="editorial-section-label">Now publishing</span>
          <div className="editorial-rule mt-1" />
        </div>
        <Link href="/feed">
          <span className="interactive-cta homepage-body border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "#1C1917" }}>
            All publications →
          </span>
        </Link>
      </div>

      <Reveal stagger className="grid grid-cols-2 items-start gap-3 lg:grid-cols-4">
        {rest.map((item, index) => (
          <div key={item.id} className={index === 0 ? "col-span-2" : "col-span-1"}>
            <PublicationCard item={item} variant={index === 0 ? "lead" : "small"} />
          </div>
        ))}
      </Reveal>
    </section>
  );
}
