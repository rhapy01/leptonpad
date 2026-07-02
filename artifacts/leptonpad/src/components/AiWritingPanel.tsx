import { useState } from "react";
import { aiSuggestTitles, aiOptimizeSeo, aiImproveText, aiSuggestTags } from "@/lib/platformApi";
import { useToast } from "@/hooks/use-toast";

type Props = {
  title: string;
  body: string;
  category?: string;
  tags: string;
  onTitle: (t: string) => void;
  onBody: (b: string) => void;
  onTags: (t: string) => void;
  onMeta: (m: string) => void;
};

export function AiWritingPanel({ title, body, category, tags, onTitle, onBody, onTags, onMeta }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [titles, setTitles] = useState<string[]>([]);
  const { toast } = useToast();

  const run = async (key: string, fn: () => Promise<void>) => {
    setLoading(key);
    try {
      await fn();
    } catch (e) {
      toast({ title: "AI error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-4 rounded" style={{ background: "rgba(200,150,12,0.06)", border: "1px solid rgba(200,150,12,0.2)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#C8960C" }}>AI Writing Assistant</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <button type="button" disabled={!!loading} onClick={() => run("titles", async () => {
          const r = await aiSuggestTitles(body || title, category);
          setTitles(r.titles);
          toast({ title: r.llm ? "LLM titles" : "Suggested titles" });
        })} className="text-xs px-3 py-1.5 rounded" style={{ border: "1px solid rgba(200,150,12,0.3)", color: "#78716C" }}>
          {loading === "titles" ? "…" : "Title ideas"}
        </button>
        <button type="button" disabled={!!loading} onClick={() => run("seo", async () => {
          const r = await aiOptimizeSeo(title, body, tags.split(",").map(t => t.trim()).filter(Boolean));
          onMeta(r.metaDescription);
          if (r.keywords.length) onTags(r.keywords.join(", "));
          toast({ title: "SEO optimized", description: r.llm ? "via LLM" : "heuristic" });
        })} className="text-xs px-3 py-1.5 rounded" style={{ border: "1px solid rgba(200,150,12,0.3)", color: "#78716C" }}>
          {loading === "seo" ? "…" : "SEO optimize"}
        </button>
        <button type="button" disabled={!!loading || !body} onClick={() => run("grammar", async () => {
          const r = await aiImproveText(body, "grammar");
          onBody(r.text);
          toast({ title: "Grammar improved" });
        })} className="text-xs px-3 py-1.5 rounded" style={{ border: "1px solid rgba(200,150,12,0.3)", color: "#78716C" }}>
          Fix grammar
        </button>
        <button type="button" disabled={!!loading || !body} onClick={() => run("tags", async () => {
          const r = await aiSuggestTags(title, body);
          onTags(r.tags.join(", "));
          toast({ title: "Tags suggested" });
        })} className="text-xs px-3 py-1.5 rounded" style={{ border: "1px solid rgba(200,150,12,0.3)", color: "#78716C" }}>
          Auto-tag
        </button>
        <button type="button" disabled={!!loading || !body} onClick={() => run("summary", async () => {
          const r = await aiImproveText(body, "summarize");
          onMeta(r.text);
          toast({ title: "Preview generated" });
        })} className="text-xs px-3 py-1.5 rounded" style={{ border: "1px solid rgba(200,150,12,0.3)", color: "#78716C" }}>
          Preview teaser
        </button>
      </div>
      {titles.length > 0 && (
        <ul className="space-y-1">
          {titles.map(t => (
            <li key={t}>
              <button type="button" onClick={() => onTitle(t)} className="text-xs text-left hover:underline" style={{ color: "#1C1917" }}>
                → {t}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
