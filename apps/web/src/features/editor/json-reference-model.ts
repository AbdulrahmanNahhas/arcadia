import type { DatabaseTable } from "@/features/database/database-model";

import type { WorkField } from "./document-model";
import type { StructureScope } from "./json-projection";
import type { JsonVocabulary } from "./json-reference.functions";

type EnumBinding = {
  field: WorkField;
  path: string;
  table: string;
  column: string;
  label: string;
  nestedKey?: string;
};
const enumBindings: readonly EnumBinding[] = [
  { field: "format", path: "format", table: "titles", column: "format", label: "الصيغة" },
  { field: "audience", path: "audience", table: "titles", column: "audience", label: "الجمهور" },
  { field: "age", path: "age", table: "titles", column: "age", label: "تصنيف السن" },
  {
    field: "sexualityRisk",
    path: "sexualityRisk",
    table: "titles",
    column: "sexuality_risk",
    label: "المحتوى الجنسي",
  },
  {
    field: "behavioralRisk",
    path: "behavioralRisk",
    table: "titles",
    column: "behavioral_risk",
    label: "المحتوى السلوكي",
  },
  {
    field: "theologyRisk",
    path: "theologyRisk",
    table: "titles",
    column: "theology_risk",
    label: "المحتوى العقدي",
  },
  {
    field: "workflowStatus",
    path: "workflowStatus",
    table: "titles",
    column: "workflow_status",
    label: "حالة النشر",
  },
  {
    field: "installments",
    path: "installments[].kind",
    table: "installments",
    column: "kind",
    label: "نوع الجزء",
    nestedKey: "kind",
  },
  {
    field: "installments",
    path: "installments[].status",
    table: "installments",
    column: "status",
    label: "حالة عرض الجزء",
    nestedKey: "status",
  },
  {
    field: "installments",
    path: "installments[].audienceOverride",
    table: "installments",
    column: "audience_override",
    label: "جمهور الجزء",
    nestedKey: "audienceOverride",
  },
  {
    field: "installments",
    path: "installments[].ageOverride",
    table: "installments",
    column: "age_override",
    label: "سن الجزء",
    nestedKey: "ageOverride",
  },
  {
    field: "installments",
    path: "installments[].sexualityRiskOverride",
    table: "installments",
    column: "sexuality_risk_override",
    label: "المحتوى الجنسي للجزء",
    nestedKey: "sexualityRiskOverride",
  },
  {
    field: "installments",
    path: "installments[].behavioralRiskOverride",
    table: "installments",
    column: "behavioral_risk_override",
    label: "المحتوى السلوكي للجزء",
    nestedKey: "behavioralRiskOverride",
  },
  {
    field: "installments",
    path: "installments[].theologyRiskOverride",
    table: "installments",
    column: "theology_risk_override",
    label: "المحتوى العقدي للجزء",
    nestedKey: "theologyRiskOverride",
  },
  {
    field: "relations",
    path: "relations[].kind",
    table: "title_relations",
    column: "kind",
    label: "نوع العلاقة",
  },
  {
    field: "awards",
    path: "awards[].result",
    table: "award_recognitions",
    column: "result",
    label: "نتيجة الجائزة",
  },
];

export function selectedEnumReferences(
  tables: DatabaseTable[],
  fields: WorkField[],
  scope: StructureScope,
) {
  return enumBindings
    .filter(
      (binding) =>
        fields.includes(binding.field) &&
        (!binding.nestedKey || scope.installments.includes(binding.nestedKey)),
    )
    .flatMap((binding) => {
      const column = tables
        .find((table) => table.name === binding.table)
        ?.columns.find((candidate) => candidate.name === binding.column);
      return column?.enum_values.length
        ? [
            {
              path: binding.path,
              label: binding.label,
              databaseColumn: `${binding.table}.${binding.column}`,
              nullable: column.nullable,
              values: column.enum_values,
            },
          ]
        : [];
    });
}

const vocabularyBindings = [
  { field: "genres", table: "genres", path: "genres[]", label: "التصنيفات" },
  { field: "tones", table: "tones", path: "tones[]", label: "الطابع" },
  { field: "tags", table: "tags", path: "tags[]", label: "الوسوم" },
  { field: "countries", table: "countries", path: "countries[]", label: "الدول" },
  { field: "planets", table: "planets", path: "planets[]", label: "الكواكب" },
  { field: "credits", table: "roles", path: "credits[].role", label: "أدوار المساهمات" },
] as const satisfies readonly {
  field: WorkField;
  table: JsonVocabulary;
  path: string;
  label: string;
}[];

export function selectedVocabularyReferences(fields: WorkField[]) {
  return vocabularyBindings.filter((binding) => fields.includes(binding.field));
}
