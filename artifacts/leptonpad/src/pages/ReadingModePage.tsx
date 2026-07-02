import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, Link } from "wouter";
import {
  useGetContent,
  useCheckContentAccess,
  useGetNextContent,
  useGetMe,
  useTrackContentView,
  getGetContentQueryKey,
  getCheckContentAccessQueryKey,
  getGetNextContentQueryKey,
} from "@workspace/api-client-react";
import type { Content } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchReadingProgress,
  saveReadingProgress,
  recordRead,
  fetchFollowStatus,
  followCreator,
  unfollowCreator,
  fetchCollections,
  saveToCollection,
} from "@/lib/platformApi";
import { markdownToHtml } from "@/components/MarkdownEditor";
import { CreatorName } from "@/components/CreatorName";
import { ContentEngagement } from "@/components/ContentEngagement";
import { ReadingEngagementRail } from "@/components/ReadingEngagementRail";
import { ReadingSidebarMore } from "@/components/ReadingSidebarMore";
import { YoutubeEmbed } from "@/components/YoutubeEmbed";
import { isYoutubeMediaUrl } from "@/lib/youtube";
import { resolveCoverUrl } from "@/lib/contentCover";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useToast } from "@/hooks/use-toast";

type FontSize = "sm" | "md" | "lg";

const fontSizeMap: Record<FontSize, { body: string; lineHeight: string }> = {
  sm: { body: "1.05rem", lineHeight: "1.75" },
  md: { body: "1.2rem", lineHeight: "1.85" },
  lg: { body: "1.35rem", lineHeight: "1.9" },
};

const TYPE_LABELS: Record<string, string> = {
  article: "Article",
  audio: "Audio",
  video: "Video",
};

function countWords(text: string): number {
  const plain = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) return 0;
  return plain.split(" ").length;
}

function plainTextFromBody(body: string, isHtml: boolean): string {
  if (isHtml) return body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return body.trim();
}

