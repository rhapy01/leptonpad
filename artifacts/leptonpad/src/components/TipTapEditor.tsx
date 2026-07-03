import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-text-style/font-family";
import { FontSize } from "@tiptap/extension-text-style/font-size";
import { LineHeight } from "@tiptap/extension-text-style/line-height";
import { Color } from "@tiptap/extension-color";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Code2,
  Columns,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  Rows,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table2,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Video,
} from "lucide-react";
import { uploadMedia } from "@/lib/platformApi";
import { sanitizePastedHtml } from "@/lib/sanitizeWordHtml";
import { applyListToSelection } from "@/lib/tiptapListUtils";
import { useToast } from "@/hooks/use-toast";

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Playfair Display", value: "Playfair Display, Georgia, serif" },
  { label: "Lora", value: "Lora, Georgia, serif" },
  { label: "Georgia", value: "Georgia, Times New Roman, serif" },
  { label: "Times New Roman", value: "Times New Roman, Times, serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "System UI", value: "system-ui, -apple-system, sans-serif" },
  { label: "Courier New", value: "Courier New, Courier, monospace" },
];

const FONT_SIZES = [
  { label: "Default", value: "" },
  { label: "10", value: "10px" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "24", value: "24px" },
  { label: "28", value: "28px" },
  { label: "32", value: "32px" },
  { label: "36", value: "36px" },
];

const LINE_HEIGHTS = [
  { label: "Default", value: "" },
  { label: "1.0", value: "1" },
  { label: "1.15", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "1.75", value: "1.75" },
  { label: "2.0", value: "2" },
  { label: "2.5", value: "2.5" },
];

const DraggableParagraph = Paragraph.extend({ draggable: true });
const DraggableHeading = Heading.extend({ draggable: true });

const UploadedImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: null } };
  },
  parseHTML() {
    return [{ tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { style: "max-width:100%;height:auto;border-radius:4px;margin:0.75em 0" })];
  },
});

const UploadedVideo = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: true,
        style: "max-width:100%;width:100%;border-radius:4px;margin:0.75em 0",
      }),
    ];
  },
});

interface TipTapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  variant?: "default" | "composer";
}

function RibbonBtn({
  onClick,
  active,
  title,
  disabled,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`tiptap-ribbon-btn${active ? " tiptap-ribbon-btn--active" : ""}`}
    >
      {children}
    </button>
  );
}

