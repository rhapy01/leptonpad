import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  useGetContent,
  useCheckContentAccess,
  getGetContentQueryKey,
  getCheckContentAccessQueryKey,
  useGetNextContent,
  getGetNextContentQueryKey,
} from "@workspace/api-client-react";
import type { Content } from "@workspace/api-client-react";

function parseSlides(html: string): string[] {
  if (!html) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  const slides: string[] = [];
  let current: HTMLElement[] = [];

  const flush = () => {
    const text = current.map(el => el.outerHTML).join("");
    if (text.trim()) slides.push(text);
    current = [];
  };

  for (const node of Array.from(body.children)) {
    const tag = node.tagName?.toLowerCase();
    if (tag === "h2" || tag === "h3" || tag === "hr") {
      flush();
      if (tag !== "hr") current.push(node as HTMLElement);
    } else {
      current.push(node as HTMLElement);
    }
  }
  flush();

  if (slides.length === 0 && html.trim()) {
    slides.push(html);
  }

  return slides;
}

export default function SlideReaderPage({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const [slideIndex, setSlideIndex] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [fade, setFade] = useState(true);

  const { data: content, isLoading } = useGetContent(id, { query: { enabled: !!id, queryKey: getGetContentQueryKey(id) } });
  const { data: access } = useCheckContentAccess(id, { query: { enabled: !!id, queryKey: getCheckContentAccessQueryKey(id) } });
  const { data: nextRaw } = useGetNextContent(id, { query: { enabled: !!id, queryKey: getGetNextContentQueryKey(id) } });
  const nextContent: Content | null = nextRaw && typeof nextRaw === "object" ? nextRaw : null;

  const isFree = Number(content?.price ?? 0) === 0;
  const hasAccess = access?.hasAccess || isFree || content?.hasAccess;

  useEffect(() => {
    if (!isLoading && !hasAccess && content) {
      setLocation(`/content/${id}`);
    }
  }, [isLoading, hasAccess, content, id, setLocation]);

  const slides = parseSlides(content?.body ?? "");
  const total = slides.length;

  const goTo = useCallback((idx: number) => {
    setFade(false);
    setTimeout(() => {
      setSlideIndex(Math.max(0, Math.min(idx, total - 1)));
      setFade(true);
    }, 150);
  }, [total]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        goTo(slideIndex + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goTo(slideIndex - 1);
      } else if (e.key === "Escape") {
        setLocation(`/read/${id}`);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [slideIndex, goTo, id, setLocation]);

  const bg = darkMode ? "#1A1814" : "#FAF7F2";
  const textColor = darkMode ? "#E8E3DB" : "#1C1917";
  const subtleColor = darkMode ? "#9E9990" : "#78716C";
  const borderColor = darkMode ? "#2A2824" : "#E7E3DC";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
        <div className="w-8 h-8 border-2 border-[#C8960C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!content) return null;

  const isEnd = slideIndex >= total - 1;

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-300"
      style={{ background: bg, color: textColor }}
    >
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 h-12"
        style={{ background: bg, borderBottom: `1px solid ${borderColor}` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0" style={{ borderColor: "#C8960C" }}>
            <span className="text-xs font-bold" style={{ color: "#C8960C", fontFamily: "Georgia, serif" }}>λ</span>
          </div>
          <span className="text-xs truncate hidden sm:block" style={{ color: subtleColor, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
            {content.title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums" style={{ color: subtleColor }}>
            {slideIndex + 1} / {total}
          </span>

          <button
            onClick={() => setDarkMode(d => !d)}
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{ color: subtleColor }}
            title={darkMode ? "Light mode" : "Dark mode"}
          >
            {darkMode ? "☀" : "☾"}
          </button>

          <button
            onClick={() => setLocation(`/read/${id}`)}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{ color: subtleColor, border: `1px solid ${borderColor}` }}
          >
            Scroll view
          </button>

          <button
            onClick={() => setLocation("/feed")}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{ color: subtleColor, border: `1px solid ${borderColor}` }}
          >
            Exit
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="fixed top-12 left-0 right-0 h-0.5 z-40" style={{ background: borderColor }}>
        <div
          className="h-full transition-all duration-300"
          style={{ width: total > 1 ? `${((slideIndex + 1) / total) * 100}%` : "100%", background: "#C8960C" }}
        />
      </div>

      {/* Slide content */}
      <main
        className="flex-1 flex items-center justify-center px-6 sm:px-12"
        style={{ paddingTop: "72px", paddingBottom: "80px" }}
      >
        <div
          className="max-w-[680px] w-full"
          style={{
            opacity: fade ? 1 : 0,
            transition: "opacity 0.15s ease",
          }}
        >
          {isEnd && total > 0 ? (
            <div className="text-center py-16">
              <p
                className="mb-4"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.5rem", color: textColor }}
              >
                {content.title}
              </p>
              <p className="text-sm mb-8" style={{ color: subtleColor }}>
                You've reached the end of this piece.
              </p>
              {nextContent && (
                <div
                  className="p-6 text-left cursor-pointer transition-colors"
                  style={{ border: `1px solid ${borderColor}`, borderRadius: "2px", background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(28,25,23,0.02)" }}
                  onClick={() => setLocation(`/slides/${nextContent.id}`)}
                >
                  <p className="text-xs mb-2" style={{ color: "#C8960C", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "Georgia, serif" }}>
                    Up next in {content.categoryName}
                  </p>
                  <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.1rem", color: textColor }}>
                    {nextContent.title}
                  </p>
                  <p className="text-xs mt-2" style={{ color: subtleColor }}>{nextContent.creatorName}</p>
                </div>
              )}
              <div className="flex justify-center gap-3 mt-6">
                <button
                  onClick={() => goTo(slideIndex - 1)}
                  className="px-4 py-2 text-sm rounded"
                  style={{ border: `1px solid ${borderColor}`, color: textColor }}
                >
                  ← Previous slide
                </button>
                <button
                  onClick={() => setLocation("/feed")}
                  className="px-4 py-2 text-sm rounded"
                  style={{ background: "#1C1917", color: "#FAF7F2" }}
                >
                  Back to feed
                </button>
              </div>
            </div>
          ) : (
            <div
              className="slide-content prose"
              style={{
                fontFamily: "'Lora', 'Playfair Display', Georgia, serif",
                fontSize: "clamp(1.1rem, 2.5vw, 1.35rem)",
                lineHeight: "1.85",
                color: textColor,
              }}
              dangerouslySetInnerHTML={{ __html: slides[slideIndex] ?? "" }}
            />
          )}
        </div>
      </main>

      {/* Nav controls */}
      <footer
        className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-6 sm:px-12 py-4"
        style={{ background: bg, borderTop: `1px solid ${borderColor}` }}
      >
        <button
          onClick={() => goTo(slideIndex - 1)}
          disabled={slideIndex === 0}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded transition-opacity disabled:opacity-30"
          style={{ color: textColor, border: `1px solid ${borderColor}` }}
        >
          ← Prev
        </button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: Math.min(total, 12) }).map((_, i) => {
            const idx = total <= 12 ? i : Math.floor((i / 11) * (total - 1));
            return (
              <button
                key={i}
                onClick={() => goTo(idx)}
                className="rounded-full transition-all"
                style={{
                  width: slideIndex === idx ? "8px" : "5px",
                  height: slideIndex === idx ? "8px" : "5px",
                  background: slideIndex === idx ? "#C8960C" : borderColor,
                }}
              />
            );
          })}
        </div>

        <button
          onClick={() => goTo(slideIndex + 1)}
          disabled={isEnd}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded transition-opacity disabled:opacity-30"
          style={{ color: textColor, border: `1px solid ${borderColor}` }}
        >
          Next →
        </button>
      </footer>
    </div>
  );
}
