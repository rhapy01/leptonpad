---
name: TipTap with react-hook-form
description: Pattern for wiring TipTap rich-text editor into a react-hook-form controlled form field.
---

TipTap is uncontrolled — it manages its own state internally. To sync with react-hook-form:

1. **On content change:** use TipTap's `onUpdate` callback to call `form.setValue("body", editor.getHTML())`.
2. **On form reset:** add a `useEffect` that calls `editor.commands.clearContent()` when the form value is cleared to `""`.
3. **Initial value:** pass `content: value || ""` to `useEditor` — TipTap only reads this on mount, so treat it as defaultValue not a controlled prop.

```tsx
const editor = useEditor({
  content: initialValue || "",
  onUpdate({ editor }) {
    onChange(editor.getHTML());
  },
});

useEffect(() => {
  if (editor && value === "" && editor.getText() !== "") {
    editor.commands.clearContent();
  }
}, [value, editor]);
```

**Why:** TipTap does not re-render when `content` prop changes after mount. Treating it like a controlled input will cause sync issues and stale content bugs.
