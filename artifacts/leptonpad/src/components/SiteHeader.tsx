import { useState } from "react";
import { useAuth, useClerk } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { LiveActivityTicker } from "@/components/LiveActivityTicker";
import { MobileMenuButton } from "@/components/MobileMenuButton";
import { CreatorName } from "@/components/CreatorName";
import { NotificationsBell } from "@/components/NotificationsBell";
import { SignInLink, SignUpLink } from "@/components/AuthLinks";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { isNavLinkActive, SITE_NAV_LINKS } from "@/lib/siteNav";

type SiteHeaderProps = {
  showTicker?: boolean;
};

/** Unified app header — same navigation for guests and signed-in users */
export function SiteHeader({ showTicker = true }: SiteHeaderProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { data: user } = useGetMe();
  const { t } = useI18n();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const bg = "#ffffff";
  const border = "rgba(28,25,23,0.12)";
  const mutedColor = "var(--color-ink-muted)";
  const activeColor = "var(--color-ink)";

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50" style={{ background: bg }}>
      <div className="border-b" style={{ borderColor: border }}>
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full border"
              style={{ borderColor: "rgba(28,25,23,0.4)" }}
            >
              <span className="text-xs font-bold leading-none" style={{ fontFamily: "Georgia, serif", color: activeColor }}>λ</span>
            </div>
            <span
              className="hidden text-sm font-bold sm:inline"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: activeColor }}
            >
              LeptonPad
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {SITE_NAV_LINKS.map(link => {
              const active = isNavLinkActive(location, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="nav-link whitespace-nowrap px-3 py-2 text-sm lg:px-4"
                  style={{
                    color: active ? activeColor : mutedColor,
                    fontWeight: active ? 600 : 400,
                    borderBottom: active ? `2px solid ${activeColor}` : "2px solid transparent",
                  }}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>

            {isSignedIn ? (
              <>
                <NotificationsBell />
                <Link href="/dashboard" className="hidden items-center gap-2 sm:flex" aria-label="Your dashboard">
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt={user.name ?? ""} className="h-7 w-7 rounded-full border object-cover" style={{ borderColor: border }} />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border" style={{ borderColor: border, background: "rgba(28,25,23,0.08)" }}>
                      <span className="text-xs" style={{ color: mutedColor }}>{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
                    </div>
                  )}
                  {user?.name && (
                    <span className="hidden items-center gap-1 text-xs lg:inline" style={{ color: mutedColor }}>
                      <CreatorName name={user.name.split(" ")[0]} verified={user.verified} size="sm" />
                    </span>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ redirectUrl: basePath || "/" })}
                  className="hidden text-xs sm:inline"
                  style={{ color: mutedColor }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <SignInLink className="px-2 py-1.5 text-xs font-medium" style={{ color: mutedColor }}>
                  Sign in
                </SignInLink>
                <SignUpLink
                  className="px-2 py-1.5 text-xs font-semibold"
                  style={{ color: activeColor, border: `1px solid ${activeColor}`, background: "transparent" }}
                >
                  Sign up
                </SignUpLink>
              </div>
            )}

            <MobileMenuButton
              open={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(v => !v)}
              className="md:hidden"
              style={{ color: activeColor }}
            />
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-b md:hidden" style={{ background: bg, borderColor: border }}>
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {SITE_NAV_LINKS.map(link => {
              const active = isNavLinkActive(location, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className="rounded px-3 py-2.5 text-sm"
                  style={{
                    color: active ? activeColor : mutedColor,
                    fontWeight: active ? 600 : 400,
                    background: active ? "rgba(28,25,23,0.06)" : "transparent",
                  }}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}

            {isSignedIn && (
              <Link
                href="/dashboard"
                onClick={closeMenu}
                className="rounded px-3 py-2.5 text-sm md:hidden"
                style={{
                  color: isNavLinkActive(location, "/dashboard") ? activeColor : mutedColor,
                  fontWeight: isNavLinkActive(location, "/dashboard") ? 600 : 400,
                  background: isNavLinkActive(location, "/dashboard") ? "rgba(28,25,23,0.06)" : "transparent",
                }}
              >
                {t("nav.dashboard")}
              </Link>
            )}

            <div className="px-3 py-2 sm:hidden">
              <LanguageSwitcher />
            </div>

            <div className="mt-2 border-t pt-2 md:hidden" style={{ borderColor: "rgba(28,25,23,0.1)" }}>
              {isSignedIn ? (
                <div className="flex flex-col gap-2 px-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link href="/dashboard" onClick={closeMenu} className="flex items-center gap-2 min-w-0">
                      {user?.imageUrl ? (
                        <img src={user.imageUrl} alt={user.name ?? ""} className="h-7 w-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(28,25,23,0.08)" }}>
                          <span className="text-xs" style={{ color: mutedColor }}>{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
                        </div>
                      )}
                      <span className="text-sm truncate" style={{ color: activeColor }}>{user?.name ?? "Dashboard"}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        signOut({ redirectUrl: basePath || "/" });
                      }}
                      className="text-xs shrink-0"
                      style={{ color: mutedColor }}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <SignInLink
                    onClick={closeMenu}
                    className="flex-1 rounded px-3 py-2 text-center text-sm font-medium"
                    style={{ color: mutedColor, border: `1px solid ${border}` }}
                  >
                    Sign in
                  </SignInLink>
                  <SignUpLink
                    onClick={closeMenu}
                    className="flex-1 rounded px-3 py-2 text-center text-sm font-semibold"
                    style={{ color: activeColor, border: `1px solid ${activeColor}`, background: "transparent" }}
                  >
                    Sign up
                  </SignUpLink>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTicker && <LiveActivityTicker />}
    </header>
  );
}
