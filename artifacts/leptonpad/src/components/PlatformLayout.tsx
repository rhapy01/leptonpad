import { useClerk } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";

export function PlatformLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { data: user } = useGetMe();

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const navLinks = [
    { href: "/feed", label: "Feed" },
    { href: "/create", label: "Create" },
    { href: "/earnings", label: "Earnings" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#0D0F14" }}>
      {/* Top nav */}
      <header className="border-b border-white/8 sticky top-0 z-50" style={{ background: "#0D0F14" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/feed" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-full border border-[#F5C842]/60 flex items-center justify-center">
              <span className="font-serif text-[#F5C842] text-sm font-bold leading-none" style={{ fontFamily: "Georgia, serif" }}>λ</span>
            </div>
            <span className="font-semibold text-[#E8EAF0] tracking-tight text-sm">LeptonPad</span>
          </Link>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  location === link.href
                    ? "text-[#E8EAF0] bg-white/8"
                    : "text-[#6B7280] hover:text-[#E8EAF0] hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link href="/settings">
              <div className="flex items-center gap-2 cursor-pointer group">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#161820] border border-white/10 flex items-center justify-center">
                    <span className="text-xs text-[#6B7280]">{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
                  </div>
                )}
              </div>
            </Link>
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="text-xs text-[#6B7280] hover:text-[#E8EAF0] transition-colors"
              data-testid="button-sign-out"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main>{children}</main>
    </div>
  );
}
