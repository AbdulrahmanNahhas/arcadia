import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import CodeMirror, { EditorView, keymap, type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useTheme } from "@/lib/theme";

/** What the page needs from the editor beyond `value`/`onChange`: focus and a selection jump. */
export interface CodeEditorHandle {
  focus: () => void;
  /** Selects `[from, to)` and scrolls it into view — the page's own "find next". */
  select: (from: number, to: number) => void;
  /** Current selection end, so "find next" continues from the caret. */
  selectionEnd: () => number;
}

/**
 * The JSON editor's text surface: CodeMirror with JSON highlighting, line numbers, folding,
 * bracket matching, Ctrl+F search, and the parse error marked on its line — instead of a bare
 * `<textarea>` where a missing comma in line 400 was a guessing game. Loaded lazily by the page
 * (it is the one heavy dependency on this route). Ctrl/⌘+Enter hands off to `onSubmit`.
 */
export const CodeEditor = forwardRef<
  CodeEditorHandle,
  {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: () => void;
    readOnly?: boolean;
    ariaLabel: string;
  }
>(function CodeEditor({ value, onChange, onSubmit, readOnly = false, ariaLabel }, ref) {
  const inner = useRef<ReactCodeMirrorRef>(null);
  const { resolved } = useTheme();
  useImperativeHandle(ref, () => ({
    focus: () => inner.current?.view?.focus(),
    select: (from, to) => {
      const view = inner.current?.view;
      if (!view) return;
      view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true });
      view.focus();
    },
    selectionEnd: () => inner.current?.view?.state.selection.main.to ?? 0,
  }));
  const extensions = useMemo(
    () => [
      json(),
      linter(jsonParseLinter()),
      lintGutter(),
      EditorView.lineWrapping,
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            onSubmit?.();
            return true;
          },
        },
      ]),
    ],
    [onSubmit],
  );
  return (
    <div
      dir="ltr"
      className="min-h-0 flex-1 overflow-hidden text-left [&_.cm-editor]:h-full [&_.cm-editor]:text-xs [&_.cm-scroller]:font-mono [&_.cm-scroller]:leading-5"
    >
      <CodeMirror
        ref={inner}
        value={value}
        height="100%"
        theme={resolved === "dark" ? "dark" : "light"}
        extensions={extensions}
        readOnly={readOnly}
        onChange={onChange}
        basicSetup={{ foldGutter: true, highlightActiveLine: true, searchKeymap: true }}
        aria-label={ariaLabel}
        className="h-full"
      />
    </div>
  );
});
