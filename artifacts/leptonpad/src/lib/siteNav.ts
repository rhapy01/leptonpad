/** Public site navigation — personal tools are not listed here. */
export const SITE_NAV_HREFS = ["/", "/feed", "/collections"] as const;

export type SiteNavHref = (typeof SITE_NAV_HREFS)[number];

export const SITE_NAV_LINKS: { href: SiteNavHref; labelKey: string }[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/feed", labelKey: "nav.feed" },
  { href: "/collections", labelKey: "nav.collection" },
];

export function isNavLinkActive(location: string, href: string): boolean {
  return location === href || (href !== "/" && location.startsWith(href));
}
