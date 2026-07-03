import type { Editor } from "@tiptap/core";

export type ListKind = "bulletList" | "orderedList" | "taskList";

function toggleEmptyList(editor: Editor, listType: ListKind) {
  if (listType === "orderedList") editor.chain().focus().toggleOrderedList().run();
  else if (listType === "bulletList") editor.chain().focus().toggleBulletList().run();
  else editor.chain().focus().toggleTaskList().run();
}

/** Apply bullet/numbered/checklist to selection — including multi-line text blocks. */
export function applyListToSelection(editor: Editor, listType: ListKind) {
  const { state } = editor;
  const { from, to, empty } = state.selection;

  if (empty) {
    toggleEmptyList(editor, listType);
    return;
  }

  const listItemType = listType === "taskList" ? "taskItem" : "listItem";
  const text = state.doc.textBetween(from, to, "\n", "\n");

  if (text.includes("\n")) {
    const lines = text.split("\n");
    const content = lines.map((line) => ({
      type: listItemType,
      ...(listType === "taskList" ? { attrs: { checked: false } } : {}),
      content: [
        {
          type: "paragraph",
          content: line.trim() ? [{ type: "text", text: line }] : [],
        },
      ],
    }));

    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, { type: listType, content })
      .run();
    return;
  }

  let blockCount = 0;
  state.doc.nodesBetween(from, to, (node, _pos, parent) => {
    if (node.isBlock && parent === state.doc) blockCount++;
  });

  if (blockCount > 1) {
    toggleEmptyList(editor, listType);
    return;
  }

  if (editor.can().wrapInList(listItemType)) {
    editor.chain().focus().wrapInList(listItemType).run();
    if (listType === "orderedList" && !editor.isActive("orderedList")) {
      editor.chain().focus().toggleOrderedList().run();
    } else if (listType === "taskList" && !editor.isActive("taskList")) {
      editor.chain().focus().toggleTaskList().run();
    }
    return;
  }

  toggleEmptyList(editor, listType);
}