export default function ReadingModePage({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { authReady } = useAuthReady();
  const { data: me } = useGetMe();
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [readingAloud, setReadingAloud] = useState(false);
  const progressSaveRef = useRef(0);
  const commentsRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);

  const { data: content, isLoading } = useGetContent(id, {
    query: { enabled: !!id && authReady, queryKey: getGetContentQueryKey(id) },
  });
  const trackView = useTrackContentView();
  const { data: access } = useCheckContentAccess(id, {
    query: { enabled: !!id && authReady, queryKey: getCheckContentAccessQueryKey(id) },
  });
  const { data: nextRaw } = useGetNextContent(id, { query: { enabled: !!id, queryKey: getGetNextContentQueryKey(id) } });
  const nextContent: Content | null = nextRaw && typeof nextRaw === "object" ? nextRaw : null;

  const { data: followStatus } = useQuery({
    queryKey: ["follow-status", content?.creatorId],
    queryFn: () => fetchFollowStatus(content!.creatorId),
    enabled: !!content?.creatorId && !!me && me.clerkId !== content.creatorId,
  });

  const { data: collections } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
    enabled: !!me,
  });

  const followMutation = useMutation({
    mutationFn: () =>
      followStatus?.subscribed
        ? unfollowCreator(content!.creatorId)
        : followCreator(content!.creatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-status", content?.creatorId] });
      toast({
        title: followStatus?.subscribed ? "Unsubscribed" : "Subscribed",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const readLater = collections?.find(c => c.slug === "read-later");
      if (!readLater) throw new Error("No collection");
      return saveToCollection(readLater.id, id);
    },
    onSuccess: () => toast({ title: "Saved to Read Later" }),
  });

  const isFree = Number(content?.price ?? 0) === 0;
  const hasAccess = access?.hasAccess || isFree || content?.hasAccess;

  useEffect(() => {
    if (!id) return;
    trackView.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetContentQueryKey(id) });
        },
      },
    );
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchReadingProgress(id).then(p => {
      // Only resume mid-article — avoid jumping to the bottom on a fresh open
      if (p.progressPct >= 15 && p.scrollPosition > 200) {
        window.scrollTo(0, p.scrollPosition);
      }
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (id && hasAccess) recordRead().catch(() => {});
  }, [id, hasAccess]);

  useEffect(() => {
    if (!isLoading && !hasAccess && content) setLocation(`/content/${id}`);
  }, [isLoading, hasAccess, content, id, setLocation]);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const handleScroll = useCallback(() => {
    const el = articleRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const totalHeight = el.offsetHeight - window.innerHeight;
    if (totalHeight <= 0) {
      setProgress(100);
      setShowNext(true);
      return;
    }
    const scrolled = -rect.top;
    const pct = Math.min(100, Math.max(0, (scrolled / totalHeight) * 100));
    setProgress(pct);
    if (pct >= 80) setShowNext(true);

    const now = Date.now();
    if (now - progressSaveRef.current > 5000) {
      progressSaveRef.current = now;
      saveReadingProgress(id, {
        progressPct: Math.round(pct),
        scrollPosition: window.scrollY,
        completed: pct >= 95,
      }).catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const shareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied" });
  };

  const toggleReadAloud = () => {
    if (!content || !("speechSynthesis" in window)) return;
    if (readingAloud) {
      window.speechSynthesis.cancel();
      setReadingAloud(false);
      return;
    }
    const isHtml = (content.body ?? "").trimStart().startsWith("<");
    const text = plainTextFromBody(content.body ?? content.previewText ?? "", isHtml);
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setReadingAloud(false);
    utterance.onerror = () => setReadingAloud(false);
    window.speechSynthesis.speak(utterance);
    setReadingAloud(true);
  };

  const scrollToComments = () => {
    commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startReading = (contentId: number) => {
    setSidebarOpen(false);
    window.scrollTo(0, 0);
    setLocation(`/read/${contentId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center platform-shell">
        <div className="w-8 h-8 border-2 border-[#C8960C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!content) return null;

  const isHtml = (content.body ?? "").trimStart().startsWith("<");
  const wordCount = countWords(content.body ?? content.previewText ?? "");
  const { body: bodyFontSize, lineHeight } = fontSizeMap[fontSize];
  const coverSrc = resolveCoverUrl(content.coverImageUrl, content.categorySlug, content.id);
  const typeLabel = TYPE_LABELS[content.type] ?? "Story";

  const renderBody = () => {
    if (content.type === "article") {
      if (isHtml) return <div dangerouslySetInnerHTML={{ __html: content.body ?? "" }} />;
      return (
        <div className="space-y-5">
          {(content.body || content.previewText || "").split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      );
    }
    if (content.type === "audio" && content.audioUrl) {
      return (
        <div>
          {isYoutubeMediaUrl(content.audioUrl) ? (
            <YoutubeEmbed url={content.audioUrl} title={content.title} className="aspect-video w-full overflow-hidden rounded-sm mb-6" />
          ) : (
            <audio controls className="w-full rounded-sm mb-6" style={{ accentColor: "#C8960C" }}>
              <source src={content.audioUrl} />
            </audio>
          )}
          {content.body && (
            isHtml
              ? <div dangerouslySetInnerHTML={{ __html: content.body }} />
              : content.body.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
          )}
        </div>
      );
    }
    if (content.type === "video" && content.videoUrl) {
      return (
        <div>
          {isYoutubeMediaUrl(content.videoUrl) ? (
            <YoutubeEmbed url={content.videoUrl} title={content.title} className="aspect-video w-full overflow-hidden rounded-sm mb-6" />
          ) : (
            <video controls className="w-full aspect-video rounded-sm mb-6" style={{ background: "#000" }}>
              <source src={content.videoUrl} />
            </video>
          )}
          {content.body && (
            isHtml
              ? <div dangerouslySetInnerHTML={{ __html: content.body }} />
              : content.body.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
          )}
        </div>
      );
    }
    return <p className="reading-meta">Content unavailable.</p>;
  };

  return (
    <div
      className={`reading-shell reading-fade-in${darkMode ? " reading-shell--dark" : ""}${sidebarOpen ? " reading-shell--sidebar-open" : ""}`}
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="reading-progress-bar"
        data-testid="reading-progress-bar"
        style={{ width: `${progress}%` }}
      />

      {sidebarOpen && (
        <button
          type="button"
          className="reading-sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className="reading-sidebar">
        <div className="reading-sidebar-top">
          <Link href={`/content/${id}`} className="reading-sidebar-back" onClick={() => setSidebarOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to story
          </Link>
          <button
            type="button"
            className="reading-sidebar-close"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="reading-sidebar-body">
          <img src={coverSrc} alt="" className="reading-sidebar-cover" />
          <h2 className="reading-sidebar-title">{content.title}</h2>
          <p className="reading-sidebar-author">
            by{" "}
            <Link href={`/creator/${content.creatorId}`} className="reading-sidebar-author-link">
              <CreatorName
                name={content.creatorName}
                verified={content.creatorVerified}
                size="sm"
              />
            </Link>
          </p>
          <span className="reading-sidebar-badge">{typeLabel}</span>

          <ReadingSidebarMore
            currentId={id}
            creatorId={content.creatorId}
            creatorName={content.creatorName}
            onStartReading={startReading}
          />
        </div>

        <div className="reading-sidebar-footer">
          <div className="reading-sidebar-progress-track">
            <div className="reading-sidebar-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="reading-sidebar-progress-label">{Math.round(progress)}% complete</p>
        </div>
      </aside>

      <div className="reading-main">
        <header className="reading-topbar">
          <div className="reading-topbar-left">
            <button
              type="button"
              className="reading-topbar-icon"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              className="reading-topbar-icon reading-topbar-icon--hide-mobile"
              aria-label="Back"
              onClick={() => setLocation(`/content/${id}`)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          <p className="reading-topbar-title">{content.title}</p>

          <div className="reading-topbar-right">
            <div className="reading-font-size hidden sm:flex">
              {(["sm", "md", "lg"] as FontSize[]).map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setFontSize(size)}
                  data-testid={`button-font-size-${size}`}
                  className={`reading-font-size-btn${fontSize === size ? " reading-font-size-btn--active" : ""}`}
                  aria-label={`Font size ${size}`}
                >
                  A
                </button>
              ))}
            </div>
            <button
              type="button"
              className="reading-topbar-icon"
              onClick={() => setDarkMode(d => !d)}
              data-testid="button-dark-mode-toggle"
              aria-label={darkMode ? "Light mode" : "Dark mode"}
            >
              {darkMode ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            {me && (
              <button
                type="button"
                className="reading-topbar-icon"
                aria-label="Save"
                onClick={() => saveMutation.mutate()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            )}
            <button type="button" className="reading-topbar-icon" aria-label="Share" onClick={shareLink}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
          </div>
        </header>

        <div className="reading-content-wrap">
          <article ref={articleRef} className="reading-article">
            <header className="reading-article-header">
              <span className="reading-category-pill">{content.categoryName}</span>
              <h1 className="reading-article-title">{content.title}</h1>

              <div className="reading-author-row">
                {content.creatorImageUrl ? (
                  <img src={content.creatorImageUrl} alt="" className="reading-author-avatar" />
                ) : (
                  <div className="reading-author-avatar reading-author-avatar--fallback">
                    {content.creatorName[0]?.toUpperCase()}
                  </div>
                )}
                <div className="reading-author-info">
                  <p className="reading-author-name">
                    <CreatorName name={content.creatorName} verified={content.creatorVerified} size="md" />
                  </p>
                  <p className="reading-author-meta">
                    {followStatus?.followerCount != null && (
                      <span>{followStatus.followerCount} subscribers</span>
                    )}
                  </p>
                </div>
                {me && me.clerkId !== content.creatorId && (
                  <button
                    type="button"
                    className={`reading-follow-btn${followStatus?.subscribed ? " reading-follow-btn--active" : ""}`}
                    onClick={() => followMutation.mutate()}
                    disabled={followMutation.isPending}
                  >
                    {followStatus?.subscribed ? "Following" : "Follow"}
                  </button>
                )}
              </div>

              <div className="reading-stats-row">
                {content.readingTimeMinutes != null && (
                  <span className="reading-stat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    {content.readingTimeMinutes} min read
                  </span>
                )}
                {wordCount > 0 && (
                  <span className="reading-stat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                    {wordCount.toLocaleString()} words
                  </span>
                )}
                <span className="reading-stat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  {content.viewCount ?? 0} views
                </span>
              </div>

              <div className="reading-actions-row">
                <span className="reading-story-type">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                  {typeLabel}
                </span>
                <div className="reading-actions-row-right">
                  {content.type === "article" && (
                    <button type="button" className="reading-action-btn" onClick={toggleReadAloud}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                      {readingAloud ? "Stop" : "Read aloud"}
                    </button>
                  )}
                  <button type="button" className="reading-action-btn" onClick={shareLink}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                    Share
                  </button>
                </div>
              </div>
            </header>

            <div
              className={`reading-body${darkMode ? " reading-body--dark" : ""}`}
              style={{ fontSize: bodyFontSize, lineHeight, fontFamily: "'Lora', Georgia, serif" }}
            >
              {renderBody()}
            </div>

            {showNext && nextContent && (
              <div className="reading-next-card">
                <p className="reading-next-label">Up next in {content.categoryName}</p>
                <h3 className="reading-next-title">{nextContent.title}</h3>
                <p className="reading-next-meta">
                  by <CreatorName name={nextContent.creatorName} verified={nextContent.creatorVerified} />
                  {" · "}{Number(nextContent.price) === 0 ? "Free" : `$${Number(nextContent.price).toFixed(2)} USDC`}
                </p>
                <Link href={`/content/${nextContent.id}`} className="reading-next-cta">
                  Continue reading →
                </Link>
              </div>
            )}

            <div ref={commentsRef} className="reading-comments">
              <ContentEngagement contentId={id} creatorId={content.creatorId} />
            </div>
          </article>

          <ReadingEngagementRail
            contentId={id}
            onComment={scrollToComments}
            onClose={() => setLocation(`/content/${id}`)}
          />
        </div>
      </div>
    </div>
  );
}
