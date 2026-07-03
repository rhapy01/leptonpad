const CRAWLER_UA =
  /bot|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|googlebot|bingpreview|pinterest|embedly|quora link preview|vkshare|w3c_validator|redditbot/i;

export const config = {
  matcher: ["/content/:path*", "/read/:path*"],
};

/** Send social crawlers to the server-rendered OG card (internal fetch fails on Vercel edge). */
export default function middleware(request) {
  const ua = request.headers.get("user-agent") ?? "";
  if (!CRAWLER_UA.test(ua)) return;

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/(content|read)\/(\d+)\/?$/);
  if (!match) return;

  const cardUrl = new URL(`/api/seo/content/${match[2]}/card`, url.origin);
  return Response.redirect(cardUrl, 307);
}
