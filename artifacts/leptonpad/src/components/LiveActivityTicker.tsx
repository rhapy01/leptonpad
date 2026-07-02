import { useEffect, useRef, useState } from "react";
import { CreatorName } from "@/components/CreatorName";

interface ActivityEvent {
  contentTitle: string;
  amount: number;
  creatorName: string;
  creatorVerified?: boolean;
  secondsAgo: number;
}

function timeLabel(s: number): string {
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function LiveActivityTicker() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  async function fetchActivity() {
    try {
      const res = await fetch(`${basePath}/api/stats/recent-activity`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.events) && data.events.length > 0) {
        setEvents(data.events);
      }
    } catch {
      // silent fail
    }
  }

  useEffect(() => {
    fetchActivity();
    intervalRef.current = setInterval(fetchActivity, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  if (events.length === 0) return null;

  // Duplicate items for seamless loop
  const items = [...events, ...events];

  return (
    <div
      className="overflow-hidden border-b"
      style={{
        background: "#1C1917",
        borderColor: "#1C1917",
        height: "32px",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div className="shrink-0 px-3 flex items-center gap-1.5 border-r border-white/10 h-full">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F5C842] animate-pulse" />
        <span className="text-[10px] font-semibold tracking-widest uppercase text-[#F5C842]/80 whitespace-nowrap">
          Live
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="ticker-track flex items-center h-full">
          {items.map((ev, i) => (
            <span
              key={i}
              className="ticker-item flex items-center gap-2 px-5 whitespace-nowrap"
            >
              <span className="text-[#78716C] text-[11px]">↗</span>
              <CreatorName
                name={ev.creatorName}
                verified={ev.creatorVerified}
                dark
                size="sm"
                className="text-[11px] text-[#FAF7F2]/80 font-medium"
              />
              <span className="text-[#78716C] text-[11px]">·</span>
              <span className="text-[11px] text-[#FAF7F2]/60 max-w-[180px] truncate inline-block">
                {ev.contentTitle.length > 40 ? ev.contentTitle.slice(0, 38) + "…" : ev.contentTitle}
              </span>
              <span className="text-[#78716C] text-[11px]">·</span>
              <span className="text-[11px] font-semibold" style={{ color: "#F5C842" }}>
                ${ev.amount.toFixed(ev.amount < 0.01 ? 6 : 2)} USDC
              </span>
              <span className="text-[#78716C] text-[11px]">·</span>
              <span className="text-[11px] text-[#78716C]">{timeLabel(ev.secondsAgo)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
