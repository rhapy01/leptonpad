import type { ReactNode } from "react";
import { FocusPageLayout } from "@/components/FocusPageLayout";

/** Sign-in / sign-up — no site header, centered Clerk form. */
export function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <FocusPageLayout>
      <div
        className="cl-auth-page w-full rounded-sm border bg-white p-5 sm:p-6"
        style={{ borderColor: "rgba(28,25,23,0.12)" }}
      >
        {children}
      </div>
    </FocusPageLayout>
  );
}
