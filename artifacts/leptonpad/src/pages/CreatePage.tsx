import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateContent,
  useListCategories,
  useRequestAiSuggestion,
  getListContentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PlatformLayout } from "@/components/PlatformLayout";
import { TipTapEditor } from "@/components/TipTapEditor";

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["article", "audio", "video"]),
  categorySlug: z.string().min(1, "Category is required"),
  body: z.string().optional(),
  previewText: z.string().optional(),
  audioUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  published: z.boolean().default(true),
});

type CreateForm = z.infer<typeof createSchema>;

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid rgba(28,25,23,0.18)",
  borderRadius: "2px",
  background: "#FFFFFF",
  color: "#1C1917",
  fontSize: "0.9375rem",
  fontFamily: "'Lora', Georgia, serif",
  outline: "none",
  transition: "border-color 0.15s",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#78716C",
  marginBottom: "8px",
  fontFamily: "sans-serif",
};

export default function CreatePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [aiSuggestion, setAiSuggestion] = useState<{ suggestedPrice: number; action: string; reasoning: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: categories } = useListCategories();
  const createContent = useCreateContent();
  const requestAiSuggestion = useRequestAiSuggestion();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: "",
      type: "article",
      categorySlug: "",
      body: "",
      previewText: "",
      price: 0.05,
      published: true,
    },
  });

  const contentType = form.watch("type");

  const handleGetAiSuggestion = async () => {
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const result = await requestAiSuggestion.mutateAsync({ contentId: 0 });
      setAiSuggestion({ suggestedPrice: result.suggestedPrice, action: result.action, reasoning: result.reasoning });
    } catch {
      setAiSuggestion({ suggestedPrice: 0.05, action: "keep", reasoning: "A starting price of $0.05 USDC is competitive for new creators." });
    } finally {
      setAiLoading(false);
    }
  };

  const onSubmit = async (data: CreateForm) => {
    const result = await createContent.mutateAsync({ data });
    queryClient.invalidateQueries({ queryKey: getListContentQueryKey() });
    setLocation(`/content/${result.id}`);
  };

  return (
    <PlatformLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        {/* Page header */}
        <div className="mb-8">
          <p className="editorial-label mb-2" style={{ color: "#78716C" }}>New piece</p>
          <div style={{ borderTop: "2px solid #1C1917", marginBottom: "12px" }} />
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: 700,
              color: "#1C1917",
              lineHeight: 1.2,
            }}
          >
            Publish Your Work
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#78716C", marginTop: "6px" }}>
            Keep 95% of every payment. No gatekeeping — publish freely.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-create-content">

          {/* Title */}
          <div>
            <label style={labelStyle}>Title</label>
            <input
              {...form.register("title")}
              placeholder="Give your piece a compelling title…"
              data-testid="input-title"
              style={{ ...inputStyle, fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.1rem" }}
              onFocus={e => (e.currentTarget.style.borderColor = "#C8960C")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(28,25,23,0.18)")}
            />
            {form.formState.errors.title && (
              <p className="text-red-600 text-xs mt-1">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>Content type</label>
            <div className="flex gap-2">
              {(["article", "audio", "video"] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => form.setValue("type", type)}
                  data-testid={`button-type-${type}`}
                  className="flex-1 py-2.5 text-sm font-medium transition-all"
                  style={{
                    background: contentType === type ? "#1C1917" : "#FFFFFF",
                    border: `1px solid ${contentType === type ? "#1C1917" : "rgba(28,25,23,0.18)"}`,
                    color: contentType === type ? "#FAF7F2" : "#78716C",
                    borderRadius: "2px",
                    fontFamily: "sans-serif",
                    letterSpacing: "0.03em",
                  }}
                >
                  {type === "article" ? "✍ Article" : type === "audio" ? "♪ Audio" : "▶ Video"}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category</label>
            <select
              {...form.register("categorySlug")}
              data-testid="select-category"
              style={{ ...inputStyle, fontFamily: "sans-serif" }}
              onFocus={e => (e.currentTarget.style.borderColor = "#C8960C")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(28,25,23,0.18)")}
            >
              <option value="">Select a category…</option>
              {categories?.map(cat => (
                <option key={cat.slug} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
            {form.formState.errors.categorySlug && (
              <p className="text-red-600 text-xs mt-1">{form.formState.errors.categorySlug.message}</p>
            )}
          </div>

          {/* Article body */}
          {contentType === "article" && (
            <>
              <div>
                <label style={labelStyle}>Article body</label>
                <p style={{ fontSize: "11px", color: "#78716C", marginBottom: "8px", fontFamily: "sans-serif" }}>
                  Paste from Word, Google Docs, or any source — formatting is preserved.
                </p>
                <TipTapEditor
                  value={form.watch("body") ?? ""}
                  onChange={(html) => form.setValue("body", html)}
                  placeholder="Write or paste your article here…"
                />
              </div>
              <div>
                <label style={labelStyle}>Preview teaser</label>
                <p style={{ fontSize: "11px", color: "#78716C", marginBottom: "8px", fontFamily: "sans-serif" }}>
                  Shown to readers before they pay. Leave blank to auto-generate from the first paragraph.
                </p>
                <textarea
                  {...form.register("previewText")}
                  rows={3}
                  placeholder="Hook your audience — a sentence or two that makes them want to read more…"
                  data-testid="textarea-preview"
                  style={{ ...inputStyle, resize: "none", lineHeight: "1.6" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#C8960C")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(28,25,23,0.18)")}
                />
              </div>
            </>
          )}

          {contentType === "audio" && (
            <div>
              <label style={labelStyle}>Audio URL</label>
              <input
                {...form.register("audioUrl")}
                placeholder="https://…"
                data-testid="input-audio-url"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "#C8960C")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(28,25,23,0.18)")}
              />
            </div>
          )}

          {contentType === "video" && (
            <div>
              <label style={labelStyle}>Video URL (YouTube embed URL)</label>
              <input
                {...form.register("videoUrl")}
                placeholder="https://www.youtube.com/embed/…"
                data-testid="input-video-url"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "#C8960C")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(28,25,23,0.18)")}
              />
            </div>
          )}

          {/* Pricing */}
          <div>
            <label style={labelStyle}>Price per read (USDC)</label>
            <p style={{ fontSize: "11px", color: "#78716C", marginBottom: "8px", fontFamily: "sans-serif" }}>
              You keep 95% of every payment. Set to 0 to publish free.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#C8960C",
                    fontWeight: 700,
                    fontFamily: "sans-serif",
                  }}
                >$</span>
                <input
                  {...form.register("price")}
                  type="number"
                  step="0.000001"
                  min="0"
                  data-testid="input-price"
                  style={{ ...inputStyle, paddingLeft: "28px", fontFamily: "sans-serif" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#C8960C")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(28,25,23,0.18)")}
                />
              </div>
              <button
                type="button"
                onClick={handleGetAiSuggestion}
                disabled={aiLoading}
                data-testid="button-ai-suggestion"
                className="px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 whitespace-nowrap"
                style={{
                  border: "1px solid rgba(28,25,23,0.18)",
                  background: "#FFFFFF",
                  color: "#78716C",
                  borderRadius: "2px",
                  fontFamily: "sans-serif",
                }}
              >
                {aiLoading ? "Thinking…" : "AI Price Hint"}
              </button>
            </div>

            {aiSuggestion && (
              <div
                className="mt-3 p-4"
                style={{
                  background: "rgba(200,150,12,0.05)",
                  border: "1px solid rgba(200,150,12,0.25)",
                  borderRadius: "2px",
                }}
                data-testid="ai-suggestion-panel"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#78716C", fontFamily: "sans-serif" }}>
                      AI Suggestion
                    </span>
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "1px 6px",
                      borderRadius: "2px",
                      textTransform: "uppercase",
                      fontFamily: "sans-serif",
                      background: aiSuggestion.action === "raise" ? "rgba(22,163,74,0.1)" : aiSuggestion.action === "lower" ? "rgba(220,38,38,0.1)" : "rgba(200,150,12,0.1)",
                      color: aiSuggestion.action === "raise" ? "#16A34A" : aiSuggestion.action === "lower" ? "#DC2626" : "#C8960C",
                    }}>
                      {aiSuggestion.action}
                    </span>
                  </div>
                  <span style={{ color: "#C8960C", fontWeight: 700, fontFamily: "sans-serif" }}>${aiSuggestion.suggestedPrice} USDC</span>
                </div>
                <p style={{ fontSize: "12px", color: "#78716C", marginBottom: "10px", fontFamily: "sans-serif" }}>{aiSuggestion.reasoning}</p>
                <button
                  type="button"
                  onClick={() => form.setValue("price", aiSuggestion.suggestedPrice)}
                  data-testid="button-accept-ai-suggestion"
                  style={{
                    fontSize: "11px",
                    padding: "4px 10px",
                    border: "1px solid rgba(200,150,12,0.3)",
                    background: "transparent",
                    color: "#C8960C",
                    borderRadius: "2px",
                    cursor: "pointer",
                    fontFamily: "sans-serif",
                  }}
                >
                  Accept suggestion
                </button>
              </div>
            )}

            {form.formState.errors.price && (
              <p className="text-red-600 text-xs mt-1">{form.formState.errors.price.message}</p>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid rgba(28,25,23,0.1)" }} />

          {/* Submit */}
          <div>
            <button
              type="submit"
              disabled={createContent.isPending}
              data-testid="button-publish"
              className="w-full py-3 font-semibold text-sm transition-all disabled:opacity-60"
              style={{
                background: "#1C1917",
                color: "#FAF7F2",
                borderRadius: "2px",
                fontFamily: "sans-serif",
                letterSpacing: "0.04em",
              }}
            >
              {createContent.isPending ? "Publishing…" : "Publish piece"}
            </button>
            {createContent.isError && (
              <p className="text-red-600 text-sm text-center mt-3">Failed to publish. Please try again.</p>
            )}
          </div>
        </form>
      </div>
    </PlatformLayout>
  );
}
