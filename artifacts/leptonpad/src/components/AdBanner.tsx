import { useQuery } from "@tanstack/react-query";
import { fetchFeedAds, trackAdImpression } from "@/lib/platformApi";

export function AdBanner({ category }: { category?: string }) {
  const { data: ads = [] } = useQuery({
    queryKey: ["ads", category],
    queryFn: () => fetchFeedAds(category),
  });

  const ad = ads[0];
  if (!ad) return null;

  return (
    <div className="my-4 p-3 rounded flex gap-3 items-center" style={{ background: "rgba(28,25,23,0.04)", border: "1px solid rgba(28,25,23,0.08)" }}>
      <span className="text-[10px] uppercase tracking-wider shrink-0" style={{ color: "#A8A29E" }}>Sponsored</span>
      {ad.imageUrl && <img src={ad.imageUrl} alt="" className="w-16 h-10 object-cover rounded shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "#1C1917" }}>{ad.title}</p>
        <p className="text-xs" style={{ color: "#78716C" }}>{ad.advertiser}</p>
      </div>
      <a
        href={ad.targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => { trackAdImpression(ad.id, true).catch(() => {}); }}
        className="text-xs px-3 py-1.5 rounded shrink-0"
        style={{ background: "#1C1917", color: "#FAF7F2" }}
      >
        Learn more
      </a>
    </div>
  );
}
