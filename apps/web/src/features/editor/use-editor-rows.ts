import { useState } from "react";

import { equalValue, type DocumentValue } from "./document-model";

type EditorRow<T> = { key: string; value: T };
// Client-only identities belong to the editing session, never to the catalog document.
// Match unchanged values first so insertion, removal and reordering preserve field focus.
export function useEditorRows<T extends DocumentValue>(values: readonly T[]) {
  const [rows, setRows] = useState<EditorRow<T>[]>(() =>
    values.map((value) => ({ key: crypto.randomUUID(), value })),
  );
  if (
    equalValue(
      rows.map((row) => row.value),
      [...values],
    )
  )
    return rows;
  const available = [...rows];
  const matches = values.map((value) => {
    const match = available.find((row) => equalValue(row.value, value));
    if (match) available.splice(available.indexOf(match), 1);
    return match;
  });
  const next = values.map((value, position) => {
    const matched = matches[position];
    if (matched) return { key: matched.key, value };
    const previous = rows[position];
    const replacement = previous && available.includes(previous) ? previous : available[0];
    if (replacement) available.splice(available.indexOf(replacement), 1);
    return { key: replacement?.key ?? crypto.randomUUID(), value };
  });
  setRows(next);
  return next;
}
