/** Helpers for YouTube embeds used in featured video/audio samples. */

export function youtubeThumbnail(videoId: string, quality: "hqdefault" | "maxresdefault" = "hqdefault"): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function parseYoutubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] ?? null;
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

export function isYoutubeMediaUrl(url: string | null | undefined): boolean {
  return !!url && parseYoutubeId(url) !== null;
}
