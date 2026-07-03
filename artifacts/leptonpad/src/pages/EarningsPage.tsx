import { useEffect } from "react";
import {
  useGetEarningsSummary,
  useGetEarningsByContent,
  useGetRecentPayments,
  useListAiSuggestions,
  useApplyAiSuggestion,
  useDismissAiSuggestion,
  getGetEarningsSummaryQueryKey,
  getGetEarningsByContentQueryKey,
  getGetRecentPaymentsQueryKey,
  getListAiSuggestionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/DashboardShell";
import { WalletFundsPanel } from "@/components/WalletFundsPanel";
import { WalletUnlockGate } from "@/components/WalletUnlockGate";
import { SettlementStatusBadge } from "@/components/SettlementStatusBadge";

export default function EarningsPage() {
  const queryClient = useQueryClient();

  const { data: summary, isLoading: summaryLoading } = useGetEarningsSummary();
  const { data: byContent, isLoading: contentLoading } = useGetEarningsByContent();
  const { data: recent } = useGetRecentPayments(
    { limit: 20 },
    { query: { queryKey: getGetRecentPaymentsQueryKey({ limit: 20 }), refetchInterval: 10_000 } }
  );
  const { data: suggestions } = useListAiSuggestions();
  const applyAi = useApplyAiSuggestion();
  const dismissAi = useDismissAiSuggestion();

  const handleApply = async (id: number) => {
    await applyAi.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListAiSuggestionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetEarningsByContentQueryKey() });
  };

  const handleDismiss = async (id: number) => {
    await dismissAi.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListAiSuggestionsQueryKey() });
  };

  const activeSuggestions = suggestions?.filter(s => s.status === "pending") ?? [];

  // Agent auto-review: scan all published content and surface pricing suggestions
  useEffect(() => {
    fetch("/api/ai/auto-review", { method: "POST", credentials: "include" })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: getListAiSuggestionsQueryKey() });
      })
      .catch(() => {});
  }, [queryClient]);

  const statCard = (label: string, value: string, sub: string, gold = false) => (
    <div
      key={label}
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(28,25,23,0.12)",
        borderRadius: "2px",
        padding: "20px",
      }}
    >
      <p className="editorial-label mb-2" style={{ color: "#78716C" }}>{label}</p>
      <p
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "1.75rem",
          fontWeight: 700,
          color: gold ? "#C8960C" : "#1C1917",
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: "11px", color: "#78716C", marginTop: "4px" }}>{sub}</p>
    </div>
  );

  return (
    <DashboardShell title="Earnings" subtitle="Your content performance and USDC income">
        <div className="space-y-10">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse" style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.1)", borderRadius: "2px", padding: "20px", height: "96px" }}>
                    <div className="h-2 rounded w-1/2 mb-3" style={{ background: "rgba(28,25,23,0.08)" }} />
                    <div className="h-7 rounded w-3/4" style={{ background: "rgba(28,25,23,0.06)" }} />
                  </div>
                ))
              : [
                  statCard("Total earned", `$${Number(summary?.totalEarnedAllTime ?? 0).toFixed(4)}`, "USDC all time", true),
                  statCard("This week", `$${Number(summary?.thisWeekEarnings ?? 0).toFixed(4)}`, "USDC", true),
                  statCard("Purchases received", String(summary?.totalPurchases ?? 0), "payments", false),
                  statCard("Conversion rate", `${Number(summary?.conversionRate ?? 0).toFixed(1)}%`, "of viewers paid", false),
                ]
            }
          </div>

          <WalletUnlockGate>
            <WalletFundsPanel variant="embedded" />
          </WalletUnlockGate>

          {/* Content table + Recent payments side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Published content table */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <p className="editorial-label" style={{ color: "#78716C" }}>Published content</p>
                <div style={{ flex: 1, borderTop: "1px solid rgba(28,25,23,0.1)" }} />
              </div>
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(28,25,23,0.12)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                {contentLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-10 animate-pulse rounded" style={{ background: "rgba(28,25,23,0.05)" }} />
                    ))}
                  </div>
                ) : (byContent?.length ?? 0) === 0 ? (
                  <div className="p-8 text-center" style={{ color: "#78716C", fontSize: "0.875rem" }}>
                    No published content yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(28,25,23,0.12)" }}>
                          {["Title", "Views", "Sales", "Conv.", "Earned"].map((h, i) => (
                            <th
                              key={h}
                              className={i === 0 ? "text-left" : "text-right"}
                              style={{
                                padding: "10px 16px",
                                fontSize: "10px",
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                fontWeight: 600,
                                color: "#78716C",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {byContent?.map((row, idx) => (
                          <tr
                            key={row.contentId}
                            style={{
                              borderBottom: idx < (byContent.length - 1) ? "1px solid rgba(28,25,23,0.06)" : "none",
                            }}
                            onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = "rgba(28,25,23,0.025)")}
                            onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                            data-testid={`row-earnings-${row.contentId}`}
                          >
                            <td style={{ padding: "12px 16px" }}>
                              <div className="flex items-center gap-2">
                                <span
                                  className="font-medium truncate max-w-[160px] sm:max-w-[220px]"
                                  style={{ color: "#1C1917", fontSize: "0.8125rem" }}
                                >
                                  {row.title}
                                </span>
                                {row.hasSuggestion && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ background: "#C8960C" }}
                                    title="AI suggestion available"
                                  />
                                )}
                              </div>
                              <span style={{ fontSize: "11px", color: "#78716C" }}>{row.type}</span>
                            </td>
                            <td className="text-right" style={{ padding: "12px 16px", color: "#78716C", fontSize: "0.8125rem" }}>{row.views}</td>
                            <td className="text-right" style={{ padding: "12px 16px", color: "#78716C", fontSize: "0.8125rem" }}>{row.purchases}</td>
                            <td className="text-right" style={{ padding: "12px 16px" }}>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  color: row.conversionRate > 15 ? "#16A34A" : row.conversionRate < 3 ? "#DC2626" : "#78716C",
                                }}
                              >
                                {Number(row.conversionRate).toFixed(1)}%
                              </span>
                            </td>
                            <td className="text-right" style={{ padding: "12px 16px" }}>
                              <span
                                style={{ fontWeight: 700, color: "#C8960C", fontSize: "0.875rem", fontFamily: "'Playfair Display', Georgia, serif" }}
                              >
                                ${Number(row.totalEarned).toFixed(4)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Recent payments */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <p className="editorial-label" style={{ color: "#78716C" }}>Recent payments</p>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Live" />
                <div style={{ flex: 1, borderTop: "1px solid rgba(28,25,23,0.1)" }} />
              </div>
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(28,25,23,0.12)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                {(recent?.length ?? 0) === 0 ? (
                  <div className="p-6 text-center" style={{ color: "#78716C", fontSize: "0.875rem" }}>
                    No payments yet. Share your content.
                  </div>
                ) : (
                  <div className="divide-y max-h-80 overflow-y-auto" style={{ borderColor: "rgba(28,25,23,0.06)" }}>
                    {recent?.map(payment => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between gap-2"
                        style={{ padding: "12px 16px" }}
                        data-testid={`payment-event-${payment.id}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate" style={{ fontSize: "0.8125rem", color: "#1C1917", fontWeight: 500 }}>{payment.contentTitle}</p>
                          <p style={{ fontSize: "11px", color: "#78716C", marginTop: "2px" }}>{payment.readerName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#C8960C" }}>
                            +${Number(payment.creatorAmount).toFixed(4)}
                          </p>
                          <p style={{ fontSize: "11px", color: "#78716C" }}>
                            {new Date(payment.paidAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <SettlementStatusBadge
                            status={(payment as { settlementStatus?: string }).settlementStatus}
                            splitTxHash={payment.splitTxHash as string | null | undefined}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Pricing Suggestions */}
          {activeSuggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <p className="editorial-label" style={{ color: "#78716C" }}>AI pricing suggestions</p>
                <span
                  style={{ fontSize: "10px", color: "#C8960C", background: "rgba(200,150,12,0.1)", padding: "2px 8px", borderRadius: "2px" }}
                >
                  {activeSuggestions.length} active
                </span>
                <div style={{ flex: 1, borderTop: "1px solid rgba(28,25,23,0.1)" }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSuggestions.map(suggestion => (
                  <div
                    key={suggestion.id}
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(200,150,12,0.25)",
                      borderRadius: "2px",
                      padding: "20px",
                    }}
                    data-testid={`ai-suggestion-${suggestion.id}`}
                  >
                    <p className="font-semibold truncate mb-2" style={{ color: "#1C1917", fontSize: "0.875rem" }}>{suggestion.contentTitle}</p>
                    <div className="flex items-center gap-2 mb-3">
                      <span style={{ fontSize: "12px", color: "#78716C" }}>${Number(suggestion.currentPrice).toFixed(4)}</span>
                      <span style={{ color: "#78716C", fontSize: "12px" }}>→</span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#C8960C" }}>${Number(suggestion.suggestedPrice).toFixed(4)}</span>
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: "2px",
                          color: suggestion.action === "raise" ? "#16A34A" : suggestion.action === "lower" ? "#DC2626" : "#C8960C",
                          background: suggestion.action === "raise" ? "rgba(22,163,74,0.1)" : suggestion.action === "lower" ? "rgba(220,38,38,0.1)" : "rgba(200,150,12,0.1)",
                        }}
                      >
                        {suggestion.action}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: "#78716C", lineHeight: "1.6", marginBottom: "16px" }}>{suggestion.reasoning}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApply(suggestion.id)}
                        disabled={applyAi.isPending}
                        data-testid={`button-apply-suggestion-${suggestion.id}`}
                        className="flex-1 py-2 text-xs font-semibold transition-colors"
                        style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => handleDismiss(suggestion.id)}
                        disabled={dismissAi.isPending}
                        data-testid={`button-dismiss-suggestion-${suggestion.id}`}
                        className="flex-1 py-2 text-xs font-medium transition-colors"
                        style={{ background: "rgba(28,25,23,0.06)", color: "#78716C", borderRadius: "2px" }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
    </DashboardShell>
  );
}
