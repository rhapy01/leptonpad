import { useEffect } from "react";

type SeoMeta = {
  title: string;
  description: string;
  canonicalUrl?: string;
  image?: string | null;
};

export function SeoHead({ meta }: { meta: SeoMeta | null }) {
  useEffect(() => {
    if (!meta) return;
    document.title = `${meta.title} | LeptonPad`;

    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    setMeta("description", meta.description);
    setMeta("og:title", meta.title, true);
    setMeta("og:description", meta.description, true);
    setMeta("og:type", "article", true);
    setMeta("og:site_name", "LeptonPad", true);
    if (meta.canonicalUrl) setMeta("og:url", meta.canonicalUrl, true);
    if (meta.image) {
      setMeta("og:image", meta.image, true);
      setMeta("og:image:secure_url", meta.image, true);
      setMeta("twitter:image", meta.image);
    }
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", meta.title);
    setMeta("twitter:description", meta.description);

    if (meta.canonicalUrl) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = meta.canonicalUrl;
    }

    return () => {
      document.title = "LeptonPad";
    };
  }, [meta]);

  return null;
}
