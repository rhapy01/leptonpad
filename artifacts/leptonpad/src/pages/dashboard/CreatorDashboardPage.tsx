import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  useGetEarningsSummary,
  useGetEarningsByContent,
  useGetRecentPayments,
} from "@workspace/api-client-react";
import { DashboardShell } from "@/components/DashboardShell";
import { broadcastToSubscribers } from "@/lib/platformApi";
import { useToast } from "@/hooks/use-toast";

export default function CreatorDashboardPage() {
  const { toast } = useToast();
  const [lastBroadcast, setLastBroadcast] = useState<string | null>(null);
  const { data: summary, isLoading } = useGetEarningsSummary();
  const { data: byContent } = useGetEarningsByContent();
  const { data: recent } = useGetRecentPayments({ limit: 10 });

  const broadcastMutation = useMutation({
    mutationFn: () => broadcastToSubscribers(),
    onSuccess: (result) => {
      setLastBroadcast(result.title);
      toast({
        title: "Broadcast sent",
        description: `Emailed ${result.emailed} of ${result.subscriberCount} subscribers about "${result.title}".`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Broadcast failed", description: err.message, variant: "destructive" });
    },
  });

  const stat = (label: string, value: string, gold = false) => (
    <div
      className="p-4"
      style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.12)" }}
    >
      <p className="editorial-label mb-1" style={{ color: "#78716C" }}>{label}</p>
      <p
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "1.5rem",
          fontWeight: 700,
          color: gold ? "#C8960C" : "#1C1917",
        }}
      >
        {value}
      </p>
    </div>
  );

  return (
    <DashboardShell
      title="Creator dashboard"
      subtitle="Track earnings, notify subscribers, and manage your published work"
    >
      {isLoading ? (
        <p style={{ color: "#78716C" }}>Loading earnings…</p>
      ) : (
        <>
          <div
            className="p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.12)" }}
          >
            <div>
              <h2 className="font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Subscriber broadcast
              </h2>
              <p className="text-sm" style={{ color: "#78716C" }}>
                Email everyone subscribed to your profile about your latest published work.
                Subscribers also get an automatic email when you publish.
              </p>
              {lastBroadcast && (
                <p className="text-xs mt-2" style={{ color: "#A8A29E" }}>
                  Last broadcast: {lastBroadcast}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => broadcastMutation.mutate()}
              disabled={broadcastMutation.isPending}
              className="shrink-0 px-5 py-2.5 text-sm font-semibold rounded"
              style={{ background: "#1C1917", color: "#FAF7F2" }}
            >
              {broadcastMutation.isPending ? "Sending…" : "Broadcast to subscribers"}
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {stat("Total earned", `$${Number(summary?.totalEarnedAllTime ?? 0).toFixed(2)}`, true)}
            {stat("This week", `$${Number(summary?.thisWeekEarnings ?? 0).toFixed(2)}`, true)}
            {stat("Purchases", String(summary?.totalPurchases ?? 0))}
            {stat("Conversion", `${Number(summary?.conversionRate ?? 0).toFixed(1)}%`)}
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              By content
            </h2>
            <Link href="/earnings" className="text-xs font-semibold" style={{ color: "#C8960C" }}>
              Full earnings →
            </Link>
          </div>

          <div className="space-y-2 mb-8">
            {(byContent ?? []).slice(0, 5).map(row => (
              <div
                key={row.contentId}
                className="flex items-center justify-between p-3"
                style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.08)" }}
              >
                <span className="text-sm line-clamp-1 flex-1 mr-4" style={{ color: "#1C1917" }}>
                  {row.title}
                </span>
                <span className="text-sm font-bold shrink-0" style={{ color: "#C8960C" }}>
                  ${Number(row.totalEarned).toFixed(2)}
                </span>
              </div>
            ))}
            {(byContent ?? []).length === 0 && (
              <p className="text-sm" style={{ color: "#78716C" }}>
                No published content yet. <Link href="/create" className="underline">Publish your first piece</Link>.
              </p>
            )}
          </div>

          <h2 className="font-bold mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Recent sales
          </h2>
          <div className="space-y-2">
            {(recent ?? []).map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 text-sm"
                style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.08)" }}
              >
                <span style={{ color: "#57534E" }}>{p.contentTitle}</span>
                <span className="font-semibold" style={{ color: "#C8960C" }}>
                  +${Number(p.creatorAmount).toFixed(2)}
                </span>
              </div>
            ))}
            {(recent ?? []).length === 0 && (
              <p className="text-sm" style={{ color: "#78716C" }}>No sales yet.</p>
            )}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
