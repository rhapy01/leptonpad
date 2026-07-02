import { Link } from "wouter";
import { SignInLink, SignUpLink } from "@/components/AuthLinks";
import { Show } from "@clerk/react";
import { PlatformLayout } from "@/components/PlatformLayout";

/** Keeps guests in the app — sign in only when they need account features */
export function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <PlatformLayout>
          <div className="mx-auto max-w-lg px-4 py-20 text-center">
            <p className="editorial-label mb-3" style={{ color: "#78716C" }}>Account required</p>
            <h1
              className="mb-4"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "#1C1917",
                lineHeight: 1.3,
              }}
            >
              Sign in to use this feature
            </h1>
            <p className="mb-8 text-sm leading-relaxed" style={{ color: "#57534E" }}>
              Browse the feed and read free articles anytime — no account needed.
              Sign in when you want to publish, unlock paid work, or manage your dashboard.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <SignUpLink
                className="w-full px-8 py-3 text-sm font-semibold sm:w-auto"
                style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}
              >
                Create free account
              </SignUpLink>
              <SignInLink
                className="w-full px-8 py-3 text-sm font-medium sm:w-auto"
                style={{ color: "#78716C", border: "1px solid rgba(28,25,23,0.2)", borderRadius: "2px" }}
              >
                Sign in
              </SignInLink>
            </div>
            <Link href="/feed" className="mt-8 inline-block text-sm" style={{ color: "#C8960C" }}>
              ← Keep browsing the feed
            </Link>
          </div>
        </PlatformLayout>
      </Show>
    </>
  );
}
