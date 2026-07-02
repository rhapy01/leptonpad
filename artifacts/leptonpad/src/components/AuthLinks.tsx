import { Link } from "wouter";
import type { CSSProperties, ReactNode } from "react";

type AuthLinkProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  /** After sign-in/up, return here (Clerk `redirect_url`). */
  returnTo?: string;
};

function withRedirect(href: string, returnTo?: string) {
  if (!returnTo) return href;
  const params = new URLSearchParams({ redirect_url: returnTo });
  return `${href}?${params.toString()}`;
}

/** Full-page sign-in — avoids broken mobile modals. */
export function SignInLink({ children, className, style, onClick, returnTo }: AuthLinkProps) {
  return (
    <Link href={withRedirect("/sign-in", returnTo)} className={className} style={style} onClick={onClick}>
      {children}
    </Link>
  );
}

/** Full-page sign-up — avoids broken mobile modals. */
export function SignUpLink({ children, className, style, onClick, returnTo }: AuthLinkProps) {
  return (
    <Link href={withRedirect("/sign-up", returnTo)} className={className} style={style} onClick={onClick}>
      {children}
    </Link>
  );
}
