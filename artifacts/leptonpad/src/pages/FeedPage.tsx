import { useState } from "react";
import { Link } from "wouter";
import { useListContent, useListCategories, useGetMe } from "@workspace/api-client-react";
import { PlatformLayout } from "@/components/PlatformLayout";

function ContentCard({ item }: { item: NonNullable<ReturnType<typeof useListContent>["data"]>["items"][number] }) {
  const isFree = Number(item.price) === 0;
  const typeColors: Record<string, string> = {
    article: "#2DD4BF",
    audio: "#818CF8",
    video: "#FB923C",
  };

  return (
    <Link href={`/content/${item.id}`} data-testid={`card-content-${item.id}`}>
      <div
        className="content-card rounded-xl p-5 cursor-pointer border border-transparent hover:border-white/10"
        style={{ background: "#161820" }}
      >
        {/* Creator */}
        <div className="flex items-center gap-2 mb-3">
          {item.creatorImageUrl ? (
            <img src={item.creatorImageUrl} alt={item.creatorName} className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-xs text-[#6B7280]">{item.creatorName[0]?.toUpperCase()}</span>
            </div>
          )}
          <span className="text-xs text-[#6B7280]">{item.creatorName}</span>
        </div>

        {/* Title */}
        <h3 className="text-[#E8EAF0] font-semibold text-base leading-snug mb-3 line-clamp-2">
          {item.title}
        </h3>

        {/* Preview */}
        {item.previewText && (
          <p className="text-sm text-[#6B7280] leading-relaxed mb-4 line-clamp-2">{item.previewText}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded"
              style={{
                color: typeColors[item.type] ?? "#2DD4BF",
                background: `${typeColors[item.type] ?? "#2DD4BF"}15`,
              }}
            >
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </span>
            <span className="text-xs text-[#6B7280]/70">{item.categoryName}</span>
          </div>
          {isFree ? (
            <span className="text-xs font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded">Free</span>
          ) : (
            <span className="text-sm font-semibold text-gold" style={{ color: "#F5C842" }} data-testid={`text-price-${item.id}`}>
              ${Number(item.price).toFixed(item.price < 0.01 ? 6 : 2)} USDC
            </span>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-xs text-[#6B7280]/60 mt-2">
          {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </div>
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

  return (
    <PlatformLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-[#E8EAF0]">Your Feed</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {feed?.total ?? 0} pieces across your categories
            </p>
          </div>
          <Link
            href="/create"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#F5C842] text-[#0D0F14] hover:bg-[#F5C842]/90 transition-colors"
            data-testid="button-create-content"
          >
            + Create
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex gap-1">
            {types.map(t => (
              <button
                key={t.value}
                onClick={() => setTypeFilter(t.value)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  typeFilter === t.value
                    ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
                    : "text-[#6B7280] hover:text-[#E8EAF0]"
                }`}
                data-testid={`filter-type-${t.value || "all"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setCategoryFilter("")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                !categoryFilter ? "bg-white/10 text-[#E8EAF0]" : "text-[#6B7280] hover:text-[#E8EAF0]"
              }`}
            >
              My Categories
            </button>
            {categories?.map(cat => (
              <button
                key={cat.slug}
                onClick={() => setCategoryFilter(cat.slug === categoryFilter ? "" : cat.slug)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  categoryFilter === cat.slug ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : "text-[#6B7280] hover:text-[#E8EAF0]"
                }`}
                data-testid={`filter-category-${cat.slug}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl p-5 animate-pulse" style={{ background: "#161820" }}>
                <div className="h-3 bg-white/8 rounded w-1/2 mb-3" />
                <div className="h-4 bg-white/8 rounded w-full mb-2" />
                <div className="h-4 bg-white/8 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (feed?.items?.length ?? 0) === 0 ? (
          <div className="text-center py-24">
            <p className="text-[#6B7280] text-lg mb-2">No content yet</p>
            <p className="text-sm text-[#6B7280]/60">Be the first to publish something.</p>
            <Link href="/create" className="inline-block mt-6 px-6 py-2.5 bg-[#F5C842] text-[#0D0F14] text-sm font-semibold rounded-lg">
              Start Publishing
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {feed?.items.map((item, i) => (
              <div
                key={item.id}
                style={{ animation: `cardEntrance 0.4s ease ${i * 40}ms both` }}
              >
                <ContentCard item={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </PlatformLayout>
  );
}
