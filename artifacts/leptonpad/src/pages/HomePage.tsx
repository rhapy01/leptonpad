import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { useGetPlatformStats } from "@workspace/api-client-react";

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
  const usdcPaid = useCountUp(Number(stats?.totalUsdcPaid ?? 0));

  return (
    <div className="homepage-serif" style={{ background: "#F7F3EC", color: "#1C1917", minHeight: "100vh" }}>
      {/* Masthead */}
      <header style={{ borderBottom: "2px solid #1C1917", paddingBottom: "1rem" }}>
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <div className="text-center mb-3">
            <h1 className="homepage-serif font-bold tracking-tight" style={{ fontSize: "clamp(2.8rem, 7vw, 5.5rem)", fontFamily: "'Playfair Display', 'Times New Roman', Georgia, serif", lineHeight: 1, color: "#1C1917" }}>
              LeptonPad
            </h1>
            <p className="text-xs uppercase tracking-widest mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#78716C", letterSpacing: "0.25em" }}>
              Publish anything &nbsp;·&nbsp; Get paid per piece &nbsp;·&nbsp; Keep 95%
            </p>
          </div>
          <div className="border-t" style={{ borderColor: "#1C1917" }} />
          {/* Date line */}
          <div className="flex items-center justify-between py-2 text-xs" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#78716C" }}>
            <span>Monday, June 15, 2026</span>
            <span>Est. for creators who deserve to be paid</span>
            <span>Arc · USDC · Settled instantly</span>
          </div>
          <div className="border-t" style={{ borderColor: "#1C1917" }} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6">
        {/* Hero grid — newspaper layout */}
        <div className="py-8">
          {/* Live counter — editorial dateline */}
          <div className="text-center mb-6">
            <p className="text-sm" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#78716C", fontStyle: "italic" }}>
              {isLoading ? (
                <span>Loading platform statistics...</span>
              ) : (
                <span>
                  <strong style={{ color: "#D4A117" }}>${usdcPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</strong>
                  {" "}paid to creators since June 15, 2026
                </span>
              )}
            </p>
          </div>

          {/* Main editorial grid */}
          <div className="grid grid-cols-12 gap-0" style={{ borderTop: "2px solid #1C1917" }}>
            {/* Wide primary column */}
            <div className="col-span-12 md:col-span-8 py-8 pr-0 md:pr-8" style={{ borderRight: "1px solid #BDB9B2" }}>
              <div className="mb-2">
                <span className="editorial-section-label">Publish &amp; Earn</span>
                <div className="editorial-rule mt-1 mb-4" />
              </div>

              <h2 className="font-bold leading-tight mb-4" style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
                lineHeight: 1.1,
                color: "#1C1917"
              }}>
                The publishing platform where every piece is its own transaction.
              </h2>

              <p className="text-base leading-relaxed mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#44403C", lineHeight: 1.75 }}>
                Readers pay only for what they actually want. Creators keep <strong style={{ color: "#D4A117" }}>95%</strong> of every payment, deposited instantly in USDC. Nothing is bundled into subscriptions. The smallest payment is $0.000001. Settlement takes under 500 milliseconds on Arc.
              </p>

              <div className="flex items-center gap-4">
                <Link href="/sign-up">
                  <button
                    data-testid="button-start-publishing"
                    className="px-8 py-3 text-sm font-semibold transition-all hover:bg-[#1C1917] hover:text-[#F7F3EC]"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      border: "1.5px solid #1C1917",
                      color: "#1C1917",
                      background: "#F7F3EC",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Start Publishing
                  </button>
                </Link>
                <Link href="/sign-up">
                  <button
                    data-testid="button-start-reading"
                    className="px-8 py-3 text-sm font-semibold transition-all hover:bg-[#F7F3EC]"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      border: "1.5px solid #1C1917",
                      color: "#F7F3EC",
                      background: "#1C1917",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Start Reading
                  </button>
                </Link>
              </div>
            </div>

            {/* Narrow secondary column */}
            <div className="col-span-12 md:col-span-4 py-8 pl-0 md:pl-8">
              <div className="mb-2">
                <span className="editorial-section-label">Platform Numbers</span>
                <div className="editorial-rule mt-1 mb-4" />
              </div>
              <div className="space-y-5">
                {[
                  { label: "Creator share", value: "95%", sub: "of every payment" },
                  { label: "Settlement time", value: "<500ms", sub: "on Arc blockchain" },
                  { label: "Minimum price", value: "$0.000001", sub: "USDC per piece" },
                  { label: "Content types", value: "3", sub: "Article, Audio, Video" },
                ].map(item => (
                  <div key={item.label} style={{ borderBottom: "1px solid #D6D1C8", paddingBottom: "1rem" }}>
                    <p className="text-xs uppercase tracking-wider mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#78716C", letterSpacing: "0.12em" }}>{item.label}</p>
                    <p className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: item.label === "Creator share" || item.label === "Minimum price" ? "#D4A117" : "#1C1917" }}>
                      {item.value}
                    </p>
                    <p className="text-xs" style={{ color: "#78716C" }}>{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Three editorial sections */}
        <div style={{ borderTop: "2px solid #1C1917" }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            {[
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
            ].map((section, i) => (
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
                <h3 className="font-bold mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.25rem", lineHeight: 1.3, color: "#1C1917" }}>
                  {section.heading}
                </h3>
                <p className="text-sm leading-relaxed" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#44403C", lineHeight: 1.8 }}>
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Categories grid */}
        <div style={{ borderTop: "2px solid #1C1917" }} className="py-8">
          <div className="mb-2">
            <span className="editorial-section-label">Five Categories</span>
            <div className="editorial-rule mt-1 mb-6" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { name: "Crypto & Web3", desc: "On-chain insights from inside the industry" },
              { name: "Music & Audio", desc: "Original recordings, podcasts, and sound" },
              { name: "Independent Writing", desc: "Essays, fiction, journalism, criticism" },
              { name: "Video & Film", desc: "Short films, documentaries, visual essays" },
              { name: "Tech & Development", desc: "Deep technical writing and code" },
            ].map(cat => (
              <div key={cat.name} style={{ borderTop: "2px solid #1C1917", paddingTop: "0.75rem" }}>
                <p className="font-bold text-sm mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{cat.name}</p>
                <p className="text-xs leading-relaxed" style={{ color: "#78716C", fontFamily: "'Playfair Display', Georgia, serif" }}>{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Two-column preview */}
        <div style={{ borderTop: "2px solid #1C1917" }} className="py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Creator dashboard preview */}
            <div className="pb-8 pr-0 md:pr-8" style={{ borderRight: "1px solid #BDB9B2" }}>
              <span className="editorial-section-label">Creator Experience</span>
              <div className="editorial-rule mt-1 mb-4" />
              <div className="p-5 rounded" style={{ background: "#0D0F14", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs mb-4" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>Earnings Dashboard</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded" style={{ background: "#161820" }}>
                    <p className="text-xs mb-1" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>Total Earned</p>
                    <p className="text-xl font-bold" style={{ color: "#F5C842", fontFamily: "Inter, sans-serif" }}>$247.83</p>
                  </div>
                  <div className="p-3 rounded" style={{ background: "#161820" }}>
                    <p className="text-xs mb-1" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>This Week</p>
                    <p className="text-xl font-bold" style={{ color: "#F5C842", fontFamily: "Inter, sans-serif" }}>$41.20</p>
                  </div>
                </div>
                <div className="flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.75rem" }}>
                  <span className="text-xs" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>12 purchases today</span>
                  <span className="text-xs" style={{ color: "#2DD4BF", fontFamily: "Inter, sans-serif" }}>● Live</span>
                </div>
              </div>
            </div>

            {/* Reading mode preview */}
            <div className="pb-8 pl-0 md:pl-8">
              <span className="editorial-section-label">Reading Experience</span>
              <div className="editorial-rule mt-1 mb-4" />
              <div className="p-5 rounded" style={{ background: "#FAF7F2", border: "1px solid #E7E3DC" }}>
                <div className="flex items-center justify-between mb-4" style={{ borderBottom: "1px solid #E7E3DC", paddingBottom: "0.75rem" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#F5C842" }} />
                    <span className="text-xs" style={{ color: "#78716C", fontFamily: "'Lora', Georgia, serif" }}>Reading Mode</span>
                  </div>
                  <span className="text-xs" style={{ color: "#78716C", fontFamily: "'Lora', Georgia, serif" }}>Exit</span>
                </div>
                <p className="font-bold mb-2" style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "1.1rem", color: "#1C1917", lineHeight: 1.3 }}>
                  The craft of writing in the age of instant payment
                </p>
                <p className="text-sm leading-relaxed" style={{ fontFamily: "'Lora', Georgia, serif", color: "#44403C", lineHeight: 1.8 }}>
                  "There is something quietly radical about being paid the moment someone reads your words. No intermediary. No waiting. The money moves before the last paragraph..."
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "2px solid #1C1917", background: "#F7F3EC" }}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <p className="font-bold text-xl mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>LeptonPad</p>
              <p className="text-xs leading-relaxed" style={{ color: "#78716C", fontFamily: "'Playfair Display', Georgia, serif" }}>
                Publish anything. Get paid per piece. Keep 95%.
              </p>
            </div>
            {[
              { heading: "Platform", links: ["Feed", "Create", "Earnings"] },
              { heading: "Creators", links: ["Start Publishing", "Pricing", "Payouts"] },
              { heading: "Legal", links: ["Terms", "Privacy", "Arc Network"] },
            ].map(col => (
              <div key={col.heading}>
                <p className="text-xs uppercase tracking-widest mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#78716C", letterSpacing: "0.15em" }}>
                  {col.heading}
                </p>
                <div className="space-y-1.5" style={{ borderLeft: "1px solid #BDB9B2", paddingLeft: "0.75rem" }}>
                  {col.links.map(link => (
                    <p key={link} className="text-xs cursor-pointer hover:text-[#1C1917] transition-colors" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#78716C" }}>
                      {link}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #BDB9B2", marginTop: "2rem", paddingTop: "1rem" }}>
            <p className="text-xs text-center" style={{ color: "#78716C", fontFamily: "'Playfair Display', Georgia, serif" }}>
              © 2026 LeptonPad · Built on Arc · Powered by Circle USDC · Submitted to the Lepton Agents Hackathon
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
