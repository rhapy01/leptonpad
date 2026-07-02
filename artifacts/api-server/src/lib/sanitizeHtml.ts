import sanitizeHtml from "sanitize-html";

const ARTICLE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4",
    "ul", "ol", "li", "blockquote", "hr", "a", "img", "code", "pre", "span", "div",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    span: ["style"],
    div: ["style"],
    p: ["style"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
  allowProtocolRelative: false,
};

const NEWSLETTER_OPTIONS: sanitizeHtml.IOptions = {
  ...ARTICLE_OPTIONS,
  allowedTags: [...(ARTICLE_OPTIONS.allowedTags ?? []), "h1", "h2", "h3"],
};

export const MAX_CONTENT_BODY_LENGTH = 500_000;
export const MAX_COMMENT_LENGTH = 4_000;
export const MAX_NEWSLETTER_BODY_LENGTH = 200_000;

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, ARTICLE_OPTIONS).trim();
}

export function sanitizeNewsletterHtml(html: string): string {
  return sanitizeHtml(html, NEWSLETTER_OPTIONS).trim();
}

export function assertMaxLength(value: string, max: number, field: string): void {
  if (value.length > max) {
    throw new Error(`${field} exceeds maximum length of ${max} characters`);
  }
}
