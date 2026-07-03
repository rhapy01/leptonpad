import { arcTxExplorerUrl } from "@/lib/arcExplorer";

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
        Confirmed →
      </a>
    );
  }
  if (status === "pending") {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#C8960C" }}>
        Processing
      </span>
    );
  }
  return null;
}
