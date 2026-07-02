import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Reveal } from "@/components/Reveal";

type DashboardCard = {
  href: string;
  title: string;
  desc: string;
  color: string;
  adminOnly?: boolean;
};

const CARDS: DashboardCard[] = [
  {
    href: "/wallet",
    title: "Wallet",
    desc: "In-app USDC wallet for unlocking paid content",
    color: "#C8960C",
  },
  {
    href: "__public_profile__",
    title: "Public profile",
    desc: "Your shareable creator page — bio and published works",
    color: "#0D9488",
  },
  {
    href: "/dashboard/following",
    title: "Following",
    desc: "Content from your interests and creators you've supported",
    color: "#1C1917",
  },
  {
    href: "/dashboard/creator",
    title: "Creator",
    desc: "Earnings, sales, and AI pricing suggestions",
    color: "#C8960C",
  },
  {
    href: "/collections",
    title: "Collection",
    desc: "Unlocked pieces and saved bookmarks — read anytime",
    color: "#2DD4BF",
  },
  {
    href: "/settings",
    title: "Settings",
    desc: "Profile, payouts, feed preferences, and account",
    color: "#44403C",
  },
  {
    href: "/rights",
    title: "Rights & Licensing",
    desc: "Film, translation, and adaptation rights for your stories",
    color: "#0D9488",
  },
  {
    href: "/dashboard/intelligence",
    title: "Intelligence",
    desc: "Topics, trends, and what to create next",
    color: "#8B5CF6",
  },
  {
    href: "/dashboard/admin",
    title: "Admin",
    desc: "Platform overview, users, and featured content",
    color: "#78716C",
    adminOnly: true,
  },
];

export default function DashboardOverviewPage() {
  const { data: me } = useGetMe();
  const visible = CARDS.filter(c => !c.adminOnly || me?.isAdmin);

  return (
    <DashboardShell
      title={`Welcome${me?.name ? `, ${me.name.split(" ")[0]}` : ""}`}
      subtitle="Your hub for reading, creating, and platform management"
    >
      <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visible.map(card => {
          const href =
            card.href === "__public_profile__" && me?.clerkId
              ? `/creator/${me.clerkId}`
              : card.href;
          if (card.href === "__public_profile__" && !me?.clerkId) return null;

          return (
          <Link key={card.href} href={href}>
            <article
              className="surface-card h-full p-5"
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(28,25,23,0.12)",
                borderTop: `3px solid ${card.color}`,
                cursor: "pointer",
              }}
            >
              <h2
                className="font-bold mb-2"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.25rem", color: "#1C1917" }}
              >
                {card.title}
              </h2>
              <p className="text-sm" style={{ color: "#57534E", lineHeight: 1.6 }}>{card.desc}</p>
              <span className="inline-block mt-4 text-xs font-semibold" style={{ color: "#C8960C" }}>
                Open →
              </span>
            </article>
          </Link>
          );
        })}
      </Reveal>
    </DashboardShell>
  );
}
