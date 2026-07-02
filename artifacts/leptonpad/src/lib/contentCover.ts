/** Category fallbacks when no cover was uploaded. */
const CATEGORY_COVERS: Record<string, string> = {
  "crypto-web3": "https://picsum.photos/seed/lepton-crypto/800/450",
  "music-audio": "https://picsum.photos/seed/lepton-audio/800/450",
  "independent-writing": "https://picsum.photos/seed/lepton-writing/800/450",
  "video-film": "https://picsum.photos/seed/lepton-video/800/450",
  "tech-development": "https://picsum.photos/seed/lepton-tech/800/450",
};

export function resolveCoverUrl(
  coverImageUrl: string | null | undefined,
  categorySlug: string,
  id: number,
): string {
  if (coverImageUrl?.trim()) return coverImageUrl.trim();
  return CATEGORY_COVERS[categorySlug] ?? `https://picsum.photos/seed/leptonpad-${id}/800/450`;
}
