import { json, jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useMemo, useState } from "react";

const editorSetup = {
  foldGutter: true,
  searchKeymap: true,
  bracketMatching: true,
  closeBrackets: true,
  highlightSelectionMatches: true,
  autocompletion: true,
};
const noSuggestions: readonly string[] = [];

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  suggestions?: readonly string[];
}
export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  suggestions = noSuggestions,
}: CodeEditorProps) {
  const [theme] = useState<"dark" | "light">(() =>
    document.body.classList.contains("dark") || document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );
  const extensions = useMemo(
    () => [
      json(),
      jsonLanguage.data.of({
        autocomplete: (context: {
          matchBefore: (pattern: RegExp) => { from: number; text: string } | null;
          explicit: boolean;
        }) => {
          const word = context.matchBefore(/"[A-Za-z][A-Za-z0-9]*|[A-Za-z][A-Za-z0-9]*/);
          if (!word || (!context.explicit && word.text.length < 2)) return null;
          return {
            from: word.from + (word.text.startsWith('"') ? 1 : 0),
            options: suggestions.map((label) => ({ label, type: "property" })),
          };
        },
      }),
      linter(jsonParseLinter()),
      lintGutter(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": "محرر مسودة JSON" }),
    ],
    [suggestions],
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
