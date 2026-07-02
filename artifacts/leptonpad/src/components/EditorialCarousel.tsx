import { useCallback, useEffect, useState, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";

interface EditorialCarouselProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  slideClassName?: string;
  loop?: boolean;
  autoplay?: boolean;
  autoplayDelay?: number;
}

export function EditorialCarousel({
  title,
  subtitle,
  children,
  slideClassName = "w-[85%] basis-[85%] sm:w-[48%] sm:basis-[48%] lg:w-[32%] lg:basis-[32%]",
  loop = true,
  autoplay = false,
  autoplayDelay = 4500,
}: EditorialCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop,
    dragFree: !autoplay,
    containScroll: "trimSnaps",
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [paused, setPaused] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || !autoplay || paused) return;
    const timer = setInterval(() => {
      if (emblaApi.canScrollNext()) emblaApi.scrollNext();
      else emblaApi.scrollTo(0);
    }, autoplayDelay);
    return () => clearInterval(timer);
  }, [emblaApi, autoplay, autoplayDelay, paused]);

  const slides = Array.isArray(children) ? children : [children];

  return (
    <section className="py-6">
      {(title || subtitle) && (
        <div className="flex items-end justify-between mb-4 gap-4">
          <div>
            {title && <span className="editorial-section-label">{title}</span>}
            {subtitle && (
              <p className="text-sm mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#78716C" }}>
                {subtitle}
              </p>
            )}
            <div className="editorial-rule mt-2" />
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={scrollPrev}
              disabled={!canPrev}
              aria-label="Previous"
              className="w-9 h-9 flex items-center justify-center transition-opacity disabled:opacity-30"
              style={{ border: "1px solid #1C1917", color: "#1C1917", background: "var(--color-page)" }}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={scrollNext}
              disabled={!canNext}
              aria-label="Next"
              className="w-9 h-9 flex items-center justify-center transition-opacity disabled:opacity-30"
              style={{ border: "1px solid #1C1917", color: "#1C1917", background: "var(--color-page)" }}
            >
              ›
            </button>
          </div>
        </div>
      )}
      <div
        ref={emblaRef}
        className="overflow-hidden -mx-1 px-1"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div className="flex touch-pan-y items-stretch gap-4">
          {slides.map((slide, i) => (
            <div key={i} className={`editorial-carousel-slide min-w-0 shrink-0 ${slideClassName}`}>
              <div className="h-full w-full min-w-0">{slide}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
