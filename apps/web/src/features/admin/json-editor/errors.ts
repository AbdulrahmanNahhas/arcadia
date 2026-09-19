import { ZodError, type z } from "zod";

/**
 * One thing that is wrong with the document, in words an editor can act on: where (path), what
 * (Arabic), the offending value when it can be found, and where to jump in the text.
 */
export interface EditorIssue {
  path: string;
  message: string;
  received: string | null;
  /** Character range of the offending value in the JSON text, when it could be located. */
  range: [number, number] | null;
}

export interface EditorError {
  summary: string;
  issues: EditorIssue[];
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function isScalar(value: JsonValue | undefined): value is string | number {
  return (
    value !== undefined &&
    value !== null &&
    !Array.isArray(value) &&
    !isRecord(value) &&
    value !== true &&
    value !== false
  );
}

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Walks `path` inside `root`; `undefined` when any step is missing. */
function valueAt(root: JsonValue, path: ReadonlyArray<string | number>): JsonValue | undefined {
  let current: JsonValue | undefined = root;
  for (const step of path) {
    if (current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(step);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (isRecord(current)) {
      current = current[String(step)];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * The document is a list of records; Zod paths may be relative to one record (the per-record
 * schema) rather than to the whole document. Try the path as given, then inside each record.
 */
function findReceived(root: JsonValue | null, path: ReadonlyArray<string | number>) {
  if (root === null) return undefined;
  const direct = valueAt(root, path);
  if (direct !== undefined) return direct;
  const records =
    isRecord(root) && Array.isArray(root.records) ? root.records : Array.isArray(root) ? root : [];
  for (const record of records) {
    const inRecord =
      valueAt(record, path) ?? (isRecord(record) ? valueAt(record.work ?? null, path) : undefined);
    if (inRecord !== undefined) return inRecord;
  }
  return undefined;
}

function arabicList(values: readonly unknown[]) {
  return values.map((value) => `«${String(value)}»`).join("، ");
}

function describeIssue(issue: z.core.$ZodIssue, received: JsonValue | undefined): string {
  switch (issue.code) {
    case "invalid_value":
      return `القيمة${received !== undefined ? ` «${String(received)}»` : ""} ليست من الخيارات المسموحة. المسموح: ${arabicList(issue.values)}.`;
    case "invalid_type":
      return `النوع غير صحيح: متوقع ${issue.expected}${received !== undefined ? `، ووُجد ${JSON.stringify(received)}` : ""}.`;
    case "too_small":
      return `أصغر من الحد الأدنى (${String(issue.minimum)}).`;
    case "too_big":
      return `أكبر من الحد الأقصى (${String(issue.maximum)}).`;
    case "invalid_format":
      return `الصيغة غير صحيحة (${issue.format})${received !== undefined ? `: «${String(received)}»` : ""}.`;
    case "unrecognized_keys":
      return `مفاتيح غير معروفة: ${arabicList(issue.keys)}. احذفها أو صحّح اسمها.`;
    case "invalid_union":
      return "القيمة لا تطابق أياً من الأشكال المقبولة لهذا الحقل.";
    default:
      return issue.message;
  }
}

/** Where a value sits in the text: the first occurrence of its JSON form after its last key. */
function locate(
  text: string,
  path: ReadonlyArray<string | number>,
  received: JsonValue | undefined,
): [number, number] | null {
  // The last object key on the path (array indices are numbers).
  const lastStep = path.toReversed().find((step) => !Number.isInteger(Number(step)));
  const lastKey = lastStep === undefined ? null : String(lastStep);
  const keyIndex = lastKey ? text.indexOf(`"${lastKey}"`) : -1;
  if (isScalar(received)) {
    const needle = JSON.stringify(received);
    const from = text.indexOf(needle, keyIndex >= 0 ? keyIndex : 0);
    if (from >= 0) return [from, from + needle.length];
  }
  if (lastKey && keyIndex >= 0) return [keyIndex, keyIndex + lastKey.length + 2];
  return null;
}

/**
 * Turns whatever the editor caught — a Zod error, a JSON syntax error, a plain message — into
 * something readable. The raw `ZodError.message` is a JSON dump of the issues, which is what the
 * page used to show verbatim.
 */
/** What a `catch` hands us: the editor throws `ZodError`s, `JSON.parse` throws `SyntaxError`s,
 *  and the merge step throws plain `Error`s with a ready sentence. */
export type CaughtEditorError = ZodError | SyntaxError | Error | string;

export function describeEditorError(caught: CaughtEditorError, jsonText: string): EditorError {
  let root: JsonValue | null = null;
  try {
    root = JSON.parse(jsonText);
  } catch {
    root = null;
  }
  if (caught instanceof ZodError) {
    const issues = caught.issues.map((issue): EditorIssue => {
      // JSON documents have no symbol keys; Zod's path type merely allows them.
      const path = issue.path.filter((step): step is string | number => typeof step !== "symbol");
      const received = findReceived(root, path);
      return {
        path: path.map(String).join(" › ") || "(الجذر)",
        message: describeIssue(issue, received),
        received: received === undefined ? null : JSON.stringify(received),
        range: locate(jsonText, path, received),
      };
    });
    return {
      summary: `${issues.length === 1 ? "مشكلة واحدة" : `${issues.length} مشكلات`} في المستند — لم يُحفظ شيء.`,
      issues,
    };
  }
  if (caught instanceof SyntaxError) {
    // V8 says either "… at position N" (older) or quotes the offending context
    // ("Unexpected token '}', ...\"<context>\" is not valid JSON"); locate the context in the text.
    const position = caught.message.match(/position (\d+)/)?.[1];
    const context = caught.message.match(/(?:\.\.\.)?"([\s\S]*)" is not valid JSON$/)?.[1];
    const contextOffset = context ? jsonText.indexOf(context) : -1;
    const offset = position
      ? Number(position)
      : context && contextOffset >= 0
        ? contextOffset + context.length - 1
        : null;
    const line = offset !== null ? jsonText.slice(0, offset).split("\n").length : null;
    return {
      summary: `JSON غير صالح${line !== null ? ` قرب السطر ${line}` : ""}: ${caught.message}`,
      issues:
        offset !== null
          ? [
              {
                path: `السطر ${line}`,
                message: "تحقق من الفواصل والأقواس وعلامات الاقتباس هنا.",
                received: null,
                range: [offset, Math.min(jsonText.length, offset + 1)],
              },
            ]
          : [],
    };
  }
  return {
    summary: caught instanceof Error ? caught.message : caught || "JSON غير صالح",
    issues: [],
  };
}
