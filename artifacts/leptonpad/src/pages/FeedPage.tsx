import { useState } from "react";
import { Link } from "wouter";
import { useListContent, useListCategories, useGetMe } from "@workspace/api-client-react";
import type { Content } from "@workspace/api-client-react";
import { PlatformLayout } from "@/components/PlatformLayout";

const TYPE_LABELS: Record<string, string> = {
  article: "Article",
  audio: "Audio",
  video: "Video",
};

const TYPE_MARKS: Record<string, string> = {
  article: "✍",
  audio: "♪",
  video: "▶",
};

function ContentCard({
  item,
  featured = false,
}: {
  item: Content;
  featured?: boolean;
}) {
  const isFree = Number(item.price) === 0;

  return (
    <Link href={`/content/${item.id}`} data-testid={`card-content-${item.id}`}>
      <article
        className="group editorial-card h-full flex flex-col"
        style={{
          background: "#FFFFFF",
          border: "1px solid rgba(28,25,23,0.12)",
          borderRadius: "2px",
          padding: featured ? "24px" : "18px 20px",
          cursor: "pointer",
          transition: "box-shadow 0.2s ease, border-color 0.2s ease",
        }}
        onMouseOver={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(28,25,23,0.08)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(28,25,23,0.3)";
        }}
        onMouseOut={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(28,25,23,0.12)";
        }}
      >
        {/* Section label */}
        <div className="flex items-center gap-2 mb-3">
          <span className="editorial-label" style={{ color: "#78716C" }}>
            {TYPE_MARKS[item.type]} {TYPE_LABELS[item.type] ?? item.type}
          </span>
          <span style={{ color: "rgba(28,25,23,0.2)", fontSize: "10px" }}>·</span>
          <span className="editorial-label" style={{ color: "#78716C" }}>{item.categoryName}</span>
        </div>

        {/* Rule */}
        <div style={{ borderTop: "1px solid rgba(28,25,23,0.15)", marginBottom: "12px" }} />

        {/* Title */}
        <h3
          className="leading-snug mb-3 flex-1"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: featured ? "1.25rem" : "1rem",
            fontWeight: 700,
            color: "#1C1917",
            lineHeight: featured ? "1.4" : "1.45",
          }}
        >
          {item.title}
        </h3>

        {/* Preview text */}
        {item.previewText && (
          <p
            className="mb-4 line-clamp-2"
            style={{
              fontSize: "0.8125rem",
              color: "#78716C",
              lineHeight: "1.6",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {item.previewText}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: "1px solid rgba(28,25,23,0.08)" }}>
          <div className="flex items-center gap-2">
            {item.creatorImageUrl ? (
              <img src={item.creatorImageUrl} alt={item.creatorName} className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: "rgba(28,25,23,0.08)" }}
              >
                <span style={{ fontSize: "9px", color: "#78716C" }}>{item.creatorName[0]?.toUpperCase()}</span>
              </div>
            )}
            <span style={{ fontSize: "11px", color: "#78716C" }}>{item.creatorName}</span>
            <span style={{ fontSize: "11px", color: "rgba(28,25,23,0.3)" }}>·</span>
            <span style={{ fontSize: "11px", color: "#78716C" }}>
              {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
          {isFree ? (
            <span
              className="text-xs font-medium px-2 py-0.5"
              style={{
                background: "rgba(28,25,23,0.06)",
                color: "#78716C",
                borderRadius: "2px",
                fontSize: "10px",
                letterSpacing: "0.04em",
              }}
            >
              FREE
            </span>
          ) : (
            <span
              className="font-bold"
              style={{ color: "#C8960C", fontSize: "13px", fontFamily: "'Playfair Display', Georgia, serif" }}
              data-testid={`text-price-${item.id}`}
            >
              ${Number(item.price).toFixed(Number(item.price) < 0.01 ? 6 : 2)}
              <span style={{ fontSize: "10px", fontWeight: 400, fontFamily: "Inter, sans-serif", color: "#A07810", marginLeft: "2px" }}>USDC</span>
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}

export default function FeedPage() {
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const { data: me } = useGetMe();
  const { data: categories } = useListCategories();

  const userCategories = me?.selectedCategories ?? [];

  const { data: feed, isLoading } = useListContent({
    categories: categoryFilter || (userCategories.length > 0 ? userCategories.join(",") : undefined),
    type: (typeFilter as "article" | "audio" | "video") || undefined,
    limit: 40,
    offset: 0,
  });

  const types = [
    { value: "", label: "All" },
    { value: "article", label: "Articles" },
    { value: "audio", label: "Audio" },
    { value: "video", label: "Video" },
  ];

  const items = feed?.items ?? [];
  const featuredItems = items.slice(0, 2);
  const restItems = items.slice(2);

  return (
    <PlatformLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* Page header */}
        <div
          className="py-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
          style={{ borderBottom: "1px solid rgba(28,25,23,0.15)" }}
        >
          <div>
            <p className="editorial-label mb-1" style={{ color: "#78716C" }}>Your reading list</p>
            <h1
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(1.5rem, 4vw, 2rem)",
                fontWeight: 700,
                color: "#1C1917",
                lineHeight: 1.2,
              }}
            >
              The Feed
            </h1>
            <p style={{ fontSize: "0.8125rem", color: "#78716C", marginTop: "4px" }}>
              {feed?.total ?? 0} pieces available
            </p>
          </div>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors shrink-0 self-start sm:self-auto"
            style={{
              background: "#1C1917",
              color: "#FAF7F2",
              borderRadius: "2px",
            }}
            data-testid="button-create-content"
            onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = "#3C3835")}
            onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = "#1C1917")}
          >
            ✍ Publish something
          </Link>
        </div>

        {/* Filter bar */}
        <div
          className="py-3 flex flex-wrap gap-x-6 gap-y-2 items-center"
          style={{ borderBottom: "1px solid rgba(28,25,23,0.1)" }}
        >
          {/* Type filter */}
          <div className="flex gap-1">
            {types.map(t => (
              <button
                key={t.value}
                onClick={() => setTypeFilter(t.value)}
                className="px-3 py-1 text-xs transition-colors"
                style={{
                  color: typeFilter === t.value ? "#1C1917" : "#78716C",
                  fontWeight: typeFilter === t.value ? 600 : 400,
                  background: typeFilter === t.value ? "rgba(28,25,23,0.08)" : "transparent",
                  borderRadius: "2px",
                }}
                data-testid={`filter-type-${t.value || "all"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ width: "1px", background: "rgba(28,25,23,0.15)", height: "16px", alignSelf: "center" }} className="hidden sm:block" />

          {/* Category filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setCategoryFilter("")}
              className="px-3 py-1 text-xs transition-colors"
              style={{
                color: !categoryFilter ? "#1C1917" : "#78716C",
                fontWeight: !categoryFilter ? 600 : 400,
                background: !categoryFilter ? "rgba(28,25,23,0.08)" : "transparent",
                borderRadius: "2px",
              }}
            >
              My Picks
            </button>
            {categories?.map(cat => (
              <button
                key={cat.slug}
                onClick={() => setCategoryFilter(cat.slug === categoryFilter ? "" : cat.slug)}
                className="px-3 py-1 text-xs transition-colors"
                style={{
                  color: categoryFilter === cat.slug ? "#1C1917" : "#78716C",
                  fontWeight: categoryFilter === cat.slug ? 600 : 400,
                  background: categoryFilter === cat.slug ? "rgba(28,25,23,0.08)" : "transparent",
                  borderRadius: "2px",
                }}
                data-testid={`filter-category-${cat.slug}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="py-8">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse" style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.1)", borderRadius: "2px", padding: "20px", height: "200px" }}>
                  <div className="h-2.5 rounded w-1/3 mb-3" style={{ background: "rgba(28,25,23,0.08)" }} />
                  <div style={{ borderTop: "1px solid rgba(28,25,23,0.1)", marginBottom: "12px" }} />
                  <div className="h-5 rounded w-full mb-2" style={{ background: "rgba(28,25,23,0.08)" }} />
                  <div className="h-4 rounded w-4/5" style={{ background: "rgba(28,25,23,0.06)" }} />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-24 text-center">
              <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.25rem", color: "#1C1917", marginBottom: "8px" }}>Nothing here yet.</p>
              <p style={{ fontSize: "0.875rem", color: "#78716C" }}>Publish the first piece and earn in USDC.</p>
              <Link href="/create" className="inline-block mt-6 px-6 py-2.5 text-sm font-semibold" style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}>
                Start Publishing
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Featured row — first 2 items larger */}
              {featuredItems.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {featuredItems.map((item, i) => (
                    <div key={item.id} style={{ animation: `cardEntrance 0.4s ease ${i * 60}ms both` }}>
                      <ContentCard item={item} featured />
                    </div>
                  ))}
                </div>
              )}

              {/* Rule */}
              {restItems.length > 0 && featuredItems.length > 0 && (
                <div className="flex items-center gap-4">
                  <div style={{ flex: 1, borderTop: "1px solid rgba(28,25,23,0.12)" }} />
                  <span className="editorial-label" style={{ color: "#78716C" }}>More pieces</span>
                  <div style={{ flex: 1, borderTop: "1px solid rgba(28,25,23,0.12)" }} />
                </div>
              )}

              {/* Rest of content */}
              {restItems.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {restItems.map((item, i) => (
                    <div key={item.id} style={{ animation: `cardEntrance 0.4s ease ${(i + 2) * 50}ms both` }}>
                      <ContentCard item={item} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PlatformLayout>
  );
}
