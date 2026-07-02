import { Link } from "wouter";
import { Reveal } from "@/components/Reveal";
import type { FeaturedContent, FeaturedByType } from "@/lib/dashboardApi";
import { ContentCover } from "@/components/ContentCover";
import { CreatorName } from "@/components/CreatorName";

const TYPE_COLUMNS = [
  { key: "article" as const, label: "Articles", mark: "✍", feedType: "article" },
  { key: "video" as const, label: "Video", mark: "▶", feedType: "video" },
  { key: "audio" as const, label: "Audio", mark: "♪", feedType: "audio" },
];

function MediaPlayOverlay({ type }: { type: string }) {
  if (type !== "video" && type !== "audio") return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      style={{ background: "rgba(28,25,23,0.12)" }}
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full text-sm"
        style={{ background: "rgba(28,25,23,0.82)", color: "#F7F3EC" }}
      >
        {type === "video" ? "▶" : "♪"}
      </span>
    </div>
  );
}

function FeaturedCard({ item, accent }: { item: FeaturedContent; accent: string }) {
  return (
    <Link href={`/content/${item.id}`} className="content-card-link block w-full">
      <article
        className="editorial-card flex w-full flex-col"
        style={{
          background: "#FFFFFF",
          border: "1px solid #BDB9B2",
          borderTop: `3px solid ${accent}`,
          cursor: "pointer",
        }}
      >
        <div className="content-card-cover relative">
          <ContentCover
            coverImageUrl={item.coverImageUrl}
            categorySlug={item.categorySlug}
            id={item.id}
            title={item.title}
            size="compact"
          />
          <MediaPlayOverlay type={item.type} />
        </div>
        <div className="content-card-body flex min-w-0 flex-col p-4">
          <p className="editorial-section-label mb-2 break-words" style={{ fontSize: "10px" }}>
            {item.categoryName}
          </p>
          <h3
            className="homepage-display mb-2 line-clamp-3 font-bold"
            style={{ fontSize: "1.05rem", lineHeight: 1.35 }}
          >
            {item.title}
          </h3>
          {item.previewText && (
            <p className="text-sm line-clamp-2 mb-3 homepage-body">
              {item.previewText}
            </p>
          )}
          <div
            className="flex items-center justify-between pt-2"
            style={{ borderTop: "1px solid #E7E3DC" }}
          >
            <CreatorName
              name={item.creatorName}
              verified={item.creatorVerified}
              className="text-xs homepage-body"
            />
            <span className="text-sm font-bold" style={{ color: "#C8960C" }}>
              {Number(item.price) === 0 ? "Free" : `$${Number(item.price).toFixed(2)}`}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function EmptyColumn({ label, mark, feedType }: { label: string; mark: string; feedType: string }) {
  return (
    <div
      className="h-full flex flex-col items-center justify-center p-6 text-center"
      style={{ background: "#FFFFFF", border: "1px dashed #BDB9B2", minHeight: "220px" }}
    >
      <span className="text-2xl mb-2 editorial-section-label">{mark}</span>
      <p className="homepage-body text-sm mb-3">
        No featured {label.toLowerCase()} yet
      </p>
      <Link href={`/feed?type=${feedType}`} className="text-xs font-semibold" style={{ color: "#C8960C" }}>
        Browse {label.toLowerCase()} →
      </Link>
    </div>
  );
}

export function FeaturedSection({
  byType,
  title = "Featured",
  subtitle = "Today's picks — articles, video, and audio",
}: {
  byType: FeaturedByType;
  title?: string;
  subtitle?: string;
}) {
  const hasAny = byType.article || byType.video || byType.audio;
  if (!hasAny) return null;

  const accents = { article: "#1C1917", video: "#C8960C", audio: "#2DD4BF" };

  return (
    <section style={{ borderTop: "2px solid #1C1917" }} className="pt-2 pb-6">
      <div className="mb-5">
        <span className="editorial-section-label">Spotlight</span>
        <div className="editorial-rule mt-1 mb-2" />
        <h2 className="font-bold homepage-display" style={{ fontSize: "1.5rem" }}>
          {title}
        </h2>
        <p className="text-sm mt-1 homepage-body">{subtitle}</p>
      </div>

      <Reveal stagger className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#BDB9B2]" style={{ border: "1px solid #BDB9B2" }}>
        {TYPE_COLUMNS.map((col) => {
          const item = byType[col.key];
          return (
            <div key={col.key} className="flex flex-col">
              <div
                className="px-4 py-3 flex items-center gap-2"
                style={{ background: "#ffffff", borderBottom: "1px solid rgba(0,0,0,0.12)" }}
              >
                <span style={{ fontSize: "14px" }}>{col.mark}</span>
                <span className="editorial-section-label" style={{ fontSize: "11px", letterSpacing: "0.12em" }}>
                  {col.label}
                </span>
              </div>
              <div className="flex-1">
                {item ? (
                  <FeaturedCard item={item} accent={accents[col.key]} />
                ) : (
                  <EmptyColumn label={col.label} mark={col.mark} feedType={col.feedType} />
                )}
              </div>
            </div>
          );
        })}
      </Reveal>
    </section>
  );
}
