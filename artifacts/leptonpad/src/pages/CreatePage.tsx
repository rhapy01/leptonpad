import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListCategories,
  useRequestAiSuggestion,
  getListContentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PlatformLayout } from "@/components/PlatformLayout";
import { TipTapEditor } from "@/components/TipTapEditor";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { createContentExtended } from "@/lib/platformApi";
import { AiWritingPanel } from "@/components/AiWritingPanel";
import { FileUploadField } from "@/components/FileUploadField";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Check, FileText, Music, Video } from "lucide-react";

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["article", "audio", "video"]),
  categorySlug: z.string().min(1, "Category is required"),
  body: z.string().optional(),
  previewText: z.string().optional(),
  coverImageUrl: z.string().min(1, "Upload a cover image"),
  audioUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  published: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.type === "audio" && !data.audioUrl?.trim()) {
    ctx.addIssue({ code: "custom", message: "Upload an audio file", path: ["audioUrl"] });
  }
  if (data.type === "video" && !data.videoUrl?.trim()) {
    ctx.addIssue({ code: "custom", message: "Upload a video file", path: ["videoUrl"] });
  }
});

type CreateForm = z.infer<typeof createSchema>;

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  border: "1px solid rgba(28,25,23,0.18)",
  borderRadius: "2px",
  background: "#FFFFFF",
  color: "#1C1917",
  fontSize: "1.0625rem",
  lineHeight: 1.75,
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
  const { t } = useI18n();
  const { toast } = useToast();
  const [aiSuggestion, setAiSuggestion] = useState<{ suggestedPrice: number; action: string; reasoning: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [markdownMode, setMarkdownMode] = useState(false);
  const [tags, setTags] = useState("");
  const [publishMode, setPublishMode] = useState<"now" | "draft" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAutosave, setLastAutosave] = useState<Date | null>(null);

  const AUTOSAVE_KEY = "create-draft";

  const { data: categories } = useListCategories();
  const [submitError, setSubmitError] = useState(false);
  const requestAiSuggestion = useRequestAiSuggestion();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: "",
      type: "article",
      categorySlug: "",
      body: "",
      previewText: "",
      coverImageUrl: "",
      price: 0.05,
      published: true,
    },
  });

  const contentType = form.watch("type");
  const title = form.watch("title");
  const body = form.watch("body");

  useEffect(() => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.title) form.setValue("title", d.title);
        if (d.body) form.setValue("body", d.body);
        if (d.tags) setTags(d.tags);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ title, body, tags, savedAt: Date.now() }));
      setLastAutosave(new Date());
    }, 30_000);
    return () => clearInterval(timer);
  }, [title, body, tags]);

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
    setIsSubmitting(true);
    setSubmitError(false);
    try {
      const status = publishMode === "draft" ? "draft" : publishMode === "schedule" ? "scheduled" : "published";
      const result = await createContentExtended({
        ...data,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        status,
        published: status === "published",
        scheduledAt: publishMode === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        metaDescription: metaDescription || undefined,
      }) as { id: number };
      localStorage.removeItem(AUTOSAVE_KEY);
      queryClient.invalidateQueries({ queryKey: getListContentQueryKey() });

      const redirectDelayMs = 1600;
      if (status === "draft") {
        toast({
          title: "Draft saved",
          description: "Your piece is in your creator dashboard.",
          variant: "success",
        });
        window.setTimeout(() => setLocation("/dashboard/creator"), redirectDelayMs);
      } else if (status === "scheduled") {
        toast({
          title: "Scheduled",
          description: scheduledAt
            ? `Goes live ${new Date(scheduledAt).toLocaleString()}.`
            : "Your piece is scheduled to publish.",
          variant: "success",
        });
        window.setTimeout(() => setLocation("/dashboard/creator"), redirectDelayMs);
      } else {
        toast({
          title: "Published!",
          description: "Your piece is live. Taking you there now…",
          variant: "success",
        });
        window.setTimeout(() => setLocation(`/content/${result.id}`), redirectDelayMs);
      }
    } catch {
      setSubmitError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isArticle = contentType === "article";
  const isMedia = contentType === "audio" || contentType === "video";
  const usesFocusLayout = isArticle || isMedia;

  const audioMediaField = (
    <FileUploadField
      label="Your audio"
      hint="This is what listeners unlock and play — MP3, WAV, OGG, M4A, or WebM from your computer."
      accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm"
      value={form.watch("audioUrl") ?? ""}
      onChange={url => form.setValue("audioUrl", url, { shouldValidate: true })}
      preview="audio"
      required
      testId="input-audio-file"
    />
  );

  const videoMediaField = (
    <FileUploadField
      label="Your video"
      hint="This is what viewers unlock and watch — MP4, WebM, or MOV from your computer (max 50MB)."
      accept="video/mp4,video/webm,video/quicktime"
      value={form.watch("videoUrl") ?? ""}
      onChange={url => form.setValue("videoUrl", url, { shouldValidate: true })}
      preview="video"
      required
      testId="input-video-file"
    />
  );

  const typePills = (inBar = false) => (
    <div className={inBar ? "create-type-pills" : undefined} role="tablist" aria-label="Content type">
      {(["article", "audio", "video"] as const).map((type) => {
        const active = contentType === type;
        const Icon = type === "article" ? FileText : type === "audio" ? Music : Video;
        return (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => form.setValue("type", type)}
            data-testid={`button-type-${type}`}
            className={`create-type-pill${active ? " create-type-pill--active" : ""}`}
          >
            <Icon size={14} strokeWidth={2} aria-hidden />
            <span>{type === "article" ? "Article" : type === "audio" ? "Audio" : "Video"}</span>
          </button>
        );
      })}
    </div>
  );

  const studioBar = (
    <header className="create-studio-bar">
      <div className="create-studio-bar-inner">
        {typePills(true)}
        <div className="create-studio-bar-end">
          {lastAutosave && (
            <span className="create-save-status">
              <Check size={14} strokeWidth={2.5} aria-hidden />
              Saved {lastAutosave.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          {isArticle && (
            <button
              type="button"
              onClick={() => setMarkdownMode((v) => !v)}
              className="create-studio-ghost-btn"
            >
              {markdownMode ? "Rich text" : "Markdown"}
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-publish"
            className="create-studio-publish-btn"
          >
            {isSubmitting
              ? "Saving…"
              : publishMode === "draft"
                ? "Save draft"
                : publishMode === "schedule"
                  ? "Schedule"
                  : "Publish"}
          </button>
        </div>
      </div>
    </header>
  );

  const categoryField = (
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
  );

  const coverField = (
    <>
      <FileUploadField
        label="Cover image"
        hint="Shown on feed cards, homepage carousels, and your content page."
        accept="image/jpeg,image/png,image/webp,image/gif"
        value={form.watch("coverImageUrl")}
        onChange={url => form.setValue("coverImageUrl", url, { shouldValidate: true })}
        preview="image"
        required
        testId="input-cover-image"
      />
      {form.formState.errors.coverImageUrl && (
        <p className="text-red-600 text-xs mt-1">{form.formState.errors.coverImageUrl.message}</p>
      )}
    </>
  );

  const pricingField = (
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
  );

  const submitButton = (
    <div>
      <button
        type="submit"
        disabled={isSubmitting}
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
        {isSubmitting
          ? "Saving…"
          : publishMode === "draft"
            ? t("create.draft")
            : publishMode === "schedule"
              ? "Schedule piece"
              : t("create.publish")}
      </button>
      {submitError && (
        <p className="text-red-600 text-sm text-center mt-3">Failed to publish. Please try again.</p>
      )}
    </div>
  );

  return (
    <PlatformLayout>
      <div className={usesFocusLayout ? "create-page--studio" : undefined}>
      <div className={usesFocusLayout ? "create-composer-wrap" : "max-w-2xl mx-auto px-4 sm:px-6 py-10"}>

        {!usesFocusLayout && (
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
              {t("create.title")}
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#78716C", marginTop: "6px" }}>
              Keep 95% of every payment. No gatekeeping — publish freely.
            </p>
            {lastAutosave && (
              <p className="text-xs mt-1" style={{ color: "#A8A29E" }}>Draft autosaved {lastAutosave.toLocaleTimeString()}</p>
            )}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className={usesFocusLayout ? "create-studio-form" : "space-y-6"} data-testid="form-create-content">

          {usesFocusLayout && studioBar}

          {isArticle ? (
            <>
              <section className="create-composer-sheet">
                <input
                  {...form.register("title")}
                  placeholder="Title"
                  data-testid="input-title"
                  className="create-composer-title"
                />
                {form.formState.errors.title && (
                  <p className="text-red-600 text-xs mb-2">{form.formState.errors.title.message}</p>
                )}

                {markdownMode ? (
                  <MarkdownEditor
                    variant="composer"
                    value={form.watch("body") ?? ""}
                    onChange={(v) => form.setValue("body", v)}
                    placeholder="Start writing — the page grows as you go…"
                  />
                ) : (
                  <TipTapEditor
                    variant="composer"
                    value={form.watch("body") ?? ""}
                    onChange={(html) => form.setValue("body", html)}
                    placeholder="Start writing — paste from Word or Google Docs, or type here. The page grows as you go."
                  />
                )}
              </section>

              <div className="create-composer-meta">
                <div className="create-composer-meta-intro">
                  <h2>Publishing</h2>
                  <p>Cover, category, and price — set these when you are ready to go live.</p>
                </div>
                <div className="create-composer-meta-panel">
                  <h3>Preview teaser</h3>
                  <p style={{ fontSize: "11px", color: "#78716C", marginBottom: "8px", fontFamily: "sans-serif" }}>
                    Shown before readers pay. Leave blank to auto-generate from your opening.
                  </p>
                  <textarea
                    {...form.register("previewText")}
                    rows={3}
                    placeholder="A sentence or two that hooks your audience…"
                    data-testid="textarea-preview"
                    className="prose-textarea"
                    style={{ resize: "vertical", minHeight: "5rem" }}
                  />
                </div>

                <div className="create-composer-meta-panel space-y-5">
                  {categoryField}
                  {coverField}
                  <AiWritingPanel
                    title={title}
                    body={body ?? ""}
                    category={form.watch("categorySlug")}
                    tags={tags}
                    onTitle={(t) => form.setValue("title", t)}
                    onBody={(b) => form.setValue("body", b)}
                    onTags={setTags}
                    onMeta={setMetaDescription}
                  />
                  <div>
                    <label style={labelStyle}>Tags</label>
                    <input value={tags} onChange={e => setTags(e.target.value)} placeholder="AI, Africa, Architecture (comma-separated)" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>SEO meta description (optional)</label>
                    <textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={3} className="prose-textarea" style={{ resize: "vertical" }} placeholder="Shown in search results and social previews" />
                  </div>
                  <div>
                    <label style={labelStyle}>When to publish</label>
                    <div className="flex gap-2 flex-wrap">
                      {(["now", "draft", "schedule"] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPublishMode(mode)}
                          className="px-4 py-2 text-sm"
                          style={{
                            background: publishMode === mode ? "#1C1917" : "#FFFFFF",
                            color: publishMode === mode ? "#FAF7F2" : "#78716C",
                            border: `1px solid ${publishMode === mode ? "#1C1917" : "rgba(28,25,23,0.18)"}`,
                            borderRadius: "2px",
                          }}
                        >
                          {mode === "now" ? "Publish now" : mode === "draft" ? "Save draft" : "Schedule"}
                        </button>
                      ))}
                    </div>
                    {publishMode === "schedule" && (
                      <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="mt-3 w-full" style={inputStyle} />
                    )}
                  </div>
                </div>

                <div className="create-composer-meta-panel">
                  {pricingField}
                </div>

                <div className="create-composer-meta-submit">
                  {submitButton}
                  {submitError && (
                    <p className="text-red-600 text-sm text-center mt-3">Failed to publish. Please try again.</p>
                  )}
                </div>
              </div>
            </>
          ) : isMedia ? (
            <>
              <section className="create-composer-sheet create-media-sheet">
                <input
                  {...form.register("title")}
                  placeholder="Title"
                  data-testid="input-title"
                  className="create-composer-title"
                />
                {form.formState.errors.title && (
                  <p className="text-red-600 text-xs mb-3">{form.formState.errors.title.message}</p>
                )}

                <div className="create-media-primary">
                  {contentType === "audio" ? audioMediaField : videoMediaField}
                  {contentType === "audio" && form.formState.errors.audioUrl && (
                    <p className="text-red-600 text-xs mt-1">{form.formState.errors.audioUrl.message}</p>
                  )}
                  {contentType === "video" && form.formState.errors.videoUrl && (
                    <p className="text-red-600 text-xs mt-1">{form.formState.errors.videoUrl.message}</p>
                  )}
                </div>
              </section>

              <div className="create-composer-meta">
                <div className="create-composer-meta-intro">
                  <h2>Publishing</h2>
                  <p>Category, cover art, and pricing for your {contentType}.</p>
                </div>
                <div className="create-composer-meta-panel space-y-5">
                  {categoryField}
                  {coverField}
                  <div>
                    <label style={labelStyle}>Tags</label>
                    <input value={tags} onChange={e => setTags(e.target.value)} placeholder="podcast, interview, Africa (comma-separated)" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>SEO meta description (optional)</label>
                    <textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={3} className="prose-textarea" style={{ resize: "vertical" }} placeholder="Shown in search results and social previews" />
                  </div>
                  <div>
                    <label style={labelStyle}>When to publish</label>
                    <div className="flex gap-2 flex-wrap">
                      {(["now", "draft", "schedule"] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPublishMode(mode)}
                          className="px-4 py-2 text-sm"
                          style={{
                            background: publishMode === mode ? "#1C1917" : "#FFFFFF",
                            color: publishMode === mode ? "#FAF7F2" : "#78716C",
                            border: `1px solid ${publishMode === mode ? "#1C1917" : "rgba(28,25,23,0.18)"}`,
                            borderRadius: "2px",
                          }}
                        >
                          {mode === "now" ? "Publish now" : mode === "draft" ? "Save draft" : "Schedule"}
                        </button>
                      ))}
                    </div>
                    {publishMode === "schedule" && (
                      <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="mt-3 w-full" style={inputStyle} />
                    )}
                  </div>
                </div>

                <div className="create-composer-meta-panel">
                  {pricingField}
                </div>

                <div className="create-composer-meta-submit">
                  {submitButton}
                  {submitError && (
                    <p className="text-red-600 text-sm text-center mt-3">Failed to publish. Please try again.</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </form>
      </div>
      </div>
    </PlatformLayout>
  );
}
