import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import {
  useGetContent,
  useCheckContentAccess,
  useUnlockContent,
  useTrackContentView,
  getCheckContentAccessQueryKey,
  getGetContentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PlatformLayout } from "@/components/PlatformLayout";

export default function ContentDetailPage({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: content, isLoading } = useGetContent(id, { query: { enabled: !!id, queryKey: getGetContentQueryKey(id) } });
  const { data: access } = useCheckContentAccess(id, { query: { enabled: !!id, queryKey: getCheckContentAccessQueryKey(id) } });
  const unlockContent = useUnlockContent();
  const trackView = useTrackContentView();

  useEffect(() => {
    if (id) {
      trackView.mutate({ params: { id } });
    }
  }, [id]);

  const handleUnlock = async () => {
    if (!content) return;
    try {
      await unlockContent.mutateAsync({ data: { contentId: id } });
      queryClient.invalidateQueries({ queryKey: getCheckContentAccessQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetContentQueryKey(id) });
      if (content.type === "article") {
        setLocation(`/read/${id}`);
      }
    } catch {
      // handle error
    }
  };

  if (isLoading) {
    return (
      <PlatformLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 animate-pulse">
          <div className="h-8 bg-white/8 rounded w-3/4 mb-4" />
          <div className="h-4 bg-white/8 rounded w-1/2 mb-8" />
          <div className="h-40 bg-white/5 rounded-xl" />
        </div>
      </PlatformLayout>
    );
  }

  if (!content) {
    return (
      <PlatformLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-[#6B7280]">Content not found.</p>
        </div>
      </PlatformLayout>
    );
  }

  const isFree = Number(content.price) === 0;
  const hasAccess = access?.hasAccess || isFree || content.hasAccess;

  const typeColors: Record<string, string> = {
    article: "#2DD4BF",
    audio: "#818CF8",
    video: "#FB923C",
  };

  return (
    <PlatformLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Back */}
        <Link href="/feed" className="text-xs text-[#6B7280] hover:text-[#E8EAF0] flex items-center gap-1 mb-6 transition-colors">
          ← Back to feed
        </Link>

        {/* Creator */}
        <div className="flex items-center gap-3 mb-6">
          {content.creatorImageUrl ? (
            <img src={content.creatorImageUrl} alt={content.creatorName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm text-[#6B7280]">
              {content.creatorName[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-[#E8EAF0]">{content.creatorName}</p>
            <p className="text-xs text-[#6B7280]">{new Date(content.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-[#E8EAF0] leading-tight mb-4">
          {content.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-8">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded"
            style={{ color: typeColors[content.type] ?? "#2DD4BF", background: `${typeColors[content.type] ?? "#2DD4BF"}15` }}
          >
            {content.type.charAt(0).toUpperCase() + content.type.slice(1)}
          </span>
          <span className="text-xs text-[#6B7280]">{content.categoryName}</span>
          {content.readingTimeMinutes && (
            <span className="text-xs text-[#6B7280]">{content.readingTimeMinutes} min read</span>
          )}
          <span className="text-xs text-[#6B7280]">{content.viewCount} views</span>
        </div>

        {/* Preview */}
        <div className="rounded-xl p-6 mb-6" style={{ background: "#161820" }}>
          <p className="text-[#6B7280] text-sm font-medium mb-3 uppercase tracking-wider">Preview</p>
          {content.previewText && (
            <p className="text-[#E8EAF0]/80 leading-relaxed">{content.previewText}</p>
          )}
          {content.type === "audio" && content.audioUrl && (
            <audio controls className="w-full mt-3" style={{ accentColor: "#F5C842" }}>
              <source src={content.audioUrl} />
            </audio>
          )}
          {content.type === "video" && (
            <div className="aspect-video bg-black/40 rounded-lg flex items-center justify-center mt-3">
              <span className="text-[#6B7280] text-sm">Video preview</span>
            </div>
          )}
        </div>

        {/* Access divider */}
        {!hasAccess && (
          <div className="relative flex items-center gap-4 my-8">
            <div className="flex-1 border-t border-white/10" />
            <span className="text-xs text-[#6B7280] whitespace-nowrap">Full content below</span>
            <div className="flex-1 border-t border-white/10" />
          </div>
        )}

        {/* Paywall or read button */}
        {hasAccess ? (
          <div className="text-center py-6">
            <p className="text-sm text-[#6B7280] mb-4">You have access to this content.</p>
            {content.type === "article" && (
              <Link
                href={`/read/${id}`}
                className="inline-block px-8 py-3 bg-[#F5C842] text-[#0D0F14] font-semibold rounded-lg hover:bg-[#F5C842]/90 transition-colors"
                data-testid="button-read-article"
              >
                Read Article
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-xl p-8 text-center border border-white/8" style={{ background: "#161820" }}>
            <p className="text-xs text-[#6B7280] mb-2 uppercase tracking-wider">Unlock this {content.type}</p>
            <p className="text-5xl font-bold mb-2" style={{ color: "#F5C842" }} data-testid="text-price-unlock">
              ${Number(content.price).toFixed(Number(content.price) < 0.01 ? 6 : 2)}
            </p>
            <p className="text-sm text-[#6B7280] mb-6">USDC</p>
            <button
              onClick={handleUnlock}
              disabled={unlockContent.isPending}
              data-testid="button-unlock-content"
              className="px-8 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200 disabled:opacity-60"
              style={{ background: "#F5C842", color: "#0D0F14" }}
            >
              {unlockContent.isPending ? "Processing..." : `Unlock for $${Number(content.price).toFixed(Number(content.price) < 0.01 ? 6 : 2)} USDC`}
            </button>
            <p className="text-xs text-[#6B7280]/70 mt-4">
              95% goes directly to this creator. Settled in under a second.
            </p>
            {unlockContent.isError && (
              <p className="text-red-400 text-sm mt-3">Payment failed. Please try again.</p>
            )}
          </div>
        )}
      </div>
    </PlatformLayout>
  );
}
