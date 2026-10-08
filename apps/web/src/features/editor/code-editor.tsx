import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useMemo, useState } from "react";

const editorSetup = { foldGutter: true, searchKeymap: true };

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}
export function CodeEditor({ value, onChange, readOnly = false }: CodeEditorProps) {
  const [theme] = useState<"dark" | "light">(() =>
    document.body.classList.contains("dark") || document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );
  const extensions = useMemo(
    () => [
      json(),
      linter(jsonParseLinter()),
      lintGutter(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": "محرر مسودة JSON" }),
    ],
    [],
  );
  return (
    <div dir="ltr" className="overflow-hidden rounded-lg border">
      <CodeMirror
        value={value}
        editable={!readOnly}
        onChange={onChange}
        extensions={extensions}
        height="420px"
        theme={theme}
        basicSetup={editorSetup}
        aria-label="محرر مسودة JSON"
      />
    </div>
  );
}
