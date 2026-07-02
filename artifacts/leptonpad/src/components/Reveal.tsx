import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Extra delay before this block animates in */
  delay?: number;
  as?: ElementType;
  /** Stagger animate direct children when scrolled into view */
  stagger?: boolean;
};

/** Fade + rise when scrolled into view. Respects prefers-reduced-motion. */
export function Reveal({
  children,
  className = "",
  style,
  delay = 0,
  as: Tag = "div",
  stagger = false,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -4% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const classes = [stagger ? "motion-stagger" : "motion-reveal", visible && "motion-visible", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      ref={ref as never}
      className={classes}
      style={{ ...style, "--motion-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
