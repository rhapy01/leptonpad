import { Link } from "wouter";
import type { ReactNode } from "react";

type FocusPageLayoutProps = {
  children: ReactNode;
  /** Wider content area (onboarding). */
  wide?: boolean;
  backHref?: string;
  backLabel?: string;
};

/** Minimal full-screen shell — no site nav or masthead (auth, onboarding). */
export function FocusPageLayout({
  children,
  wide = false,
  backHref = "/",
  backLabel = "← Back to homepage",
}: FocusPageLayoutProps) {
  return (
    <div
      className="platform-shell homepage-serif flex min-h-[100dvh] flex-col overflow-y-auto"
    >
      <main
        className="flex w-full flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12 page-enter"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>{children}</div>
        <p className="homepage-body mt-8 text-center text-sm" style={{ color: "#57534E" }}>
          <Link href={backHref} className="underline-offset-2 hover:underline" style={{ color: "#44403C" }}>
            {backLabel}
          </Link>
        </p>
      </main>
    </div>
  );
}
