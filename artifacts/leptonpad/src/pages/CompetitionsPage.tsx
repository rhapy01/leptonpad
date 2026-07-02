import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PlatformLayout } from "@/components/PlatformLayout";
import { fetchCompetitions } from "@/lib/platformApi";
import { useI18n } from "@/lib/i18n";

export default function CompetitionsPage() {
  const { t } = useI18n();
  const { data: competitions = [], isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: fetchCompetitions,
  });

  return (
    <PlatformLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <p className="editorial-label mb-2" style={{ color: "#78716C" }}>LeptonPad · Writing Competitions</p>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "2rem", fontWeight: 700, color: "#1C1917", marginBottom: "8px" }}>
          {t("competitions.title")}
        </h1>
        <p className="text-sm mb-8" style={{ color: "#78716C" }}>
          Themed writing challenges and literary competitions on LeptonPad.
        </p>

        {isLoading ? (
          <div className="animate-pulse space-y-4">{[1, 2].map(i => <div key={i} className="h-32 bg-black/5 rounded" />)}</div>
        ) : (
          <div className="space-y-6">
            {competitions.map(c => (
              <Link key={c.id} href={`/competitions/${c.slug}`} className="block p-6 rounded transition-shadow hover:shadow-md"
                style={{ background: "#fff", border: "1px solid rgba(28,25,23,0.12)" }}>
                <div className="flex gap-4">
                  {c.coverImageUrl && (
                    <img src={c.coverImageUrl} alt="" className="w-24 h-24 object-cover rounded shrink-0 hidden sm:block" />
                  )}
                  <div>
                    <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1917" }}>
                      {c.title}
                    </h2>
                    <p className="text-xs mb-2" style={{ color: "#C8960C" }}>Theme: {c.theme}</p>
                    <p className="text-sm mb-2 line-clamp-2" style={{ color: "#57534E" }}>{c.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs" style={{ color: "#78716C" }}>
                      {c.region && <span>📍 {c.region}</span>}
                      <span>Deadline: {new Date(c.deadline).toLocaleDateString()}</span>
                      {c.prizeDescription && <span>🏆 {c.prizeDescription}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PlatformLayout>
  );
}
