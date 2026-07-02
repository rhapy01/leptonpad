import { SiteHeader } from "./SiteHeader";

export function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="platform-shell min-h-screen">
      <SiteHeader />
      <main className="page-enter">{children}</main>
    </div>
  );
}