function RibbonSelect({
  label,
  value,
  options,
  onChange,
  title,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
  title: string;
}) {
  return (
    <label className="tiptap-ribbon-select" title={title}>
      <span className="tiptap-ribbon-select-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tiptap-ribbon-select-input"
      >
        {options.map((opt) => (
          <option key={opt.value || "default"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tiptap-ribbon-group">
      <div className="tiptap-ribbon-group-tools">{children}</div>
      <span className="tiptap-ribbon-group-label">{label}</span>
    </div>
  );
}

function EditorRibbon({
  editor,
  onImage,
  onVideo,
}: {
  editor: Editor;
  onImage: () => void;
  onVideo: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const refresh = () => tick((n) => n + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

  const textStyle = editor.getAttributes("textStyle") as {
    fontFamily?: string;
    fontSize?: string;
    lineHeight?: string;
    color?: string;
  };

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const inTable = editor.isActive("table");
  const icon = 16;

  return (
    <div className="tiptap-ribbon-wrap">
      <div className="tiptap-ribbon tiptap-ribbon--primary">
        <RibbonGroup label="Typography">
          <RibbonSelect
            label="Font"
            title="Font family"
            value={textStyle.fontFamily ?? ""}
            options={FONT_FAMILIES}
            onChange={(v) => {
              if (!v) editor.chain().focus().unsetFontFamily().run();
              else editor.chain().focus().setFontFamily(v).run();
            }}
          />
          <RibbonSelect
            label="Size"
            title="Font size"
            value={textStyle.fontSize ?? ""}
            options={FONT_SIZES}
            onChange={(v) => {
              if (!v) editor.chain().focus().unsetFontSize().run();
              else editor.chain().focus().setFontSize(v).run();
            }}
          />
          <RibbonSelect
            label="Leading"
            title="Line height"
            value={textStyle.lineHeight ?? ""}
            options={LINE_HEIGHTS}
            onChange={(v) => {
              if (!v) editor.chain().focus().unsetLineHeight().run();
              else editor.chain().focus().setLineHeight(v).run();
            }}
          />
        </RibbonGroup>

        <RibbonGroup label="History">
          <RibbonBtn onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)" disabled={!editor.can().undo()}>
            <Undo2 size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)" disabled={!editor.can().redo()}>
            <Redo2 size={icon} />
          </RibbonBtn>
        </RibbonGroup>

        <RibbonGroup label="Style">
          <RibbonBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")} title="Paragraph">
            <Pilcrow size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
            <Heading1 size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
            <Heading2 size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
            <Heading3 size={icon} />
          </RibbonBtn>
        </RibbonGroup>

        <RibbonGroup label="Font">
          <RibbonBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
            <Bold size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
            <Italic size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
            <UnderlineIcon size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
            <Strikethrough size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code">
            <Code size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} title="Subscript">
            <SubscriptIcon size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} title="Superscript">
            <SuperscriptIcon size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="Highlight">
            <Highlighter size={icon} />
          </RibbonBtn>
          <label className="tiptap-ribbon-color" title="Text color">
            <span className="tiptap-ribbon-color-swatch" style={{ background: textStyle.color ?? "#1C1917" }} />
            <input
              type="color"
              value={textStyle.color || "#1C1917"}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            />
          </label>
        </RibbonGroup>

        <RibbonGroup label="Lists">
          <RibbonBtn
            onClick={() => applyListToSelection(editor, "bulletList")}
            active={editor.isActive("bulletList")}
            title="Bullet list — select multiple lines to convert"
          >
            <List size={icon} />
          </RibbonBtn>
          <RibbonBtn
            onClick={() => applyListToSelection(editor, "orderedList")}
            active={editor.isActive("orderedList")}
            title="Numbered list — select multiple lines to number them"
          >
            <ListOrdered size={icon} />
          </RibbonBtn>
          <RibbonBtn
            onClick={() => applyListToSelection(editor, "taskList")}
            active={editor.isActive("taskList")}
            title="Checklist"
          >
            <ListChecks size={icon} />
          </RibbonBtn>
          <RibbonBtn
            onClick={() => {
              if (editor.can().sinkListItem("taskItem")) {
                editor.chain().focus().sinkListItem("taskItem").run();
              } else {
                editor.chain().focus().sinkListItem("listItem").run();
              }
            }}
            title="Indent"
            disabled={!editor.can().sinkListItem("taskItem") && !editor.can().sinkListItem("listItem")}
          >
            <IndentIncrease size={icon} />
          </RibbonBtn>
          <RibbonBtn
            onClick={() => {
              if (editor.can().liftListItem("taskItem")) {
                editor.chain().focus().liftListItem("taskItem").run();
              } else {
                editor.chain().focus().liftListItem("listItem").run();
              }
            }}
            title="Outdent"
            disabled={!editor.can().liftListItem("taskItem") && !editor.can().liftListItem("listItem")}
          >
            <IndentDecrease size={icon} />
          </RibbonBtn>
        </RibbonGroup>

        <RibbonGroup label="Align">
          <RibbonBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left">
            <AlignLeft size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center">
            <AlignCenter size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right">
            <AlignRight size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justify">
            <AlignJustify size={icon} />
          </RibbonBtn>
        </RibbonGroup>
      </div>

      <div className="tiptap-ribbon tiptap-ribbon--secondary">
        <RibbonGroup label="Insert">
          <RibbonBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">
            <Quote size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block">
            <Code2 size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
            <Minus size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={setLink} active={editor.isActive("link")} title="Link">
            <Link2 size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={onImage} title="Image">
            <ImageIcon size={icon} />
          </RibbonBtn>
          <RibbonBtn onClick={onVideo} title="Video">
            <Video size={icon} />
          </RibbonBtn>
        </RibbonGroup>

        <RibbonGroup label="Table">
          <RibbonBtn
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title="Insert 3×3 table"
          >
            <Table2 size={icon} />
          </RibbonBtn>
          <RibbonBtn
            onClick={() => editor.chain().focus().addRowBefore().run()}
            title="Add row above"
            disabled={!inTable}
          >
            <Rows size={icon} />
          </RibbonBtn>
          <RibbonBtn
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add row below"
            disabled={!inTable}
          >
            <Rows size={icon} style={{ transform: "scaleY(-1)" }} />
          </RibbonBtn>
          <RibbonBtn
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            title="Add column left"
            disabled={!inTable}
          >
            <Columns size={icon} />
          </RibbonBtn>
          <RibbonBtn
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add column right"
            disabled={!inTable}
          >
            <Columns size={icon} style={{ transform: "scaleX(-1)" }} />
          </RibbonBtn>
          <RibbonBtn
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete table"
            disabled={!inTable}
          >
            <Trash2 size={icon} />
          </RibbonBtn>
        </RibbonGroup>

        <RibbonGroup label="Clear">
          <RibbonBtn
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            title="Clear formatting"
          >
            <RemoveFormatting size={icon} />
          </RibbonBtn>
        </RibbonGroup>
      </div>
    </div>
  );
}

function BubbleToolbar({ editor }: { editor: Editor }) {
  const icon = 15;
  return (
    <BubbleMenu editor={editor} className="tiptap-bubble-menu">
      <RibbonBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
        <Bold size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
        <Italic size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
        <UnderlineIcon size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strike">
        <Strikethrough size={icon} />
      </RibbonBtn>
      <RibbonBtn
        onClick={() => {
          const url = window.prompt("Link URL");
          if (url?.trim()) editor.chain().focus().setLink({ href: url.trim() }).run();
        }}
        active={editor.isActive("link")}
        title="Link"
      >
        <Link2 size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => applyListToSelection(editor, "bulletList")} active={editor.isActive("bulletList")} title="Bullet list">
        <List size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => applyListToSelection(editor, "orderedList")} active={editor.isActive("orderedList")} title="Numbered list">
        <ListOrdered size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="Highlight">
        <Highlighter size={icon} />
      </RibbonBtn>
    </BubbleMenu>
  );
}

