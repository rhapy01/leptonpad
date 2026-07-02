import { parseYoutubeId } from "@/lib/youtube";

export function YoutubeEmbed({
  url,
  title,
  className = "aspect-video w-full overflow-hidden rounded",
}: {
  url: string;
  title: string;
  className?: string;
}) {
  const id = parseYoutubeId(url);
  const src = id
    ? `https://www.youtube.com/embed/${id}?rel=0`
    : url.includes("/embed/")
      ? url
      : url;

  return (
    <div className={className} style={{ background: "#1C1917" }}>
      <iframe
        src={src}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={title}
      />
    </div>
  );
}
