import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetContent,
  useCheckContentAccess,
  getGetContentQueryKey,
  getCheckContentAccessQueryKey,
} from "@workspace/api-client-react";

type FontSize = "sm" | "md" | "lg";

const fontSizeMap: Record<FontSize, { body: string; lineHeight: string }> = {
  sm: { body: "1.05rem", lineHeight: "1.75" },
  md: { body: "1.2rem", lineHeight: "1.85" },
  lg: { body: "1.35rem", lineHeight: "1.9" },
};

export default function ReadingModePage({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const { data: content, isLoading } = useGetContent(id, { query: { enabled: !!id, queryKey: getGetContentQueryKey(id) } });
  const { data: access } = useCheckContentAccess(id, { query: { enabled: !!id, queryKey: getCheckContentAccessQueryKey(id) } });

  const isFree = Number(content?.price ?? 0) === 0;
  const hasAccess = access?.hasAccess || isFree || content?.hasAccess;

  useEffect(() => {
    if (!isLoading && !hasAccess && content) {
      setLocation(`/content/${id}`);
    }
  }, [isLoading, hasAccess, content, id, setLocation]);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const totalHeight = el.offsetHeight - window.innerHeight;
    if (totalHeight <= 0) { setProgress(100); return; }
    const scrolled = -rect.top;
    setProgress(Math.min(100, Math.max(0, (scrolled / totalHeight) * 100)));
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF7F2" }}>
        <div className="w-8 h-8 border-2 border-[#F5C842] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!content) return null;

  const bg = darkMode ? "#1A1814" : "#FAF7F2";
  const textColor = darkMode ? "#E8E3DB" : "#1C1917";
  const subtleColor = darkMode ? "#9E9990" : "#78716C";
  const borderColor = darkMode ? "#2A2824" : "#E7E3DC";

  const { body: bodyFontSize, lineHeight } = fontSizeMap[fontSize];

  return (
    <div
      ref={contentRef}
      className="reading-fade-in min-h-screen transition-colors duration-300"
      style={{
        background: bg,
        color: textColor,
        opacity: visible ? 1 : 0,
      }}
    >
      {/* Reading progress bar */}
      <div
        className="reading-progress-bar"
        data-testid="reading-progress-bar"
        style={{ width: `${progress}%` }}
      />

      {/* Floating header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 h-12 transition-colors duration-300"
        style={{ background: bg, borderBottom: `1px solid ${borderColor}` }}
      >
        {/* Logo mark */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full border flex items-center justify-center" style={{ borderColor: "#F5C842" }}>
            <span className="text-xs font-bold" style={{ color: "#F5C842", fontFamily: "Georgia, serif" }}>λ</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Font size */}
          <div className="flex items-center gap-1">
            {(["sm", "md", "lg"] as FontSize[]).map(size => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                data-testid={`button-font-size-${size}`}
                className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                style={{
                  background: fontSize === size ? `${textColor}15` : "transparent",
                  color: fontSize === size ? textColor : subtleColor,
                  fontSize: size === "sm" ? "10px" : size === "md" ? "12px" : "14px",
                  fontFamily: "serif",
                  fontWeight: "600",
                }}
              >
                A
              </button>
            ))}
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(d => !d)}
            data-testid="button-dark-mode-toggle"
            className="w-7 h-7 rounded flex items-center justify-center transition-colors"
            style={{ color: subtleColor }}
            title={darkMode ? "Light mode" : "Dark mode"}
          >
            {darkMode ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {/* Exit */}
          <button
            onClick={() => setLocation("/feed")}
            data-testid="button-exit-reading"
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{ color: subtleColor, border: `1px solid ${borderColor}` }}
          >
            Exit
          </button>
        </div>
      </header>

      {/* Article content */}
      <article className="max-w-[680px] mx-auto px-4 sm:px-6 pt-20 pb-24">
        {/* Article header */}
        <header className="mb-12">
          <h1
            className="font-bold leading-tight mb-6"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              color: textColor,
              lineHeight: 1.2,
            }}
          >
            {content.title}
          </h1>

          <div className="flex items-center gap-3 mb-6" style={{ borderBottom: `1px solid ${borderColor}`, paddingBottom: "1.5rem" }}>
            {content.creatorImageUrl ? (
              <img src={content.creatorImageUrl} alt={content.creatorName} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm" style={{ background: `${textColor}15`, color: textColor }}>
                {content.creatorName[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium" style={{ color: textColor }}>{content.creatorName}</p>
              <div className="flex items-center gap-2 text-xs" style={{ color: subtleColor }}>
                <span>{new Date(content.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                {content.readingTimeMinutes && (
                  <>
                    <span>·</span>
                    <span>{content.readingTimeMinutes} min read</span>
                  </>
                )}
                <span>·</span>
                <span style={{
                  background: `${textColor}10`,
                  padding: "1px 6px",
                  borderRadius: "3px",
                  fontSize: "10px",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}>
                  {content.categoryName}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div
          className="reading-body"
          style={{
            fontSize: bodyFontSize,
            lineHeight,
            color: textColor,
            fontFamily: "'Lora', 'Playfair Display', Georgia, serif",
          }}
        >
          {content.type === "article" ? (
            <div className="space-y-5">
              {(content.body || content.previewText || "").split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ) : content.type === "audio" && content.audioUrl ? (
            <div>
              <audio controls className="w-full rounded-lg" style={{ accentColor: "#F5C842" }}>
                <source src={content.audioUrl} />
              </audio>
              {content.body && (
                <div className="mt-6 space-y-5">
                  {content.body.split("\n\n").map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              )}
            </div>
          ) : content.type === "video" && content.videoUrl ? (
            <div>
              <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6">
                <iframe
                  src={content.videoUrl}
                  className="w-full h-full"
                  allowFullScreen
                  title={content.title}
                />
              </div>
              {content.body && (
                <div className="space-y-5">
                  {content.body.split("\n\n").map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: subtleColor }}>Content unavailable.</p>
          )}
        </div>

        {/* End of article */}
        <footer className="mt-16 pt-8" style={{ borderTop: `1px solid ${borderColor}` }}>
          <p className="text-center text-sm mb-6" style={{ color: subtleColor }}>
            Thank you for reading {content.creatorName}'s work.
          </p>
          <div className="text-center">
            <button
              onClick={() => setLocation("/feed")}
              className="px-6 py-2.5 rounded text-sm font-medium transition-colors"
              style={{
                border: `1px solid ${borderColor}`,
                color: textColor,
                background: "transparent",
              }}
              data-testid="button-return-to-feed"
            >
              Return to feed
            </button>
          </div>
        </footer>
      </article>
    </div>
  );
}