function TableBubbleToolbar({ editor }: { editor: Editor }) {
  const icon = 15;
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableBubbleMenu"
      className="tiptap-bubble-menu tiptap-bubble-menu--table"
      shouldShow={({ editor: ed }) => ed.isActive("table")}
    >
      <RibbonBtn onClick={() => editor.chain().focus().addRowBefore().run()} title="Row above">
        <Rows size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Row below">
        <Rows size={icon} style={{ transform: "scaleY(-1)" }} />
      </RibbonBtn>
      <RibbonBtn onClick={() => editor.chain().focus().addColumnBefore().run()} title="Col left">
        <Columns size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Col right">
        <Columns size={icon} style={{ transform: "scaleX(-1)" }} />
      </RibbonBtn>
      <RibbonBtn onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">
        <Trash2 size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">
        <Table2 size={icon} />
      </RibbonBtn>
    </BubbleMenu>
  );
}

function FloatingInsertMenu({
  editor,
  onImage,
}: {
  editor: Editor;
  onImage: () => void;
}) {
  const icon = 15;
  return (
    <FloatingMenu
      editor={editor}
      className="tiptap-floating-menu"
      shouldShow={({ state }) => {
        const { $from } = state.selection;
        const isRootDepth = $from.depth === 1;
        const isEmptyTextblock = $from.parent.isTextblock && $from.parent.content.size === 0;
        return isRootDepth && isEmptyTextblock && $from.parent.type.name === "paragraph";
      }}
    >
      <span className="tiptap-floating-menu-label">Insert</span>
      <RibbonBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
        <Heading1 size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
        <Heading2 size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => applyListToSelection(editor, "bulletList")} title="Bullet list">
        <List size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => applyListToSelection(editor, "orderedList")} title="Numbered list">
        <ListOrdered size={icon} />
      </RibbonBtn>
      <RibbonBtn
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="Table"
      >
        <Table2 size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={onImage} title="Image">
        <ImageIcon size={icon} />
      </RibbonBtn>
      <RibbonBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">
        <Quote size={icon} />
      </RibbonBtn>
    </FloatingMenu>
  );
}

