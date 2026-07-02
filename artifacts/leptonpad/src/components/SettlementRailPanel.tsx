import { useQuery } from "@tanstack/react-query";
import { fetchCreatorSettlement, fetchSettlementRail } from "@/lib/platformApi";
import { arcTxExplorerUrl } from "@/lib/arcExplorer";

type Props = {
  variant?: "public" | "creator";
};

export function SettlementRailPanel({ variant = "public" }: Props) {
  const { data: rail } = useQuery({
    queryKey: ["settlement-rail"],
    queryFn: fetchSettlementRail,
  });
  const { data: creatorStats } = useQuery({
    queryKey: ["earnings", "settlement"],
    queryFn: fetchCreatorSettlement,
    enabled: variant === "creator",
    refetchInterval: 15_000,
  });

  if (!rail || rail.mockMode) return null;

  const contract = rail.splitContract;
  const contractUrl = contract
    ? `${rail.explorerBase}/address/${contract}`
    : null;

  return (
    <section
      className="mb-6 rounded-sm border p-4 sm:p-5 space-y-3"
      style={{ background: "#FFFBEB", borderColor: "rgba(200,150,12,0.35)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="editorial-label mb-1" style={{ color: "#92400E" }}>
            Arc settlement
          </p>
          <h2 className="text-sm font-semibold" style={{ color: "#1C1917" }}>
            x402 → LeptonSplit → creator wallet
          </h2>
        </div>
        {variant === "creator" && creatorStats && (
          <div className="text-right text-xs" style={{ color: "#57534E" }}>
            <p>
              <strong style={{ color: "#1C1917" }}>{creatorStats.salesSettledOnChain}</strong>{" "}
              settled on-chain
            </p>
            {creatorStats.salesPendingSplit > 0 && (
              <p style={{ color: "#C8960C" }}>
                {creatorStats.salesPendingSplit} finishing split…
              </p>
            )}
          </div>
        )}
      </div>

      <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: "#57534E" }}>
        {rail.flow.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      {contract && contractUrl && (
        <p className="text-xs font-mono break-all" style={{ color: "#78716C" }}>
          LeptonSplit:{" "}
          <a href={contractUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#C8960C" }}>
            {contract}
          </a>
        </p>
      )}

      {variant === "creator" && creatorStats && creatorStats.salesPendingSplit > 0 && (
        <p className="text-xs" style={{ color: "#78716C" }}>
          Gateway batch in flight — splits complete automatically. Refresh or open Earnings again in a few seconds.
        </p>
      )}
    </section>
  );
}

/** Inline badge for a single sale row */
export function SettlementStatusBadge({
  status,
  splitTxHash,
}: {
  status?: string;
  splitTxHash?: string | null;
}) {
  const url = splitTxHash ? arcTxExplorerUrl(splitTxHash) : null;
  if (status === "settled" && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "#16A34A" }}
      >
        Settled on Arc →
      </a>
    );
  }
  if (status === "pending") {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#C8960C" }}>
        Split pending
      </span>
    );
  }
  return null;
}
