import { useRef, useState, type DragEvent } from "react";
import { uploadMedia } from "@/lib/platformApi";
import { useToast } from "@/hooks/use-toast";

export type FileUploadFieldProps = {
  label: string;
  hint?: string;
  accept: string;
  value: string;
  onChange: (url: string) => void;
  preview?: "image" | "audio" | "video" | "file" | "none" | "banner" | "avatar";
  testId?: string;
  dark?: boolean;
  required?: boolean;
  /** Shown inside avatar circle when no image */
  fallbackInitial?: string;
};

export function FileUploadField({
  label,
  hint,
  accept,
  value,
  onChange,
  preview = "file",
  testId,
  dark,
  required,
  fallbackInitial,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const isImagePreview = preview === "image" || preview === "banner" || preview === "avatar";

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadMedia(file);
      onChange(result.url);
      toast({ title: "Photo updated" });
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Could not upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const openPicker = () => {
    if (!uploading) inputRef.current?.click();
  };

  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(28,25,23,0.15)";
  const muted = dark ? "#6B7280" : "var(--color-ink-muted)";

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      className="sr-only"
      data-testid={testId}
      onChange={onInputChange}
    />
  );

  if (preview === "avatar") {
    return (
      <div className="upload-field">
        {hiddenInput}
        {label ? <p className="upload-field-label">{label}</p> : null}
        <button
          type="button"
          onClick={openPicker}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          disabled={uploading}
          className={`upload-avatar${dragOver ? " upload-avatar--drag" : ""}`}
          aria-label="Change profile photo"
        >
          {value ? (
            <img src={value} alt="" className="upload-avatar-img" />
          ) : (
            <span className="upload-avatar-fallback">{fallbackInitial?.[0]?.toUpperCase() ?? "?"}</span>
          )}
          <span className="upload-avatar-overlay">
            {uploading ? "Uploading…" : "Change photo"}
          </span>
        </button>
        <p className="upload-field-hint">JPG, PNG or WebP · max 5 MB</p>
        {value && (
          <button type="button" className="upload-remove-link" onClick={() => onChange("")}>
            Remove photo
          </button>
        )}
      </div>
    );
  }

  if (preview === "banner") {
    return (
      <div className="upload-field">
        {hiddenInput}
        {label ? <p className="upload-field-label">{label}</p> : null}
        {hint && <p className="upload-field-desc">{hint}</p>}
        <button
          type="button"
          onClick={openPicker}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          disabled={uploading}
          className={`upload-banner${dragOver ? " upload-banner--drag" : ""}${value ? " upload-banner--filled" : ""}`}
        >
          {value ? (
            <img src={value} alt="" className="upload-banner-img" />
          ) : (
            <span className="upload-banner-placeholder">
              <span className="upload-banner-icon">↑</span>
              <span className="upload-banner-title">
                {uploading ? "Uploading…" : "Upload banner image"}
              </span>
              <span className="upload-banner-sub">Drag and drop, or click to browse</span>
            </span>
          )}
          {value && (
            <span className="upload-banner-change">
              {uploading ? "Uploading…" : "Replace banner"}
            </span>
          )}
        </button>
        {value && (
          <button type="button" className="upload-remove-link" onClick={() => onChange("")}>
            Remove banner
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="upload-field">
      {hiddenInput}
      {label ? <p className="upload-field-label">{label}{required ? " *" : ""}</p> : null}
      {hint && <p className="upload-field-desc">{hint}</p>}
      <button
        type="button"
        onClick={openPicker}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={uploading}
        className={`upload-dropzone${dragOver ? " upload-dropzone--drag" : ""}`}
      >
        <span className="upload-dropzone-title">
          {uploading ? "Uploading…" : value ? "Replace file" : "Upload file"}
        </span>
        <span className="upload-dropzone-sub">Drag and drop, or click to browse</span>
      </button>
      {value && preview === "audio" && (
        <audio controls className="mt-3 w-full" style={{ accentColor: "#C8960C" }}>
          <source src={value} />
        </audio>
      )}
      {value && preview === "video" && (
        <video controls className="mt-3 aspect-video w-full max-w-lg rounded-sm" src={value} />
      )}
      {value && preview === "image" && (
        <img src={value} alt="" className="mt-3 aspect-video w-full max-w-xs rounded-sm border object-cover" style={{ borderColor: border }} />
      )}
      {value && (
        <button type="button" className="upload-remove-link" onClick={() => onChange("")}>
          Remove file
        </button>
      )}
      {!value && required && (
        <p className="mt-1 text-xs text-red-600">A file is required</p>
      )}
    </div>
  );
}
