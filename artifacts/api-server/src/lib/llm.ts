/**
 * LLM integration — OpenAI-compatible API with heuristic fallback.
 * Set OPENAI_API_KEY and optionally OPENAI_BASE_URL / OPENAI_MODEL in .env
 */

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function chatCompletion(messages: ChatMessage[], maxTokens = 800): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

export async function suggestTitles(body: string, category?: string): Promise<string[]> {
  const llm = await chatCompletion([
    { role: "system", content: "You suggest compelling article titles for a publishing platform. Return exactly 5 titles, one per line, no numbering." },
    { role: "user", content: `Category: ${category ?? "general"}\n\nContent excerpt:\n${body.slice(0, 2000)}` },
  ]);
  if (llm) return llm.split("\n").map(l => l.replace(/^\d+[\.\)]\s*/, "").trim()).filter(Boolean).slice(0, 5);

  const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(w => w.length > 4).slice(0, 8);
  const topic = words.slice(0, 3).join(" ") || "Your Story";
  return [
    `${topic}: What Readers Need to Know`,
    `Inside ${topic}`,
    `The ${category ?? "Untold"} Story of ${words[0] ?? "Africa"}`,
    `Why ${topic} Matters Now`,
    `A Fresh Take on ${topic}`,
  ];
}

export async function optimizeSeo(input: {
  title: string;
  body: string;
  tags?: string[];
}): Promise<{ metaDescription: string; keywords: string[]; slugSuggestion: string }> {
  const llm = await chatCompletion([
    { role: "system", content: "Return JSON only: {\"metaDescription\":\"...\",\"keywords\":[\"...\"],\"slugSuggestion\":\"...\"}. metaDescription max 160 chars." },
    { role: "user", content: `Title: ${input.title}\nTags: ${(input.tags ?? []).join(", ")}\n\n${input.body.slice(0, 1500)}` },
  ], 400);

  if (llm) {
    try {
      const parsed = JSON.parse(llm.replace(/```json\n?|\n?```/g, "")) as {
        metaDescription?: string;
        keywords?: string[];
        slugSuggestion?: string;
      };
      return {
        metaDescription: parsed.metaDescription ?? input.title.slice(0, 160),
        keywords: parsed.keywords ?? input.tags ?? [],
        slugSuggestion: parsed.slugSuggestion ?? input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
      };
    } catch { /* fall through */ }
  }

  const plain = input.body.replace(/<[^>]+>/g, " ").trim();
  const excerpt = plain.slice(0, 155) + (plain.length > 155 ? "…" : "");
  return {
    metaDescription: excerpt || input.title,
    keywords: input.tags ?? [],
    slugSuggestion: input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
  };
}

export async function improveWriting(text: string, mode: "grammar" | "expand" | "summarize"): Promise<string> {
  const prompts: Record<string, string> = {
    grammar: "Fix grammar and spelling. Return only the corrected text, preserving formatting.",
    expand: "Expand this writing with more detail and vivid language. Return only the improved text.",
    summarize: "Summarize in 2-3 sentences for a preview teaser. Return only the summary.",
  };

  const llm = await chatCompletion([
    { role: "system", content: prompts[mode] },
    { role: "user", content: text.slice(0, 4000) },
  ], 1000);

  if (llm) return llm;

  if (mode === "summarize") {
    const plain = text.replace(/<[^>]+>/g, " ").trim();
    return plain.split(/[.!?]+/).filter(Boolean).slice(0, 2).join(". ").trim() + ".";
  }
  return text;
}

export async function suggestTags(title: string, body: string): Promise<string[]> {
  const llm = await chatCompletion([
    { role: "system", content: "Suggest 5 lowercase tags for this article. Return comma-separated tags only." },
    { role: "user", content: `Title: ${title}\n\n${body.slice(0, 1500)}` },
  ], 100);

  if (llm) return llm.split(",").map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 8);

  const words = `${title} ${body}`.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
}

export function isLlmConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
