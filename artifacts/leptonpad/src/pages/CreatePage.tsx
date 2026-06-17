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
      // Use contentId 0 as a signal to generate a new suggestion at publish time
      const result = await requestAiSuggestion.mutateAsync({ contentId: 0 });
      setAiSuggestion({ suggestedPrice: result.suggestedPrice, action: result.action, reasoning: result.reasoning });
    } catch {
      // fallback suggestion
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
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#E8EAF0] mb-1">Publish Content</h1>
          <p className="text-sm text-[#6B7280]">Share your work. Keep 95% of every payment.</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-create-content">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#E8EAF0] mb-2">What is the title?</label>
            <input
              {...form.register("title")}
              placeholder="Give your piece a compelling title..."
              data-testid="input-title"
              className="w-full px-4 py-3 rounded-lg bg-[#161820] border border-white/10 text-[#E8EAF0] placeholder:text-[#6B7280] focus:outline-none focus:border-[#F5C842]/50 transition-colors text-base"
            />
            {form.formState.errors.title && (
              <p className="text-red-400 text-xs mt-1">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-[#E8EAF0] mb-2">What type of content is this?</label>
            <div className="flex gap-3">
              {(["article", "audio", "video"] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => form.setValue("type", type)}
                  data-testid={`button-type-${type}`}
                  className="flex-1 py-3 rounded-lg border text-sm font-medium transition-all duration-150"
                  style={{
                    background: contentType === type ? "rgba(245,200,66,0.08)" : "#161820",
                    borderColor: contentType === type ? "#F5C842" : "rgba(255,255,255,0.08)",
                    color: contentType === type ? "#F5C842" : "#6B7280",
                  }}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-[#E8EAF0] mb-2">Which category does it belong to?</label>
            <select
              {...form.register("categorySlug")}
              data-testid="select-category"
              className="w-full px-4 py-3 rounded-lg bg-[#161820] border border-white/10 text-[#E8EAF0] focus:outline-none focus:border-[#F5C842]/50 transition-colors"
            >
              <option value="">Select a category...</option>
              {categories?.map(cat => (
                <option key={cat.slug} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
            {form.formState.errors.categorySlug && (
              <p className="text-red-400 text-xs mt-1">{form.formState.errors.categorySlug.message}</p>
            )}
          </div>

          {/* Content body */}
          {contentType === "article" && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#E8EAF0] mb-2">Article body</label>
                <textarea
                  {...form.register("body")}
                  rows={14}
                  placeholder="Write your article here..."
                  data-testid="textarea-body"
                  className="w-full px-4 py-3 rounded-lg bg-[#161820] border border-white/10 text-[#E8EAF0] placeholder:text-[#6B7280] focus:outline-none focus:border-[#F5C842]/50 transition-colors resize-none leading-relaxed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#E8EAF0] mb-2">Preview (shown before purchase)</label>
                <textarea
                  {...form.register("previewText")}
                  rows={3}
                  placeholder="First paragraph or hook — shown to readers before they pay..."
                  data-testid="textarea-preview"
                  className="w-full px-4 py-3 rounded-lg bg-[#161820] border border-white/10 text-[#E8EAF0] placeholder:text-[#6B7280] focus:outline-none focus:border-[#F5C842]/50 transition-colors resize-none"
                />
              </div>
            </>
          )}

          {contentType === "audio" && (
            <div>
              <label className="block text-sm font-medium text-[#E8EAF0] mb-2">Audio URL</label>
              <input
                {...form.register("audioUrl")}
                placeholder="https://..."
                data-testid="input-audio-url"
                className="w-full px-4 py-3 rounded-lg bg-[#161820] border border-white/10 text-[#E8EAF0] placeholder:text-[#6B7280] focus:outline-none focus:border-[#F5C842]/50 transition-colors"
              />
            </div>
          )}

          {contentType === "video" && (
            <div>
              <label className="block text-sm font-medium text-[#E8EAF0] mb-2">Video URL (YouTube embed URL)</label>
              <input
                {...form.register("videoUrl")}
                placeholder="https://www.youtube.com/embed/..."
                data-testid="input-video-url"
                className="w-full px-4 py-3 rounded-lg bg-[#161820] border border-white/10 text-[#E8EAF0] placeholder:text-[#6B7280] focus:outline-none focus:border-[#F5C842]/50 transition-colors"
              />
            </div>
          )}

          {/* Pricing */}
          <div>
            <label className="block text-sm font-medium text-[#E8EAF0] mb-1">What do you want to charge per piece in USDC?</label>
            <p className="text-xs text-[#6B7280] mb-3">You keep 95% of every payment. Minimum $0.000001. Set to 0 to publish free.</p>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F5C842] font-semibold text-sm">$</span>
                <input
                  {...form.register("price")}
                  type="number"
                  step="0.000001"
                  min="0"
                  data-testid="input-price"
                  className="w-full pl-7 pr-4 py-3 rounded-lg bg-[#161820] border border-white/10 text-[#E8EAF0] focus:outline-none focus:border-[#F5C842]/50 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={handleGetAiSuggestion}
                disabled={aiLoading}
                data-testid="button-ai-suggestion"
                className="px-4 py-3 rounded-lg text-sm font-medium border border-white/10 text-[#2DD4BF] hover:border-[#2DD4BF]/40 hover:bg-[#2DD4BF]/5 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {aiLoading ? "Thinking..." : "Get AI Price Suggestion"}
              </button>
            </div>

            {/* AI suggestion panel */}
            {aiSuggestion && (
              <div
                className="mt-3 p-4 rounded-lg border border-[#2DD4BF]/20"
                style={{ background: "rgba(45,212,191,0.05)" }}
                data-testid="ai-suggestion-panel"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#2DD4BF]">AI Suggestion</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase ${
                      aiSuggestion.action === "raise" ? "bg-green-400/15 text-green-400" :
                      aiSuggestion.action === "lower" ? "bg-red-400/15 text-red-400" :
                      "bg-[#F5C842]/15 text-[#F5C842]"
                    }`}>
                      {aiSuggestion.action}
                    </span>
                  </div>
                  <span className="text-[#F5C842] font-bold">${aiSuggestion.suggestedPrice} USDC</span>
                </div>
                <p className="text-xs text-[#6B7280] mb-3">{aiSuggestion.reasoning}</p>
                <button
                  type="button"
                  onClick={() => form.setValue("price", aiSuggestion.suggestedPrice)}
                  data-testid="button-accept-ai-suggestion"
                  className="text-xs px-3 py-1.5 rounded border border-[#2DD4BF]/30 text-[#2DD4BF] hover:bg-[#2DD4BF]/10 transition-colors"
                >
                  Accept Suggestion
                </button>
              </div>
            )}

            {form.formState.errors.price && (
              <p className="text-red-400 text-xs mt-1">{form.formState.errors.price.message}</p>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={createContent.isPending}
              data-testid="button-publish"
              className="w-full py-3.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-60"
              style={{ background: "#F5C842", color: "#0D0F14" }}
            >
              {createContent.isPending ? "Publishing..." : "Publish"}
            </button>
            {createContent.isError && (
              <p className="text-red-400 text-sm text-center mt-3">Failed to publish. Please try again.</p>
            )}
          </div>
        </form>
      </div>
    </PlatformLayout>
  );
}
