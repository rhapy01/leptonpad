import { useState } from "react";
import { useClerk } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { LiveActivityTicker } from "./LiveActivityTicker";

export function PlatformLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut } = useClerk();
  const { data: user } = useGetMe();

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const navLinks = [
    { href: "/feed", label: "Feed" },
    { href: "/create", label: "Publish" },
    { href: "/earnings", label: "Earnings" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#FAF7F2" }}>
      {/* Editorial masthead header */}
      <header className="sticky top-0 z-50" style={{ background: "#FAF7F2" }}>
        {/* Top bar: logo + nav + user */}
        <div
          className="border-b"
          style={{ borderColor: "rgba(28,25,23,0.15)" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-12">
            {/* Logo */}
            <Link href="/feed" className="flex items-center gap-2 group shrink-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center border"
                style={{ borderColor: "rgba(28,25,23,0.4)" }}
              >
                <span className="text-[#1C1917] text-xs font-bold leading-none" style={{ fontFamily: "Georgia, serif" }}>λ</span>
              </div>
              <span
                className="font-bold tracking-tight text-sm hidden xs:inline"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1917" }}
              >
                LeptonPad
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5">
              {navLinks.map(link => {
                const active = location === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-4 py-2 text-sm transition-colors"
                    style={{
                      color: active ? "#1C1917" : "#78716C",
                      fontWeight: active ? 600 : 400,
                      borderBottom: active ? "2px solid #1C1917" : "2px solid transparent",
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <Link href="/settings" className="hidden sm:flex items-center gap-2 group">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover border" style={{ borderColor: "rgba(28,25,23,0.2)" }} />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#1C1917]/10 border flex items-center justify-center" style={{ borderColor: "rgba(28,25,23,0.2)" }}>
                    <span className="text-xs text-[#78716C]">{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
                  </div>
                )}
                {user?.name && (
                  <span className="text-xs text-[#78716C] hidden lg:inline">{user.name.split(" ")[0]}</span>
                )}
              </Link>
              <button
                onClick={() => signOut({ redirectUrl: basePath || "/" })}
                className="text-xs transition-colors hidden sm:inline"
                style={{ color: "#78716C" }}
                onMouseOver={e => (e.currentTarget.style.color = "#1C1917")}
                onMouseOut={e => (e.currentTarget.style.color = "#78716C")}
              >
                Sign out
              </button>
              {/* Mobile hamburger */}
              <button
                className="md:hidden p-1.5 rounded"
                onClick={() => setMobileMenuOpen(v => !v)}
                aria-label="Toggle menu"
                style={{ color: "#1C1917" }}
              >
                {mobileMenuOpen ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div
            className="md:hidden border-b"
            style={{ background: "#FAF7F2", borderColor: "rgba(28,25,23,0.15)" }}
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2.5 text-sm rounded"
                  style={{
                    color: location === link.href ? "#1C1917" : "#78716C",
                    fontWeight: location === link.href ? 600 : 400,
                    background: location === link.href ? "rgba(28,25,23,0.06)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t mt-2 pt-2 flex items-center justify-between" style={{ borderColor: "rgba(28,25,23,0.1)" }}>
                <Link href="/settings" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2">
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#1C1917]/10 flex items-center justify-center">
                      <span className="text-xs text-[#78716C]">{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
                    </div>
                  )}
                  <span className="text-sm text-[#1C1917]">{user?.name ?? "Settings"}</span>
                </Link>
                <button
                  onClick={() => signOut({ redirectUrl: basePath || "/" })}
                  className="text-xs text-[#78716C]"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Activity Ticker */}
        <LiveActivityTicker />
      </header>

      {/* Content */}
      <main>{children}</main>
    </div>
  );
}
