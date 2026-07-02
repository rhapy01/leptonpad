import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardShell } from "@/components/DashboardShell";
import { CreatorName } from "@/components/CreatorName";
import { fetchFollowingFeed } from "@/lib/dashboardApi";

export default function FollowingDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "following"],
    queryFn: fetchFollowingFeed,
  });

  return (
    <DashboardShell
      title="Following"
      subtitle="Based on your category interests and creators you've purchased from"
    >
      {isLoading && <p style={{ color: "#78716C" }}>Loading your feed…</p>}
      {error && <p style={{ color: "#B91C1C" }}>Could not load feed.</p>}

      {data && (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {data.categories.map(slug => (
              <span
                key={slug}
                className="text-xs px-2 py-1 rounded"
                style={{ background: "rgba(28,25,23,0.06)", color: "#57534E" }}
              >
                {slug}
              </span>
            ))}
            {data.categories.length === 0 && (
              <p className="text-sm" style={{ color: "#78716C" }}>
                No categories selected —{" "}
                <Link href="/settings" className="underline" style={{ color: "#C8960C" }}>
                  update interests
                </Link>
              </p>
            )}
          </div>

          {data.items.length === 0 ? (
            <p style={{ color: "#78716C" }}>No content yet. Browse the <Link href="/feed" className="underline">feed</Link>.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.items.map(item => (
                <Link key={item.id} href={`/content/${item.id}`}>
                  <article
                    className="p-4 h-full transition-shadow hover:shadow-md"
                    style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.12)", cursor: "pointer" }}
                  >
                    <p className="editorial-label mb-1" style={{ color: "#78716C" }}>
                      {item.categorySlug} · {item.type}
                      {item.featured && " · Featured"}
                    </p>
                    <h3
                      className="font-bold mb-2 line-clamp-2"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.1rem" }}
                    >
                      {item.title}
                    </h3>
                    {item.previewText && (
                      <p className="text-xs line-clamp-2 mb-2" style={{ color: "#57534E" }}>{item.previewText}</p>
                    )}
                    <CreatorName
                      name={item.creatorName}
                      verified={item.creatorVerified}
                      className="text-xs mb-2"
                      style={{ color: "#78716C" }}
                    />
                    <span className="text-sm font-bold" style={{ color: "#C8960C" }}>
                      {Number(item.price) === 0 ? "Free" : `$${Number(item.price).toFixed(2)}`}
                    </span>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
