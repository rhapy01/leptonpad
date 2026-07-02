import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetPlatformStats, useListContent, type Content } from "@workspace/api-client-react";
import { SiteHeader } from "@/components/SiteHeader";
import { EditorialCarousel } from "@/components/EditorialCarousel";
import { FeaturedSection } from "@/components/FeaturedSection";
import { HomeMosaic } from "@/components/HomeMosaic";
import { Reveal } from "@/components/Reveal";
import { fetchFeaturedContent } from "@/lib/dashboardApi";

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) return;
    const from = ref.current;
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (target - from) * eased;
      setValue(current);
      ref.current = current;
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    return () => { startRef.current = null; };
  }, [target, duration]);
  return value;
}

export default function HomePage() {
  const { data: stats, isLoading } = useGetPlatformStats({ query: { queryKey: ["platformStats"], refetchInterval: 30_000 } });
  const { data: feed } = useListContent({ limit: 12 });
  const { data: featuredData } = useQuery({
    queryKey: ["content", "featured"],
    queryFn: fetchFeaturedContent,
  });
  const usdcPaid = useCountUp(Number(stats?.totalUsdcPaid ?? 0));
  const items: Content[] = feed?.items ?? [];
  const featuredByType = featuredData ?? { article: null, video: null, audio: null };

  const categories = [
    { name: "Crypto & Web3", desc: "On-chain insights from inside the industry", slug: "crypto-web3" },
    { name: "Music & Audio", desc: "Original recordings, podcasts, and sound", slug: "music-audio" },
    { name: "Independent Writing", desc: "Essays, fiction, journalism, criticism", slug: "independent-writing" },
    { name: "Video & Film", desc: "Short films, documentaries, visual essays", slug: "video-film" },
    { name: "Tech & Development", desc: "Deep technical writing and code", slug: "tech-development" },
  ];

  const editorialSections = [
    {
      label: "For Readers",
      heading: "Pay only for what you actually want.",
      body: "No subscriptions. No bundles. No algorithm deciding what you see. You tell LeptonPad which categories interest you. You see exactly that. You pay only for pieces you choose to unlock.",
    },
    {
      label: "For Creators",
      heading: "Keep 95%. Get paid in seconds.",
      body: "Every sale goes directly to you in USDC. No waiting for payout cycles. No minimum thresholds. No platform taking half. The 5% covers infrastructure. Everything else is yours.",
    },
    {
      label: "The Technology",
      heading: "Settled in under 500 milliseconds on Arc.",
      body: "LeptonPad is built on Arc, Circle's purpose-built blockchain for commerce. The x402 payment protocol makes nanopayments possible — transactions as small as $0.000001, confirmed before the page loads.",
    },
  ];

  return (
    <div className="platform-shell homepage-serif" style={{ minHeight: "100vh" }}>
      <SiteHeader />
      {/* Masthead */}
      <header style={{ borderBottom: "2px solid #1C1917", paddingBottom: "1rem" }}>
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <div className="text-center mb-3">
            <h1 className="homepage-display font-bold tracking-tight" style={{ fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1.05 }}>
              LeptonPad
            </h1>
            <p className="text-xs uppercase tracking-widest mt-2 homepage-body" style={{ letterSpacing: "0.18em", fontWeight: 600 }}>
              Publishing platform · Articles, video &amp; audio
            </p>
          </div>
          <div className="border-t" style={{ borderColor: "#1C1917" }} />
          {/* Date line */}
          <div className="flex items-center justify-between py-2 text-xs flex-wrap gap-y-1 homepage-body" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            <span className="hidden sm:inline">Monday, June 15, 2026</span>
            <span className="flex-1 text-center sm:flex-none homepage-body">Read · Publish · Get paid per piece</span>
            <span className="hidden md:inline">Arc · USDC · Settled instantly</span>
          </div>
          <div className="border-t" style={{ borderColor: "#1C1917" }} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 page-enter">
        <Reveal>
          <FeaturedSection
            byType={featuredByType}
            title="Featured"
            subtitle="One spotlight pick each for articles, video, and audio"
          />
        </Reveal>
        <Reveal delay={80}>
          <HomeMosaic featured={featuredByType} feed={items} />
        </Reveal>

        {/* Categories */}
        <Reveal delay={120}>
        <div style={{ borderTop: "2px solid #1C1917" }} className="pt-2 pb-8">
          <EditorialCarousel title="Browse by category" subtitle="Five topics to explore" autoplay>
            {categories.map(cat => (
              <Link key={cat.name} href="/feed" className="block h-full w-full min-w-0">
                <div
                  className="surface-card h-full min-w-0 p-4"
                  style={{ background: "#FFFFFF", border: "1px solid #BDB9B2", borderTop: "3px solid #1C1917", cursor: "pointer" }}
                >
                  <p className="homepage-display mb-2 text-sm font-bold break-words">{cat.name}</p>
                  <p className="homepage-body text-xs break-words">{cat.desc}</p>
                </div>
              </Link>
            ))}
          </EditorialCarousel>
        </div>
        </Reveal>

        <Reveal delay={160}>
        <div style={{ borderTop: "2px solid #1C1917" }} className="pt-8 pb-2">
          <p className="text-center text-sm mb-6 homepage-body">
            {isLoading ? (
              <span>Loading…</span>
            ) : (
              <span>
                <strong style={{ color: "#B8860B" }}>${usdcPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</strong>
                {" "}paid to creators · <strong style={{ color: "#B8860B" }}>95%</strong> creator share · Arc settlement
              </span>
            )}
          </p>
          <Reveal stagger className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Creator share", value: "95%", sub: "per payment" },
              { label: "Settlement", value: "<500ms", sub: "on Arc" },
              { label: "Min. price", value: "$0.000001", sub: "USDC" },
              { label: "Formats", value: "3", sub: "Article, video, audio" },
            ].map(item => (
              <div key={item.label} className="surface-card p-3" style={{ background: "#FFFFFF", border: "1px solid #D6D1C8" }}>
                <p className="editorial-section-label mb-1">{item.label}</p>
                <p className="text-lg font-bold homepage-display" style={{ color: "#B8860B" }}>{item.value}</p>
                <p className="text-xs homepage-body">{item.sub}</p>
              </div>
            ))}
          </Reveal>
        </div>
        </Reveal>

        <Reveal delay={200}>
        <div style={{ borderTop: "2px solid #1C1917" }} className="py-4">
          <div className="hidden md:grid md:grid-cols-3 gap-0">
            {editorialSections.map((section, i) => (
              <div
                key={section.label}
                className="py-8 px-0"
                style={{
                  paddingLeft: i === 0 ? 0 : "2rem",
                  paddingRight: i === 2 ? 0 : "2rem",
                  borderRight: i < 2 ? "1px solid #BDB9B2" : "none",
                }}
              >
                <span className="editorial-section-label">{section.label}</span>
                <div className="editorial-rule mt-1 mb-4" />
                <h3 className="font-bold mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.25rem", lineHeight: 1.3 }}>
                  {section.heading}
                </h3>
                <p className="text-sm homepage-body">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
          <div className="md:hidden">
            <EditorialCarousel title="Why LeptonPad" slideClassName="w-[92%] basis-[92%] sm:w-[72%] sm:basis-[72%]" autoplay>
              {editorialSections.map(section => (
                <div key={section.label} className="h-full w-full min-w-0 p-5" style={{ background: "#FFFFFF", border: "1px solid #BDB9B2" }}>
                  <span className="editorial-section-label">{section.label}</span>
                  <div className="editorial-rule mt-1 mb-3" />
                  <h3 className="mb-2 font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.1rem" }}>
                    {section.heading}
                  </h3>
                  <p className="homepage-body text-sm break-words" style={{ lineHeight: 1.75 }}>{section.body}</p>
                </div>
              ))}
            </EditorialCarousel>
          </div>
        </div>
        </Reveal>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "2px solid #1C1917", background: "#ffffff" }}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <p className="font-bold text-xl mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>LeptonPad</p>
              <p className="text-xs leading-relaxed homepage-body" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Publish anything. Get paid per piece. Keep 95%.
              </p>
            </div>
            {[
              { heading: "Platform", links: [{ label: "Home", href: "/" }, { label: "Feed", href: "/feed" }] },
              { heading: "Creators", links: [{ label: "Start publishing", href: "/sign-up" }, { label: "Dashboard", href: "/dashboard" }] },
              { heading: "Resources", links: [{ label: "Get USDC", href: "https://faucet.circle.com/", external: true as const }, { label: "About Arc", href: "https://docs.arc.io/", external: true as const }] },
            ].map(col => (
              <div key={col.heading}>
                <p className="editorial-section-label mb-3">
                  {col.heading}
                </p>
                <div className="space-y-1.5" style={{ borderLeft: "1px solid #BDB9B2", paddingLeft: "0.75rem" }}>
                  {col.links.map(link => (
                    "external" in link && link.external ? (
                      <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="block text-xs homepage-body hover:opacity-80 transition-opacity" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        {link.label}
                      </a>
                    ) : (
                      <Link key={link.label} href={link.href} className="block text-xs homepage-body hover:opacity-80 transition-opacity" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        {link.label}
                      </Link>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #BDB9B2", marginTop: "2rem", paddingTop: "1rem" }}>
            <p className="text-xs text-center homepage-body" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              © 2026 LeptonPad · Pay-per-piece publishing · Arc · USDC
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
