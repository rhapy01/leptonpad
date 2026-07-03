import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFeedAds, trackAdImpression } from "@/lib/platformApi";
import { AdvertiseHereDialog } from "@/components/AdvertiseHereDialog";

export function AdBanner({ category }: { category?: string }) {
  const [advertiseOpen, setAdvertiseOpen] = useState(false);
  const { data: ads = [] } = useQuery({
    queryKey: ["ads", category],
    queryFn: () => fetchFeedAds(category),
  });

  const ad = ads[0];

  useEffect(() => {
    if (ad) {
      trackAdImpression(ad.id, false).catch(() => {});
    }
  }, [ad?.id]);

  if (ad) {
    return (
      <div
        className="my-4 p-3 rounded flex gap-3 items-center"
        style={{ background: "rgba(28,25,23,0.04)", border: "1px solid rgba(28,25,23,0.08)" }}
      >
        <span className="text-[10px] uppercase tracking-wider shrink-0" style={{ color: "#A8A29E" }}>
          Sponsored
        </span>
        {ad.imageUrl && (
          <img src={ad.imageUrl} alt="" className="w-16 h-10 object-cover rounded shrink-0" />
        )}
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

  return (
    <>
      <button
        type="button"
        onClick={() => setAdvertiseOpen(true)}
        className="my-4 w-full p-3 rounded flex gap-3 items-center text-left transition-colors"
        style={{
          background: "rgba(200,150,12,0.08)",
          border: "1px dashed rgba(200,150,12,0.45)",
          cursor: "pointer",
        }}
      >
        <span className="text-[10px] uppercase tracking-wider shrink-0" style={{ color: "#A8A29E" }}>
          Ad space
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: "#1C1917" }}>Advertise here</p>
          <p className="text-xs" style={{ color: "#78716C" }}>
            Reach readers in the feed — submit your banner for review
          </p>
        </div>
        <span
          className="text-xs px-3 py-1.5 rounded shrink-0 font-semibold"
          style={{ background: "#C8960C", color: "#1C1917" }}
        >
          Get started
        </span>
      </button>
      <AdvertiseHereDialog open={advertiseOpen} onOpenChange={setAdvertiseOpen} category={category} />
    </>
  );
}
