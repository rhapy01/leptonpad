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

const TYPE_MARKS: Record<string, string> = { article: "✍", audio: "♪", video: "▶" };

export default function ContentDetailPage({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: content, isLoading } = useGetContent(id, { query: { enabled: !!id, queryKey: getGetContentQueryKey(id) } });
  const { data: access } = useCheckContentAccess(id, { query: { enabled: !!id, queryKey: getCheckContentAccessQueryKey(id) } });
  const unlockContent = useUnlockContent();
  const trackView = useTrackContentView();

  useEffect(() => {
    if (id) trackView.mutate({ id });
  }, [id]);

  const handleUnlock = async () => {
    if (!content) return;
    try {
      await unlockContent.mutateAsync({ data: { contentId: id } });
      queryClient.invalidateQueries({ queryKey: getCheckContentAccessQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetContentQueryKey(id) });
      if (content.type === "article") setLocation(`/read/${id}`);
    } catch {}
  };

  if (isLoading) {
    return (
      <PlatformLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 animate-pulse">
          <div className="h-2.5 rounded w-1/4 mb-6" style={{ background: "rgba(28,25,23,0.08)" }} />
          <div style={{ borderTop: "1px solid rgba(28,25,23,0.1)", marginBottom: "24px" }} />
          <div className="h-8 rounded w-3/4 mb-3" style={{ background: "rgba(28,25,23,0.08)" }} />
          <div className="h-6 rounded w-1/2 mb-8" style={{ background: "rgba(28,25,23,0.06)" }} />
          <div className="h-40 rounded" style={{ background: "rgba(28,25,23,0.05)" }} />
        </div>
      </PlatformLayout>
    );
  }

  if (!content) {
    return (
      <PlatformLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p style={{ color: "#78716C" }}>Content not found.</p>
        </div>
      </PlatformLayout>
    );
  }

  const isFree = Number(content.price) === 0;
  const hasAccess = access?.hasAccess || isFree || content.hasAccess;

  return (
    <PlatformLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

        {/* Back link */}
        <Link href="/feed" className="inline-flex items-center gap-1 mb-8 transition-colors text-xs" style={{ color: "#78716C" }}
          onMouseOver={e => ((e.currentTarget as HTMLElement).style.color = "#1C1917")}
          onMouseOut={e => ((e.currentTarget as HTMLElement).style.color = "#78716C")}
        >
          ← Back to feed
        </Link>

        {/* Section label */}
        <div className="flex items-center gap-2 mb-3">
          <span className="editorial-label" style={{ color: "#78716C" }}>
            {TYPE_MARKS[content.type]} {content.type.charAt(0).toUpperCase() + content.type.slice(1)}
          </span>
          <span style={{ color: "rgba(28,25,23,0.25)", fontSize: "10px" }}>·</span>
          <span className="editorial-label" style={{ color: "#78716C" }}>{content.categoryName}</span>
          {content.readingTimeMinutes && (
            <>
              <span style={{ color: "rgba(28,25,23,0.25)", fontSize: "10px" }}>·</span>
              <span className="editorial-label" style={{ color: "#78716C" }}>{content.readingTimeMinutes} min read</span>
            </>
          )}
          <span style={{ color: "rgba(28,25,23,0.25)", fontSize: "10px" }}>·</span>
          <span className="editorial-label" style={{ color: "#78716C" }}>{content.viewCount} views</span>
        </div>

        {/* Hairline */}
        <div style={{ borderTop: "2px solid #1C1917", marginBottom: "20px" }} />

        {/* Title */}
        <h1
          className="mb-6"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
            fontWeight: 700,
            color: "#1C1917",
            lineHeight: 1.25,
          }}
        >
          {content.title}
        </h1>

        {/* Creator byline */}
        <div className="flex items-center gap-3 mb-8 pb-6" style={{ borderBottom: "1px solid rgba(28,25,23,0.12)" }}>
          {content.creatorImageUrl ? (
            <img src={content.creatorImageUrl} alt={content.creatorName} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(28,25,23,0.08)" }}>
              <span style={{ fontSize: "13px", color: "#78716C" }}>{content.creatorName[0]?.toUpperCase()}</span>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold" style={{ color: "#1C1917" }}>{content.creatorName}</p>
            <p style={{ fontSize: "12px", color: "#78716C" }}>
              {new Date(content.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        {/* Preview excerpt */}
        {content.previewText && (
          <div
            className="mb-8 p-6"
            style={{
              background: "rgba(28,25,23,0.035)",
              border: "1px solid rgba(28,25,23,0.1)",
              borderRadius: "2px",
            }}
          >
            <p className="editorial-label mb-3" style={{ color: "#78716C" }}>Preview</p>
            <p style={{ color: "#1C1917", lineHeight: "1.75", fontSize: "0.9375rem", fontFamily: "Georgia, serif" }}>
              {content.previewText}
            </p>
            {content.type === "audio" && content.audioUrl && (
              <audio controls className="w-full mt-4" style={{ accentColor: "#C8960C" }}>
                <source src={content.audioUrl} />
              </audio>
            )}
            {content.type === "video" && (
              <div className="aspect-video rounded mt-4 flex items-center justify-center" style={{ background: "rgba(28,25,23,0.06)" }}>
                <span style={{ color: "#78716C", fontSize: "0.875rem" }}>Video preview</span>
              </div>
            )}
          </div>
        )}

        {/* Access zone */}
        {!hasAccess && (
          <div className="relative flex items-center gap-4 my-8">
            <div style={{ flex: 1, borderTop: "1px solid rgba(28,25,23,0.12)" }} />
            <span className="editorial-label" style={{ color: "#78716C" }}>Unlock to continue reading</span>
            <div style={{ flex: 1, borderTop: "1px solid rgba(28,25,23,0.12)" }} />
          </div>
        )}

        {/* Paywall or read button */}
        {hasAccess ? (
          <div className="py-8 text-center">
            <p style={{ fontSize: "0.875rem", color: "#78716C", marginBottom: "20px" }}>You have access to this piece.</p>
            {content.type === "article" && (
              <Link
                href={`/read/${id}`}
                className="inline-block px-8 py-3 text-sm font-semibold transition-colors"
                style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}
                data-testid="button-read-article"
                onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = "#3C3835")}
                onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = "#1C1917")}
              >
                Read Article →
              </Link>
            )}
          </div>
        ) : (
          <div
            className="p-8 text-center"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(28,25,23,0.15)",
              borderRadius: "2px",
            }}
          >
            <p className="editorial-label mb-4" style={{ color: "#78716C" }}>Unlock this {content.type}</p>
            <p
              className="mb-1"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "3rem",
                fontWeight: 700,
                color: "#C8960C",
                lineHeight: 1,
              }}
              data-testid="text-price-unlock"
            >
              ${Number(content.price).toFixed(Number(content.price) < 0.01 ? 6 : 2)}
            </p>
            <p className="editorial-label mb-8" style={{ color: "#78716C" }}>USDC · Arc blockchain</p>

            <button
              onClick={handleUnlock}
              disabled={unlockContent.isPending}
              data-testid="button-unlock-content"
              className="px-10 py-3 text-sm font-semibold transition-colors disabled:opacity-60 w-full sm:w-auto"
              style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}
              onMouseOver={e => { if (!unlockContent.isPending) (e.currentTarget as HTMLElement).style.background = "#3C3835"; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "#1C1917"; }}
            >
              {unlockContent.isPending
                ? "Processing payment…"
                : `Pay $${Number(content.price).toFixed(Number(content.price) < 0.01 ? 6 : 2)} USDC`}
            </button>

            <p style={{ fontSize: "11px", color: "#78716C", marginTop: "16px" }}>
              95% goes directly to {content.creatorName}. Settled in under 500ms.
            </p>

            {unlockContent.isError && (
              <p style={{ color: "#DC2626", fontSize: "0.875rem", marginTop: "12px" }}>Payment failed. Please try again.</p>
            )}
          </div>
        )}
      </div>
    </PlatformLayout>
  );
}
