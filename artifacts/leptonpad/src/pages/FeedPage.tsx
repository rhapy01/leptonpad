import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useListContent, useListCategories, useGetMe } from "@workspace/api-client-react";
import type { Content } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { fetchTrending, fetchMostBookmarked, fetchRisingCreators, fetchByTag, fetchByCountry } from "@/lib/platformApi";
import { PlatformLayout } from "@/components/PlatformLayout";
import { ContentCover } from "@/components/ContentCover";
import { AdBanner } from "@/components/AdBanner";
import { FeedPagination } from "@/components/FeedPagination";
import { Reveal } from "@/components/Reveal";
import { CreatorName } from "@/components/CreatorName";
import type { DiscoveryItem } from "@/lib/platformApi";

const FEED_PAGE_SIZE = 12;

function readFeedParams(): { q: string; page: number; type: string; category: string; mode: string; tag: string; country: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") ?? "",
    page: Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1),
    type: params.get("type") ?? "",
    category: params.get("category") ?? "",
    mode: params.get("mode") ?? "latest",
    tag: params.get("tag") ?? "",
    country: params.get("country") ?? "",
  };
}

function buildFeedPath({
  q,
  page,
  type,
  category,
}: {
  q: string;
  page: number;
  type: string;
  category: string;
}): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (type) params.set("type", type);
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/feed${qs ? `?${qs}` : ""}`;
}

function discoveryToContent(d: DiscoveryItem): Content {
  return {
    ...d,
    categoryName: d.categoryName ?? d.categorySlug.replace(/-/g, " "),
    creatorName: d.creatorName ?? "Creator",
    creatorImageUrl: d.creatorImageUrl ?? null,
    creatorVerified: d.creatorVerified ?? false,
    viewCount: d.viewCount ?? 0,
    purchaseCount: d.purchaseCount ?? 0,
    published: true,
    featured: false,
    audioUrl: null,
    videoUrl: null,
    previewText: d.previewText ?? null,
  } as Content;
}

function ContentCard({
  item,
  featured = false,
}: {
  item: Content;
  featured?: boolean;
}) {
  const isFree = Number(item.price) === 0;

  return (
    <Link href={`/content/${item.id}`} className="content-card-link block w-full" data-testid={`card-content-${item.id}`}>
      <article
        className="group editorial-card flex w-full flex-col"
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
            className="shrink-0"
          />
        </div>
        <div style={{ padding: featured ? "24px" : "18px 20px" }} className="content-card-body flex flex-col min-w-0">
        <div className="content-card-meta">
          <span className="editorial-label">{item.categoryName}</span>
        </div>

        <div style={{ borderTop: "1px solid rgba(28,25,23,0.15)", marginBottom: "12px" }} />

        <h3
          className="homepage-display leading-snug mb-3"
          style={{
            fontSize: featured ? "1.25rem" : "1rem",
            fontWeight: 700,
            lineHeight: featured ? "1.4" : "1.45",
          }}
        >
          {item.title}
        </h3>

        {item.previewText && (
          <p className="homepage-body mb-4 line-clamp-2" style={{ fontSize: "0.8125rem", lineHeight: "1.6" }}>
            {item.previewText}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3" style={{ borderTop: "1px solid rgba(28,25,23,0.08)" }}>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {item.creatorImageUrl ? (
              <img src={item.creatorImageUrl} alt={item.creatorName} className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: "rgba(28,25,23,0.08)" }}
              >
                <span style={{ fontSize: "9px", color: "var(--color-ink-muted)" }}>{item.creatorName[0]?.toUpperCase()}</span>
              </div>
            )}
            <CreatorName
              name={item.creatorName}
              verified={item.creatorVerified}
              style={{ fontSize: "11px", color: "var(--color-ink-muted)" }}
            />
            <span style={{ fontSize: "11px", color: "rgba(28,25,23,0.3)" }}>·</span>
            <span style={{ fontSize: "11px", color: "var(--color-ink-muted)" }}>
              {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
          {isFree ? (
            <span
              className="text-xs font-medium px-2 py-0.5"
              style={{
                background: "rgba(28,25,23,0.06)",
                color: "var(--color-ink-muted)",
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
        </div>
      </article>
    </Link>
  );
}

export default function FeedPage() {
  const [, setLocation] = useLocation();
  const initial = useMemo(() => readFeedParams(), []);

  const [searchInput, setSearchInput] = useState(initial.q);
  const [searchQuery, setSearchQuery] = useState(initial.q);
  const [page, setPage] = useState(initial.page);
  const [typeFilter, setTypeFilter] = useState(initial.type);
  const [categoryFilter, setCategoryFilter] = useState(initial.category);
  const [feedMode, setFeedMode] = useState(initial.mode);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => sessionStorage.getItem("onboarding-banner-dismissed") === "1",
  );
  const tagFilter = initial.tag;
  const countryFilter = initial.country;

  const { data: me } = useGetMe();
  const { data: categories } = useListCategories();

  const userCategories = me?.selectedCategories ?? [];

  const syncUrl = useCallback(
    (next: { q: string; page: number; type: string; category: string }) => {
      const path = buildFeedPath(next);
      const current = `${window.location.pathname}${window.location.search}`;
      if (path !== current) {
        setLocation(path);
      }
    },
    [setLocation],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      if (searchInput.trim() !== searchQuery) {
        setPage(1);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchQuery]);

  useEffect(() => {
    syncUrl({ q: searchQuery, page, type: typeFilter, category: categoryFilter });
  }, [searchQuery, page, typeFilter, categoryFilter, syncUrl]);

  const { data: trending } = useQuery({
    queryKey: ["trending", feedMode],
    queryFn: () => fetchTrending(feedMode === "today" ? "today" : "week"),
    enabled: feedMode === "trending" || feedMode === "today",
  });

  const { data: bookmarked } = useQuery({
    queryKey: ["bookmarked"],
    queryFn: fetchMostBookmarked,
    enabled: feedMode === "bookmarked",
  });

  const { data: risingCreators } = useQuery({
    queryKey: ["rising-creators"],
    queryFn: fetchRisingCreators,
    enabled: feedMode === "rising",
  });

  const { data: tagContent } = useQuery({
    queryKey: ["tag", tagFilter],
    queryFn: () => fetchByTag(tagFilter),
    enabled: !!tagFilter,
  });

  const { data: countryContent } = useQuery({
    queryKey: ["country", countryFilter],
    queryFn: () => fetchByCountry(countryFilter),
    enabled: !!countryFilter,
  });

  const showAllTopics = categoryFilter === "__all__";
  const effectiveCategory =
    showAllTopics || searchQuery
      ? undefined
      : categoryFilter
        ? categoryFilter
        : userCategories.length > 0
          ? userCategories.join(",")
          : undefined;

  const showContentFilters = feedMode === "latest" && !tagFilter && !countryFilter;

  const { data: feed, isLoading, isFetching } = useListContent({
    q: searchQuery || undefined,
    categories: effectiveCategory || undefined,
    type: (typeFilter as "article" | "audio" | "video") || undefined,
    limit: FEED_PAGE_SIZE,
    offset: (page - 1) * FEED_PAGE_SIZE,
  });

  const items: Content[] = tagFilter && tagContent
    ? tagContent.map(discoveryToContent)
    : countryFilter && countryContent
      ? countryContent.map(discoveryToContent)
      : feedMode === "trending" || feedMode === "today"
        ? (trending ?? []).map(discoveryToContent)
        : feedMode === "bookmarked"
          ? (bookmarked ?? []).map(discoveryToContent)
          : feed?.items ?? [];

  const total = tagFilter || countryFilter || feedMode !== "latest" ? items.length : (feed?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / FEED_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages && total > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages, total]);

  const types = [
    { value: "", label: "All" },
    { value: "article", label: "Articles" },
    { value: "audio", label: "Audio" },
    { value: "video", label: "Video" },
  ];

  const showFeatured = page === 1 && !searchQuery && feedMode === "latest";
  const featuredItems = showFeatured ? items.slice(0, 2) : [];
  const restItems = showFeatured ? items.slice(2) : items;

  const resultLabel = searchQuery
    ? `${total} result${total === 1 ? "" : "s"} for “${searchQuery}”`
    : `${total} piece${total === 1 ? "" : "s"} available`;

  return (
    <PlatformLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {me && !me.onboardingComplete && !onboardingDismissed && (
          <div
            className="mt-4 flex flex-col gap-3 rounded border p-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ background: "#FFFFFF", borderColor: "rgba(28,25,23,0.12)" }}
          >
            <p className="text-sm" style={{ color: "#57534E" }}>
              Optional: pick categories you care about to tune your feed.
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/onboarding"
                className="px-4 py-2 text-xs font-semibold"
                style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}
              >
                Personalize feed
              </Link>
              <button
                type="button"
                className="text-xs"
                style={{ color: "#78716C" }}
                onClick={() => {
                  sessionStorage.setItem("onboarding-banner-dismissed", "1");
                  setOnboardingDismissed(true);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <Reveal>
        <header className="feed-header py-8" style={{ borderBottom: "1px solid rgba(28,25,23,0.1)" }}>
          <div className="feed-header-intro">
            <p className="editorial-label mb-2">Discover</p>
            <h1 className="feed-title">The Feed</h1>
            <p className="feed-meta">
              {isLoading ? "Loading…" : resultLabel}
              {isFetching && !isLoading && (
                <span style={{ marginLeft: "8px", opacity: 0.6 }}>· updating</span>
              )}
            </p>
          </div>

          <div className="feed-search-row">
            <input
              type="search"
              value={searchInput}
              onChange={e => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              placeholder="Search titles, previews, creators…"
              className="feed-search"
              data-testid="input-feed-search"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                  setPage(1);
                }}
                className="feed-search-clear"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="feed-toolbar">
            <nav className="feed-sort" aria-label="Sort feed">
              {[
                { value: "latest", label: "Latest" },
                { value: "trending", label: "Trending" },
                { value: "today", label: "Today" },
                { value: "bookmarked", label: "Most saved" },
                { value: "rising", label: "Rising writers" },
              ].map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => { setFeedMode(m.value); setPage(1); }}
                  className={`feed-sort-tab${feedMode === m.value ? " feed-sort-tab--active" : ""}`}
                >
                  {m.label}
                </button>
              ))}
            </nav>

            {showContentFilters && (
              <div className="feed-refine">
                <label className="feed-select-wrap">
                  <span className="sr-only">Format</span>
                  <select
                    className="feed-select"
                    value={typeFilter}
                    onChange={e => {
                      setTypeFilter(e.target.value);
                      setPage(1);
                    }}
                    data-testid="filter-type-select"
                  >
                    {types.map(t => (
                      <option key={t.value || "all"} value={t.value}>
                        {t.value ? t.label : "All formats"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="feed-select-wrap">
                  <span className="sr-only">Topic</span>
                  <select
                    className="feed-select"
                    value={
                      showAllTopics
                        ? "__all__"
                        : !categoryFilter && me && userCategories.length > 0 && !searchQuery
                          ? "__for_you__"
                          : categoryFilter || "__all__"
                    }
                    onChange={e => {
                      const v = e.target.value;
                      if (v === "__all__") setCategoryFilter("__all__");
                      else if (v === "__for_you__") setCategoryFilter("");
                      else setCategoryFilter(v);
                      setPage(1);
                    }}
                    data-testid="filter-category-select"
                  >
                    {me && userCategories.length > 0 && !searchQuery && (
                      <option value="__for_you__">For you</option>
                    )}
                    <option value="__all__">All topics</option>
                    {categories?.map(cat => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </header>
        </Reveal>

        {feedMode === "rising" && risingCreators && (
          <div className="py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {risingCreators.map(c => (
              <Link key={c.clerkId} href={`/creator/${c.clerkId}`} className="p-4 rounded block" style={{ background: "#fff", border: "1px solid rgba(28,25,23,0.12)" }}>
                <div className="flex items-center gap-3 mb-2">
                  {c.imageUrl ? <img src={c.imageUrl} alt="" className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-black/5" />}
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#1C1917" }}>
                      <CreatorName name={c.name} verified={c.verified} size="sm" />
                    </p>
                    <p className="text-xs" style={{ color: "#78716C" }}>{c.followerCount} followers · {c.pieceCount} works</p>
                  </div>
                </div>
                <p className="text-xs" style={{ color: "#78716C" }}>{c.totalPurchases} purchases · {c.totalViews} views</p>
              </Link>
            ))}
          </div>
        )}

        <div className="py-8">
          <AdBanner category={categoryFilter || undefined} />
          {feedMode === "rising" ? null : isLoading && feedMode === "latest" ? (
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
              <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.25rem", color: "#1C1917", marginBottom: "8px" }}>
                {searchQuery ? "No matches found." : "Nothing here yet."}
              </p>
              <p style={{ fontSize: "0.875rem", color: "#78716C" }}>
                {searchQuery ? "Try a different search term or clear filters." : "Publish the first piece and earn in USDC."}
              </p>
              {!searchQuery && (
                <Link href="/dashboard/creator" className="interactive-cta inline-block mt-6 px-6 py-2.5 text-sm font-semibold" style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}>
                  Open creator dashboard
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {featuredItems.length > 0 && (
                <Reveal stagger className="grid grid-cols-1 items-start sm:grid-cols-2 gap-4">
                  {featuredItems.map(item => (
                    <div key={item.id}>
                      <ContentCard item={item} featured />
                    </div>
                  ))}
                </Reveal>
              )}

              {restItems.length > 0 && featuredItems.length > 0 && (
                <div className="flex items-center gap-4">
                  <div style={{ flex: 1, borderTop: "1px solid rgba(28,25,23,0.12)" }} />
                  <span className="editorial-label" style={{ color: "#78716C" }}>More pieces</span>
                  <div style={{ flex: 1, borderTop: "1px solid rgba(28,25,23,0.12)" }} />
                </div>
              )}

              {restItems.length > 0 && (
                <Reveal stagger className="grid grid-cols-1 items-start sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {restItems.map(item => (
                    <div key={item.id}>
                      <ContentCard item={item} />
                    </div>
                  ))}
                </Reveal>
              )}

              <FeedPagination
                page={page}
                pageSize={FEED_PAGE_SIZE}
                total={total}
                onPageChange={p => {
                  setPage(p);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          )}
        </div>
      </div>
    </PlatformLayout>
  );
}
