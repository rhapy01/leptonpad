import { useRef } from "react";
import { uploadMedia } from "@/lib/platformApi";
import { useToast } from "@/hooks/use-toast";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const insertImage = async (file: File) => {
    try {
      const { url } = await uploadMedia(file);
      const snippet = `\n\n![${file.name}](${url})\n\n`;
      onChange(value ? `${value.trimEnd()}${snippet}` : snippet.trim());
      toast({ title: "Image inserted" });
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) void insertImage(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs px-3 py-1.5 rounded"
          style={{ border: "1px solid rgba(28,25,23,0.15)", color: "#78716C" }}
        >
          Insert image from computer
        </button>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "Write in Markdown…"}
        rows={16}
        className="w-full font-mono text-sm p-4 rounded"
        style={{
          border: "1px solid rgba(28,25,23,0.18)",
          background: "#FFFFFF",
          color: "#1C1917",
          lineHeight: 1.6,
          resize: "vertical",
        }}
      />
      <p className="text-xs mt-2" style={{ color: "#A8A29E" }}>
        Supports **bold**, *italic*, # headings, images, and [links](url).
      </p>
    </div>
  );
}

/** Convert basic markdown to HTML for preview/display */
export function markdownToHtml(md: string): string {
  if (!md || md.includes("<p>") || md.includes("<h")) return md;
  return md
    .split("\n\n")
    .map(block => {
      const image = block.match(/^!\[(.*)\]\((.+)\)$/);
      if (image) return `<figure><img src="${image[2]}" alt="${image[1]}" style="max-width:100%;height:auto;border-radius:4px" /></figure>`;
      if (block.startsWith("# ")) return `<h2>${block.slice(2)}</h2>`;
      if (block.startsWith("## ")) return `<h3>${block.slice(3)}</h3>`;
      if (block.startsWith("> ")) return `<blockquote><p>${block.slice(2)}</p></blockquote>`;
      const inline = block
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto;border-radius:4px" />')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
      return `<p>${inline}</p>`;
    })
    .join("");
}
