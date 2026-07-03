import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetContent,
  useListCategories,
  getGetContentQueryKey,
} from "@workspace/api-client-react";
import { PlatformLayout } from "@/components/PlatformLayout";
import { TipTapEditor } from "@/components/TipTapEditor";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { updateContentExtended, fetchContentVersions } from "@/lib/platformApi";
import { FileUploadField } from "@/components/FileUploadField";
import { useToast } from "@/hooks/use-toast";

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

const STATUSES = ["draft", "review", "approved", "scheduled", "published", "archived"] as const;

export default function EditContentPage({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: content, isLoading } = useGetContent(id);
  const { data: categories } = useListCategories();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [price, setPrice] = useState(0);
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("published");
  const [scheduledAt, setScheduledAt] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [markdownMode, setMarkdownMode] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (content) {
      setTitle(content.title);
      setBody(content.body ?? "");
      setPreviewText(content.previewText ?? "");
      setPrice(Number(content.price));
      setTags(((content as { tags?: string[] }).tags ?? []).join(", "));
      setStatus((content as { status?: string }).status ?? "published");
      setMetaDescription((content as { metaDescription?: string }).metaDescription ?? "");
      setCoverImageUrl(content.coverImageUrl ?? "");
      setAudioUrl(content.audioUrl ?? "");
      setVideoUrl(content.videoUrl ?? "");
      const sched = (content as { scheduledAt?: string }).scheduledAt;
      if (sched) setScheduledAt(sched.slice(0, 16));
    }
  }, [content]);

  // Autosave to localStorage
  const autosaveKey = `draft-edit-${id}`;
  useEffect(() => {
    const saved = localStorage.getItem(autosaveKey);
    if (saved && !content) {
      try {
        const parsed = JSON.parse(saved);
        setTitle(parsed.title ?? "");
        setBody(parsed.body ?? "");
      } catch { /* ignore */ }
    }
  }, [id, content, autosaveKey]);

  const doAutosave = useCallback(() => {
    localStorage.setItem(autosaveKey, JSON.stringify({ title, body, previewText, savedAt: Date.now() }));
    setLastSaved(new Date());
  }, [autosaveKey, title, body, previewText]);

  useEffect(() => {
    const timer = setInterval(doAutosave, 30_000);
    return () => clearInterval(timer);
  }, [doAutosave]);

  const { data: versions } = useQuery({
    queryKey: ["versions", id],
    queryFn: () => fetchContentVersions(id),
    enabled: !!content,
  });

  const saveMutation = useMutation({
    mutationFn: () => updateContentExtended(id, {
      title,
      body,
      previewText,
      price,
      coverImageUrl: coverImageUrl || undefined,
      audioUrl: audioUrl || undefined,
      videoUrl: videoUrl || undefined,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      status,
      scheduledAt: scheduledAt || undefined,
      metaDescription,
    }),
    onSuccess: () => {
      localStorage.removeItem(autosaveKey);
      qc.invalidateQueries({ queryKey: getGetContentQueryKey(id) });
      toast({ title: "Saved", description: status === "published" ? "Content updated." : `Status: ${status}` });
      if (status === "published") setLocation(`/content/${id}`);
    },
  });

  if (isLoading) {
    return (
      <PlatformLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 animate-pulse">
          <div className="h-8 bg-black/5 rounded w-1/2 mb-4" />
        </div>
      </PlatformLayout>
    );
  }

  if (!content) {
    return (
      <PlatformLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p style={{ color: "#78716C" }}>Content not found.</p>
        </div>
      </PlatformLayout>
    );
  }

  return (
    <PlatformLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="editorial-label mb-2" style={{ color: "#78716C" }}>Edit piece</p>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.75rem", fontWeight: 700, color: "#1C1917" }}>
              {title || "Untitled"}
            </h1>
          </div>
          {lastSaved && (
            <span className="text-xs" style={{ color: "#A8A29E" }}>
              Autosaved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-6">
          <div>
            <label style={labelStyle}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} required />
          </div>

          <div>
            <label style={labelStyle}>Editorial status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, fontFamily: "sans-serif" }}>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {status === "scheduled" && (
            <div>
              <label style={labelStyle}>Schedule for</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={{ ...inputStyle, fontFamily: "sans-serif" }} />
            </div>
          )}

          <div>
            <label style={labelStyle}>Tags (comma-separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="AI, Africa, Architecture" style={inputStyle} />
          </div>

          <FileUploadField
            label="Cover image"
            accept="image/jpeg,image/png,image/webp,image/gif"
            value={coverImageUrl}
            onChange={setCoverImageUrl}
            preview="image"
          />

          {content.type === "audio" && (
            <FileUploadField
              label="Audio file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm"
              value={audioUrl}
              onChange={setAudioUrl}
              preview="audio"
            />
          )}

          {content.type === "video" && (
            <FileUploadField
              label="Video file"
              accept="video/mp4,video/webm,video/quicktime"
              value={videoUrl}
              onChange={setVideoUrl}
              preview="video"
            />
          )}

          <div>
            <label style={labelStyle}>SEO meta description</label>
            <textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={4} className="prose-textarea" style={{ resize: "none" }} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label style={{ ...labelStyle, marginBottom: 0 }}>Body</label>
              <button type="button" onClick={() => setMarkdownMode(v => !v)} className="text-xs px-2 py-1 rounded" style={{ border: "1px solid rgba(28,25,23,0.15)", color: "#78716C" }}>
                {markdownMode ? "Rich text" : "Markdown"}
              </button>
            </div>
            {markdownMode ? (
              <MarkdownEditor value={body} onChange={setBody} />
            ) : (
              <TipTapEditor value={body} onChange={setBody} placeholder="Edit your article…" />
            )}
          </div>

          <div>
            <label style={labelStyle}>Preview teaser</label>
            <textarea value={previewText} onChange={e => setPreviewText(e.target.value)} rows={5} className="prose-textarea" style={{ resize: "none" }} />
          </div>

          <div>
            <label style={labelStyle}>Price (USDC)</label>
            <input type="number" step="0.000001" min="0" value={price} onChange={e => setPrice(Number(e.target.value))} style={{ ...inputStyle, fontFamily: "sans-serif" }} />
          </div>

          {versions && versions.length > 0 && (
            <div className="p-4 rounded" style={{ background: "rgba(28,25,23,0.04)", border: "1px solid rgba(28,25,23,0.08)" }}>
              <p style={{ ...labelStyle }}>Version history</p>
              <ul className="space-y-1">
                {versions.map(v => (
                  <li key={v.id} className="text-xs" style={{ color: "#78716C" }}>
                    {v.title} — {new Date(v.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="w-full py-3 font-semibold text-sm"
            style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}
          >
            {saveMutation.isPending ? "Saving…" : status === "published" ? "Save & publish" : `Save as ${status}`}
          </button>
        </form>
      </div>
    </PlatformLayout>
  );
}
