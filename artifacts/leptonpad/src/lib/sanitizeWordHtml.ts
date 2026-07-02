/** Strip Microsoft Word / Google Docs paste cruft while keeping structure. */
export function sanitizePastedHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[if[\s\S]*?<!\[endif\]>/gi, "")
    .replace(/<\/?o:[^>]+>/gi, "")
    .replace(/<\/?w:[^>]+>/gi, "")
    .replace(/<\/?m:[^>]+>/gi, "")
    .replace(/\s*mso-[^:]+:[^;"']+;?/gi, "")
    .replace(/\s*class="Mso[^"]*"/gi, "")
    .replace(/<meta[^>]*>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<font[^>]*>/gi, "")
    .replace(/<\/font>/gi, "")
    .replace(/\s*style=""/gi, "")
    .replace(/<span[^>]*>\s*<\/span>/gi, "")
    .replace(/&nbsp;/g, " ");
}
