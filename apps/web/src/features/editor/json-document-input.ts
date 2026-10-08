import { z } from "zod";

import { fieldKeys, isIdentifiedJson, projectionSchema, type JsonValue } from "./document-model";

// Accept the dashboard projection, a CLI work document, or an array of work documents.
// The original input remains available so formatting never rewrites its chosen shape.
type EditorDocumentInput =
  | { raw: JsonValue; projection: ReturnType<typeof projectionSchema.safeParse> }
  | { error: string };
export function readEditorDocument(text: string): EditorDocumentInput {
  try {
    const raw = z.json().parse(JSON.parse(text));
    const records = Array.isArray(raw) ? raw : isIdentifiedJson(raw) ? [raw] : null;
    const projection = records
      ? {
          schemaVersion: 1,
          fields: fieldKeys.filter((key) =>
            records.some((record) => isIdentifiedJson(record) && Object.hasOwn(record, key)),
          ),
          records,
        }
      : raw;
    return { raw, projection: projectionSchema.safeParse(projection) };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "تعذّر قراءة JSON." };
  }
}
export function jsonIssueKey(path: PropertyKey[], code: string, message: string) {
  return JSON.stringify([path, code, message]);
}