export function TipTapEditor({ value, onChange, placeholder, variant = "default" }: TipTapEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [stats, setStats] = useState({ words: 0, chars: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        heading: false,
        blockquote: {},
        bulletList: {},
        orderedList: {},
        code: {},
        codeBlock: {},
        horizontalRule: {},
        dropcursor: { color: "#C8960C", width: 2 },
        gapcursor: {},
      }),
      DraggableParagraph,
      DraggableHeading.configure({ levels: [1, 2, 3] }),
      Underline,
      Subscript,
      Superscript,
      TextStyle,
      FontFamily,
      FontSize,
      LineHeight,
      Color,
      Highlight.configure({ multicolor: false }),
      Typography,
      TextAlign.configure({ types: ["heading", "paragraph", "tableCell", "tableHeader"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      UploadedImage,
      UploadedVideo,
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing… Paste from Word, Google Docs, or any rich source.",
        emptyEditorClass: "is-editor-empty",
      }),
      Link.configure({
        openOnClick: false,
        protocols: ["http", "https", "mailto"],
        validate: (href) => !/^javascript:/i.test(href),
      }),
      CharacterCount.configure(),
    ],
    content: value || "",
    onUpdate({ editor: ed }) {
      onChange(ed.getHTML());
      setStats({
        words: ed.storage.characterCount.words(),
        chars: ed.storage.characterCount.characters(),
      });
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor-content",
        "data-testid": "tiptap-editor",
      },
      transformPastedHTML(html) {
        return sanitizePastedHtml(html);
      },
    },
  });

  useEffect(() => {
    if (editor && value === "" && editor.getText() !== "") {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor) {
      setStats({
        words: editor.storage.characterCount.words(),
        chars: editor.storage.characterCount.characters(),
      });
    }
  }, [editor]);

  if (!editor) return null;

  const insertImage = async (file: File) => {
    try {
      const { url } = await uploadMedia(file);
      editor.chain().focus().insertContent({ type: "image", attrs: { src: url, alt: file.name } }).run();
      toast({ title: "Image inserted" });
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const insertVideo = async (file: File) => {
    try {
      const { url } = await uploadMedia(file);
      editor.chain().focus().insertContent({ type: "videoEmbed", attrs: { src: url } }).run();
      toast({ title: "Video inserted" });
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  return (
    <div className={`tiptap-editor-shell${variant === "composer" ? " tiptap-editor-shell--composer" : ""}`}>
      <EditorRibbon editor={editor} onImage={() => imageInputRef.current?.click()} onVideo={() => videoInputRef.current?.click()} />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void insertImage(f);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void insertVideo(f);
          e.target.value = "";
        }}
      />

      <BubbleToolbar editor={editor} />
      <TableBubbleToolbar editor={editor} />

      <div className="tiptap-editor-body tiptap-editor-body--draggable">
        <FloatingInsertMenu editor={editor} onImage={() => imageInputRef.current?.click()} />
        <EditorContent editor={editor} />
      </div>

      <div className="tiptap-editor-footer">
        <span>{stats.words} words</span>
        <span className="tiptap-editor-footer-dot">·</span>
        <span>{stats.chars} characters</span>
        <span className="tiptap-editor-footer-hint">· Drag blocks via ⋮⋮ grip · Select lines + number them</span>
      </div>
    </div>
  );
}
