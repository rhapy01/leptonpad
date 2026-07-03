import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchMyPurchasesWithSettlement } from "@/lib/platformApi";
import { fetchReaderSummary } from "@/lib/dashboardApi";
import { SettlementStatusBadge } from "@/components/SettlementStatusBadge";

export function PurchasedCollectionPanel() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["dashboard", "reader"],
    queryFn: fetchReaderSummary,
  });
  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ["purchases", "settlement"],
    queryFn: fetchMyPurchasesWithSettlement,
  });

  const loading = summaryLoading || purchasesLoading;

  if (loading) {
    return <p style={{ color: "#78716C" }}>Loading…</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="p-4" style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.12)" }}>
          <p className="editorial-label mb-1" style={{ color: "#78716C" }}>Total spent</p>
          <p
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#1C1917",
            }}
          >
            ${Number(summary?.totalSpent ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="p-4" style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.12)" }}>
          <p className="editorial-label mb-1" style={{ color: "#78716C" }}>In your collection</p>
          <p
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#1C1917",
            }}
          >
            {summary?.purchaseCount ?? 0}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {(purchases ?? []).map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 p-3"
            style={{ border: "1px solid rgba(28,25,23,0.08)" }}
          >
            <div className="min-w-0 flex-1">
              <Link href={`/read/${p.contentId}`}>
                <p className="text-sm font-medium hover:underline" style={{ color: "#1C1917" }}>
                  {p.contentTitle}
                </p>
              </Link>
              <p className="text-xs mt-0.5" style={{ color: "#78716C" }}>
                Unlocked {new Date(p.paidAt).toLocaleDateString()} · ${Number(p.amountPaid).toFixed(2)} USDC
              </p>
              <div className="mt-1">
                <SettlementStatusBadge status={p.settlementStatus} splitTxHash={p.splitTxHash} />
              </div>
            </div>
            <Link
              href={`/read/${p.contentId}`}
              className="text-xs font-semibold shrink-0"
              style={{ color: "#C8960C" }}
            >
              Read →
            </Link>
          </div>
        ))}
        {(purchases ?? []).length === 0 && (
          <p className="text-sm" style={{ color: "#78716C" }}>
            Your collection is empty. When you pay to unlock a piece, it stays here forever. Browse the{" "}
            <Link href="/feed" className="underline">feed</Link>.
          </p>
        )}
      </div>
    </>
  );
}
