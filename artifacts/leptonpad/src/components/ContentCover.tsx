import { resolveCoverUrl } from "@/lib/contentCover";

type ContentCoverProps = {
  coverImageUrl?: string | null;
  categorySlug: string;
  id: number;
  title: string;
  aspect?: "video" | "wide" | "square";
  /** compact = grid tiles, featured = larger lead card, default = feed aspect-video */
  size?: "default" | "compact" | "featured";
  className?: string;
  rounded?: boolean;
};

export function ContentCover({
  coverImageUrl,
  categorySlug,
  id,
  title,
  aspect = "video",
  size = "default",
  className = "",
  rounded = false,
}: ContentCoverProps) {
  const src = resolveCoverUrl(coverImageUrl, categorySlug, id);

  const sizeClass =
    size === "compact"
      ? "h-[150px] sm:h-[175px]"
      : size === "featured"
        ? "aspect-[2/1] sm:aspect-video"
        : aspect === "square"
          ? "aspect-square"
          : aspect === "wide"
            ? "aspect-[21/9]"
            : "aspect-video";

  return (
    <img
      src={src}
      alt=""
      className={`content-cover block w-full shrink-0 object-cover bg-[#E7E3DC] ${sizeClass} ${rounded ? "rounded-sm" : ""} ${className}`}
      loading="lazy"
      onError={e => {
        const el = e.currentTarget;
        if (!el.dataset.fallback) {
          el.dataset.fallback = "1";
          el.src = `https://picsum.photos/seed/leptonpad-${id}/800/450`;
        }
      }}
    />
  );
}
