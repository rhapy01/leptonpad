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
import { PlatformLayout } from "@/components/PlatformLayout";

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
    await applyAi.mutateAsync({ params: { id } });
    queryClient.invalidateQueries({ queryKey: getListAiSuggestionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetEarningsByContentQueryKey() });
  };

  const handleDismiss = async (id: number) => {
    await dismissAi.mutateAsync({ params: { id } });
    queryClient.invalidateQueries({ queryKey: getListAiSuggestionsQueryKey() });
  };

  const activeSuggestions = suggestions?.filter(s => s.status === "pending") ?? [];

  return (
    <PlatformLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#E8EAF0] mb-1">Earnings</h1>
          <p className="text-sm text-[#6B7280]">Your content performance and payment history</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Total Earned All Time", value: summaryLoading ? "—" : `$${Number(summary?.totalEarnedAllTime ?? 0).toFixed(4)}`, sublabel: "USDC", gold: true },
            { label: "This Week's Earnings", value: summaryLoading ? "—" : `$${Number(summary?.thisWeekEarnings ?? 0).toFixed(4)}`, sublabel: "USDC", gold: true },
            { label: "Total Purchases", value: summaryLoading ? "—" : String(summary?.totalPurchases ?? 0), sublabel: "payments received", gold: false },
            { label: "Conversion Rate", value: summaryLoading ? "—" : `${Number(summary?.conversionRate ?? 0).toFixed(1)}%`, sublabel: "of viewers paid", gold: false },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl p-5 border border-white/6" style={{ background: "#161820" }}>
              <p className="text-xs text-[#6B7280] mb-2">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.gold ? "" : "text-[#E8EAF0]"}`} style={stat.gold ? { color: "#F5C842" } : {}}>
                {stat.value}
              </p>
              <p className="text-xs text-[#6B7280]/60 mt-0.5">{stat.sublabel}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Content table */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-[#E8EAF0] mb-4">Published Content</h2>
            <div className="rounded-xl border border-white/6 overflow-hidden" style={{ background: "#161820" }}>
              {contentLoading ? (
                <div className="p-6 space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />)}
                </div>
              ) : (byContent?.length ?? 0) === 0 ? (
                <div className="p-8 text-center text-[#6B7280] text-sm">
                  No published content yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/6 text-xs text-[#6B7280]">
                      <th className="text-left px-4 py-3">Title</th>
                      <th className="text-right px-4 py-3">Views</th>
                      <th className="text-right px-4 py-3">Sales</th>
                      <th className="text-right px-4 py-3">Conv.</th>
                      <th className="text-right px-4 py-3">Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byContent?.map(row => (
                      <tr key={row.contentId} className="border-b border-white/4 hover:bg-white/3 transition-colors" data-testid={`row-earnings-${row.contentId}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[#E8EAF0] font-medium truncate max-w-[180px]">{row.title}</span>
                            {row.hasSuggestion && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF] shrink-0" title="AI suggestion available" />
                            )}
                          </div>
                          <span className="text-xs text-[#6B7280]">{row.type}</span>
                        </td>
                        <td className="text-right px-4 py-3 text-[#6B7280]">{row.views}</td>
                        <td className="text-right px-4 py-3 text-[#6B7280]">{row.purchases}</td>
                        <td className="text-right px-4 py-3">
                          <span className={`text-xs font-medium ${row.conversionRate > 15 ? "text-green-400" : row.conversionRate < 3 ? "text-red-400" : "text-[#6B7280]"}`}>
                            {Number(row.conversionRate).toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-right px-4 py-3 font-semibold" style={{ color: "#F5C842" }}>
                          ${Number(row.totalEarned).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Recent payments feed */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-[#E8EAF0]">Recent Payments</h2>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Live" />
            </div>
            <div className="rounded-xl border border-white/6 overflow-hidden" style={{ background: "#161820" }}>
              {(recent?.length ?? 0) === 0 ? (
                <div className="p-6 text-center text-[#6B7280] text-sm">
                  No payments yet. Share your content to start earning.
                </div>
              ) : (
                <div className="divide-y divide-white/4 max-h-80 overflow-y-auto">
                  {recent?.map(payment => (
                    <div key={payment.id} className="px-4 py-3 flex items-center justify-between gap-2" data-testid={`payment-event-${payment.id}`}>
                      <div className="min-w-0">
                        <p className="text-xs text-[#E8EAF0] truncate">{payment.contentTitle}</p>
                        <p className="text-xs text-[#6B7280] mt-0.5">{payment.readerName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold" style={{ color: "#F5C842" }}>+${Number(payment.creatorAmount).toFixed(4)}</p>
                        <p className="text-xs text-[#6B7280]/60">{new Date(payment.paidAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Suggestions */}
        {activeSuggestions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-[#E8EAF0] mb-4">
              AI Pricing Suggestions
              <span className="ml-2 text-xs font-normal text-[#2DD4BF]">{activeSuggestions.length} active</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSuggestions.map(suggestion => (
                <div key={suggestion.id} className="rounded-xl p-5 border border-[#2DD4BF]/15" style={{ background: "#161820" }} data-testid={`ai-suggestion-${suggestion.id}`}>
                  <p className="text-sm font-medium text-[#E8EAF0] mb-1 truncate">{suggestion.contentTitle}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-[#6B7280]">Current: ${Number(suggestion.currentPrice).toFixed(4)}</span>
                    <span className="text-xs text-[#6B7280]">→</span>
                    <span className="text-xs font-semibold" style={{ color: "#F5C842" }}>
                      ${Number(suggestion.suggestedPrice).toFixed(4)}
                    </span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase ${
                      suggestion.action === "raise" ? "bg-green-400/15 text-green-400" :
                      suggestion.action === "lower" ? "bg-red-400/15 text-red-400" :
                      "bg-[#F5C842]/15 text-[#F5C842]"
                    }`}>
                      {suggestion.action}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280] leading-relaxed mb-4">{suggestion.reasoning}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApply(suggestion.id)}
                      disabled={applyAi.isPending}
                      data-testid={`button-apply-suggestion-${suggestion.id}`}
                      className="flex-1 py-2 text-xs font-medium rounded bg-[#F5C842]/15 text-[#F5C842] hover:bg-[#F5C842]/25 transition-colors"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => handleDismiss(suggestion.id)}
                      disabled={dismissAi.isPending}
                      data-testid={`button-dismiss-suggestion-${suggestion.id}`}
                      className="flex-1 py-2 text-xs font-medium rounded bg-white/5 text-[#6B7280] hover:bg-white/10 transition-colors"
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
    </PlatformLayout>
  );
}
