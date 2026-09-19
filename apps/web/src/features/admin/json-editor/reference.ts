import { ageSchema, riskValues, taxonomy, titleKinds } from "@arcadia/domain";
import {
  audiences,
  countries,
  genres,
  tones,
  workflowStatusValues,
} from "@/features/library/model";

/**
 * The allowed values behind the enum-ish JSON fields, in the exact form the document expects
 * (English labels for genres/tones/countries, slugs for kinds), so an editor — or an assistant
 * the editor pastes them to — never has to guess from a validation error.
 */
export interface ReferenceList {
  key: string;
  label: string;
  field: string;
  values: readonly string[];
  note?: string;
}

export const referenceLists: ReferenceList[] = [
  { key: "kind", label: "النوع", field: "kind", values: titleKinds },
  { key: "genres", label: "التصنيفات", field: "genres", values: genres },
  { key: "tones", label: "الطابع", field: "tone", values: tones },
  {
    key: "tags",
    label: "الوسوم (المعتمدة)",
    field: "tags",
    values: taxonomy.tags.map(([, en]) => en),
    note: "حرّة النص، لكن هذه هي المعتمدة في الأرشيف.",
  },
  { key: "countries", label: "الدول", field: "country", values: countries },
  { key: "audiences", label: "الجمهور", field: "audience", values: audiences },
  { key: "ages", label: "تصنيف السن", field: "age", values: ageSchema.options },
  {
    key: "risks",
    label: "مستويات المخاطر",
    field: "risks.sexuality / behavioral / theology",
    values: riskValues,
  },
  {
    key: "workflow",
    label: "حالة سير العمل",
    field: "workflowStatus",
    values: workflowStatusValues,
  },
  {
    key: "releaseStatus",
    label: "حالة الإصدار (للأجزاء)",
    field: "installments[].status",
    values: ["announced", "airing", "completed", "unknown"],
  },
  {
    key: "installmentKind",
    label: "نوع الجزء",
    field: "installments[].kind",
    values: ["season", "movie", "special"],
  },
];

export function referenceAsMarkdown(lists: readonly ReferenceList[] = referenceLists) {
  const lines = ["## Allowed values", ""];
  for (const list of lists) {
    lines.push(`### ${list.field} — ${list.label}`);
    if (list.note) lines.push(list.note);
    lines.push(JSON.stringify(list.values));
    lines.push("");
  }
  return lines.join("\n");
}
