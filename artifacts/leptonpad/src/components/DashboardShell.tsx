import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { PlatformLayout } from "./PlatformLayout";
import { Reveal } from "./Reveal";

type DashboardTab = {
  href: string;
  label: string;
  exact?: boolean;
  adminOnly?: boolean;
};

const TABS: DashboardTab[] = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/following", label: "Following" },
  { href: "/dashboard/creator", label: "Creator" },
  { href: "/earnings", label: "Earnings", exact: true },
  { href: "/collections", label: "Collection", exact: true },
  { href: "/wallet", label: "Wallet", exact: true },
  { href: "/settings", label: "Settings", exact: true },
  { href: "/dashboard/admin", label: "Admin", adminOnly: true },
];

export function DashboardShell({
  title,
  subtitle,
  children,
  showPublish = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Hide the publish CTA (e.g. on Settings). */
  showPublish?: boolean;
}) {
  const [location] = useLocation();
  const { data: me } = useGetMe();

  const visibleTabs = TABS.filter(t => !t.adminOnly || me?.isAdmin);

  return (
    <PlatformLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div
          className={`flex flex-col gap-4 py-6${showPublish ? " sm:flex-row sm:items-end sm:justify-between" : ""}`}
          style={{ borderBottom: "1px solid rgba(28,25,23,0.15)" }}
        >
          <div className="min-w-0">
            <p className="editorial-label mb-1">Dashboard</p>
            <h1 className="homepage-display text-[clamp(1.5rem,4vw,2rem)] font-bold leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="homepage-body mt-1 text-sm">{subtitle}</p>
            )}
          </div>
          {showPublish && (
            <Link
              href="/create"
              className="interactive-cta inline-flex w-full shrink-0 items-center justify-center px-5 py-2.5 text-sm font-semibold sm:w-auto"
              style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}
            >
              ✍ Publish new work
            </Link>
          )}
        </div>

        <nav
          className="flex gap-1 overflow-x-auto py-3 -mx-1 px-1"
          style={{ borderBottom: "1px solid rgba(28,25,23,0.1)" }}
        >
          {visibleTabs.map(tab => {
            const active = tab.exact ? location === tab.href : location.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="dash-tab px-3 py-2 text-sm whitespace-nowrap rounded"
                style={{
                  background: active ? "rgba(28,25,23,0.08)" : "transparent",
                  color: active ? "var(--color-ink)" : "var(--color-ink-muted)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <Reveal delay={100} className="pt-6">{children}</Reveal>
      </div>
    </PlatformLayout>
  );
}
