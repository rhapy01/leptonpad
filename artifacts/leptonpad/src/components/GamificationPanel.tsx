import { useQuery } from "@tanstack/react-query";
import { fetchGamification } from "@/lib/platformApi";
import { useI18n } from "@/lib/i18n";

export function GamificationPanel() {
  const { t } = useI18n();
  const { data } = useQuery({ queryKey: ["gamification"], queryFn: fetchGamification });

  if (!data) return null;

  return (
    <section
      className="rounded-sm border bg-white p-5 sm:p-6"
      style={{ borderColor: "rgba(28,25,23,0.12)" }}
    >
      <h2 className="gamification-title">{t("gamification.badges")}</h2>

      <div className="gamification-stats">
        <div className="gamification-stat">
          <p className="gamification-stat-value gamification-stat-value--gold">{data.streak.currentStreak}</p>
          <p className="gamification-stat-label">{t("gamification.streak")}</p>
        </div>
        <div className="gamification-stat">
          <p className="gamification-stat-value">Lv.{data.streak.writerLevel}</p>
          <p className="gamification-stat-label">{data.streak.xp} XP</p>
        </div>
        <div className="gamification-stat">
          <p className="gamification-stat-value">{data.streak.totalReads}</p>
          <p className="gamification-stat-label">reads</p>
        </div>
      </div>

      <div className="gamification-badges">
        {data.allBadges.map(b => (
          <div
            key={b.slug}
            title={b.description}
            className={`gamification-badge${b.earned ? " gamification-badge--earned" : " gamification-badge--locked"}`}
          >
            <span className="gamification-badge-icon" aria-hidden>
              {b.icon}
            </span>
            <span className="gamification-badge-name">{b.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
