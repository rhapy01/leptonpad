import DOMPurify from "dompurify";

const ARTICLE_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4",
    "ul", "ol", "li", "blockquote", "hr", "a", "img", "code", "pre", "span", "div",
  ],
  ALLOWED_ATTR: ["href", "title", "target", "rel", "src", "alt", "width", "height", "style"],
  ALLOWED_URI_REGEXP: /^https?:\/\//i,
};

export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, ARTICLE_CONFIG);
}
