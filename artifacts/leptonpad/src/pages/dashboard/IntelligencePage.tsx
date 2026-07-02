import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PlatformLayout } from "@/components/PlatformLayout";
import { DashboardShell } from "@/components/DashboardShell";
import { fetchIntelligence } from "@/lib/platformApi";

export default function IntelligencePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["intelligence"],
    queryFn: fetchIntelligence,
  });

  return (
    <PlatformLayout>
      <DashboardShell title="Content Intelligence" subtitle="What should you create next?">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white/5 rounded-xl" />)}
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Pieces", value: data.summary.totalPieces },
                { label: "Views", value: data.summary.totalViews },
                { label: "Purchases", value: data.summary.totalPurchases },
                { label: "Avg conversion", value: `${data.summary.avgConversionRate}%` },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4 border border-white/6" style={{ background: "#161820" }}>
                  <p className="text-xs text-[#6B7280] mb-1">{s.label}</p>
                  <p className="text-xl font-semibold text-[#E8EAF0]">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {data.recommendations.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-[#F5C842] mb-4 uppercase tracking-wider">Recommendations</h2>
                <div className="space-y-3">
                  {data.recommendations.map((rec, i) => (
                    <div key={i} className="rounded-xl p-4 border border-white/6" style={{ background: "#161820" }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded uppercase font-medium"
                          style={{
                            background: rec.priority === "high" ? "rgba(245,200,66,0.15)" : "rgba(255,255,255,0.06)",
                            color: rec.priority === "high" ? "#F5C842" : "#6B7280",
                          }}>
                          {rec.priority}
                        </span>
                        <span className="text-sm font-medium text-[#E8EAF0]">{rec.title}</span>
                      </div>
                      <p className="text-xs text-[#6B7280]">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Rising tags */}
            {data.risingTags.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-[#E8EAF0] mb-4">Rising topics (platform-wide)</h2>
                <div className="flex flex-wrap gap-2">
                  {data.risingTags.map(t => (
                    <Link key={t.tag} href={`/feed?tag=${t.tag}`}
                      className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-[#E8EAF0] hover:border-[#F5C842]/40 transition-colors">
                      {t.tag} <span className="text-[#6B7280]">({t.purchases} sales)</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Content gaps */}
            {data.contentGaps.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-[#E8EAF0] mb-4">Content gaps</h2>
                <div className="space-y-2">
                  {data.contentGaps.map(g => (
                    <div key={g.category} className="flex justify-between text-sm rounded-lg px-4 py-3 border border-white/6" style={{ background: "#161820" }}>
                      <span className="text-[#E8EAF0]">{g.category}</span>
                      <span className="text-[#6B7280]">{g.demand} demand · you have {g.yourPieces}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Top countries (African storytelling angle) */}
            {data.topCountries.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-[#E8EAF0] mb-4">Geographic interest</h2>
                <div className="flex flex-wrap gap-2">
                  {data.topCountries.map(c => (
                    <Link key={c.country} href={`/feed?country=${c.country}`}
                      className="text-xs px-3 py-1.5 rounded border border-white/10 text-[#E8EAF0]">
                      {c.country}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Best publish hours */}
            {data.bestPublishHours.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-[#E8EAF0] mb-4">Best publishing times (UTC)</h2>
                <p className="text-sm text-[#6B7280]">
                  {data.bestPublishHours.map(h => `${h.hour}:00 (${h.purchases} purchases)`).join(" · ")}
                </p>
              </section>
            )}
          </div>
        ) : null}
      </DashboardShell>
    </PlatformLayout>
  );
}
