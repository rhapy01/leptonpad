import { useRef, useState } from "react";
import { uploadMedia } from "@/lib/platformApi";
import { useToast } from "@/hooks/use-toast";

/** Compact upload button for toolbars and inline use. */
export function MediaUploadButton({
  onUploaded,
  accept = "image/*,audio/*,video/mp4,video/webm,application/pdf",
  label = "Choose file",
  dark,
}: {
  onUploaded: (url: string) => void;
  accept?: string;
  label?: string;
  dark?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadMedia(file);
      onUploaded(result.url);
      toast({ title: "Uploaded", description: file.name });
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs px-3 py-1.5 rounded"
        style={{
          border: `1px solid ${dark ? "rgba(255,255,255,0.15)" : "rgba(28,25,23,0.15)"}`,
          color: dark ? "#E8EAF0" : "#78716C",
          background: dark ? "rgba(255,255,255,0.05)" : "transparent",
        }}
      >
        {uploading ? "Uploading…" : label}
      </button>
    </>
  );
}
