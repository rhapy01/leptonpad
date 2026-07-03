/** Canonical share URLs and social intents for content pages. */

export function contentShareUrl(contentId: number, origin = window.location.origin): string {
  return `${origin.replace(/\/$/, "")}/content/${contentId}`;
}

export function xShareIntentUrl(contentId: number, title: string, origin = window.location.origin): string {
  const url = contentShareUrl(contentId, origin);
  const params = new URLSearchParams({
    url,
    text: title,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export async function copyContentShareLink(contentId: number): Promise<string> {
  const url = contentShareUrl(contentId);
  await navigator.clipboard.writeText(url);
  return url;
}
