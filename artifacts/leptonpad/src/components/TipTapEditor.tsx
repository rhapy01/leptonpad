import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";

interface TipTapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-2 py-1 rounded text-xs font-medium transition-colors"
      style={{
        background: active ? "rgba(28,25,23,0.12)" : "transparent",
        color: active ? "#1C1917" : "#78716C",
        border: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function TipTapEditor({ value, onChange, placeholder }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: {},
        orderedList: {},
        blockquote: {},
        code: {},
        codeBlock: {},
        horizontalRule: {},
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder ?? "Write your article here… Paste from Word, Google Docs, or any source.",
        emptyEditorClass: "is-editor-empty",
      }),
      Link.configure({ openOnClick: false }),
    ],
    content: value || "",
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor-content",
        "data-testid": "tiptap-editor",
      },
    },
  });

  useEffect(() => {
    if (editor && value === "" && editor.getText() !== "") {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div
      style={{
        border: "1px solid rgba(28,25,23,0.15)",
        borderRadius: "2px",
        background: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-0.5 px-3 py-2"
        style={{ borderBottom: "1px solid rgba(28,25,23,0.1)", background: "#FAF7F2" }}
      >
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <span style={{ textDecoration: "underline" }}>U</span>
        </ToolbarButton>

        <span style={{ width: "1px", height: "16px", background: "rgba(28,25,23,0.12)", margin: "0 4px" }} />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
          H2
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
          H3
        </ToolbarButton>

        <span style={{ width: "1px", height: "16px", background: "rgba(28,25,23,0.12)", margin: "0 4px" }} />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          • List
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          1. List
        </ToolbarButton>

        <span style={{ width: "1px", height: "16px", background: "rgba(28,25,23,0.12)", margin: "0 4px" }} />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">
          "
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
          —
        </ToolbarButton>

        <span style={{ width: "1px", height: "16px", background: "rgba(28,25,23,0.12)", margin: "0 4px" }} />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          ↩
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          ↪
        </ToolbarButton>
      </div>

      {/* Editor body */}
      <EditorContent editor={editor} />
    </div>
  );
}
