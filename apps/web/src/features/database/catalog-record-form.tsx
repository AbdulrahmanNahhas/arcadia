import { useMutation, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useId, useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { JsonValue } from "@/features/editor/document-model";
import { ReferenceField } from "@/features/editor/reference-field";
import { SelectField, TextField } from "@/features/editor/work-fields";

import { CatalogAssetField } from "./catalog-asset-field";
import { validateCatalogJson } from "./catalog-json";
import { rowSchema, type DatabaseRow, type DatabaseTable } from "./database-model";
import { mutateDatabaseRecord } from "./database.functions";
import { databaseKeys } from "./database.queries";

const CodeEditor = lazy(() =>
  import("@/features/editor/code-editor").then((module) => ({ default: module.CodeEditor })),
);

const JsonTreeEditor = lazy(() =>
  import("@/features/editor/json-tree-editor").then((module) => ({
    default: module.JsonTreeEditor,
  })),
);

const labels = {
  name: "الاسم",
  sort_name: "اسم الترتيب",
  description: "الوصف",
  name_ar: "الاسم العربي",
  name_en: "الاسم الإنجليزي",
  slug: "المعرّف المختصر",
  icon: "الأيقونة",
  primary_color: "اللون الأساسي",
  secondary_color: "اللون الثانوي",
  display_order: "ترتيب العرض",
  is_active: "نشط",
  alias: "الاسم البديل",
  language: "اللغة",
  title_id: "العمل",
  role_id: "الدور",
  position: "ترتيب المساهمة",
  is_primary: "مساهمة رئيسية",
  featured_rank: "ترتيب العمل المميز",
  source_id: "المؤسسة الأولى",
  target_id: "المؤسسة الثانية",
  relation_type: "نوع العلاقة",
  occurred_on: "تاريخ العلاقة",
  role: "نوع الصورة",
  asset_id: "الصورة",
  entity_id: "الكيان",
  planet_id: "العالم",
} satisfies Record<string, string>;

const hints = {
  slug: "معرّف ثابت للروابط والبحث. استخدم أحرفاً لاتينية وأرقاماً وشرطات.",
  icon: "اسم رمز قصير يساعد على تمييز هذا العالم.",
  primary_color: "اكتب اللون بصيغة HEX مثل #1b5ad7.",
  secondary_color: "اكتب اللون بصيغة HEX مثل #5d718a.",
  display_order: "الأرقام الأقل تظهر أولاً.",
  position: "ترتيب هذه المساهمة ضمن العمل.",
  is_primary: "حدّدها إذا كانت هذه هي المساهمة الأساسية.",
  featured_rank: "اتركه فارغاً إذا لم يكن العمل مميزاً.",
  occurred_on: "تاريخ بدء العلاقة أو حدوثها، إن كان معروفاً.",
} satisfies Record<string, string>;

const emptyDefaults = rowSchema.parse({});
const emptyHidden: string[] = [];

const references = {
  title_id: "titles",
  role_id: "roles",
  source_id: "entities",
  target_id: "entities",
  entity_id: "entities",
  planet_id: "planets",
} as const;

function referenceFor(name: string) {
  return Object.entries(references).find(([key]) => key === name)?.[1];
}

function initialDraft(
  row: DatabaseRow | null,
  defaults: DatabaseRow,
  editable: DatabaseTable["columns"],
): DatabaseRow {
  if (row) {
    return rowSchema.parse(
      Object.fromEntries(editable.map((column) => [column.name, row[column.name] ?? null])),
    );
  }

  const requiredValues = Object.fromEntries(
    editable
      .filter((column) => !column.default_value && !column.nullable)
      .map((column) => [
        column.name,
        column.data_type === "bool" ? false : column.data_type.includes("int") ? 0 : "",
      ]),
  );
  return rowSchema.parse({ ...requiredValues, ...defaults });
}

export function CatalogRecordForm({
  table,
  row,
  defaults = emptyDefaults,
  hidden = emptyHidden,
  onSaved,
  onCancel,
}: {
  table: DatabaseTable;
  row: DatabaseRow | null;
  defaults?: DatabaseRow;
  hidden?: string[];
  onSaved: (row: DatabaseRow) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const editable = table.columns.filter(
    (column) =>
      !column.generated &&
      (row ? !column.primary : !column.primary || !column.default_value) &&
      !["created_at", "updated_at"].includes(column.name),
  );
  const entityKindLocked =
    table.name === "entities" && editable.some((column) => column.name === "kind");
  const lockedNames = new Set([...hidden, ...(entityKindLocked ? ["kind"] : [])]);
  const initial = initialDraft(row, defaults, editable);
  const [draft, setDraft] = useState<DatabaseRow>(() => initial);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("fields");
  const [jsonText, setJsonText] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const client = useQueryClient();
  const jsonFields = Object.fromEntries(
    Object.entries(draft).filter(([key]) => !lockedNames.has(key)),
  );
  const jsonKeys = editable.map((column) => column.name).filter((key) => !lockedNames.has(key));

  function change(key: string, value: JsonValue) {
    setDraft((current) => rowSchema.parse({ ...current, [key]: value }));
    setError(null);
    setJsonText(null);
    setJsonError(null);
  }

  function changeJson(next: JsonValue) {
    try {
      const parsed = validateCatalogJson(next, editable, lockedNames);
      setDraft((current) => {
        const preservedLocked = Object.fromEntries(
          [...lockedNames].flatMap((key) => {
            const value = current[key];
            return value === undefined ? [] : [[key, value] as const];
          }),
        );
        return { ...preservedLocked, ...parsed };
      });
      setError(null);
      setJsonError(null);
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "صيغة المسودة غير صالحة.";
      if (activeTab === "json") setJsonError(message);
      else setError(message);
      return false;
    }
  }

  function changeJsonText(text: string) {
    setJsonText(text);
    try {
      changeJson(rowSchema.parse(JSON.parse(text)));
    } catch (cause) {
      setJsonError(cause instanceof Error ? cause.message : "صيغة JSON غير صالحة.");
    }
  }

  const save = useMutation({
    mutationFn: () => {
      if (jsonError) throw new Error("صحّح مسودة JSON قبل الحفظ أو تجاهل النص غير الصالح.");
      if (jsonText !== null) validateCatalogJson(JSON.parse(jsonText), editable, lockedNames);
      if (!row)
        for (const column of editable) {
          if (!column.nullable && !column.default_value && !Object.hasOwn(draft, column.name))
            throw new Error(`${column.name}: الحقل مطلوب لإنشاء السجل.`);
        }
      const allowed = new Set(editable.map((column) => column.name));
      for (const key of Object.keys(draft)) {
        if (!allowed.has(key)) throw new Error(`حقل غير قابل للتحرير: ${key}`);
      }
      const unchangedLockedField = [...lockedNames].every(
        (key) => !Object.hasOwn(initial, key) || draft[key] === initial[key],
      );
      if (!unchangedLockedField)
        throw new Error("لا يمكن تغيير هوية السجل أو العلاقة من هذه النافذة.");
      const key = Object.fromEntries(
        table.columns
          .filter((column) => column.primary)
          .map((column) => [column.name, row?.[column.name] ?? null]),
      );
      return mutateDatabaseRecord({
        data: {
          table: table.name,
          operation: row ? "update" : "create",
          values: rowSchema.parse(draft),
          key: row ? key : {},
          original: row ?? undefined,
        },
      });
    },
    onSuccess: async (saved) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: databaseKeys.records(table.name) }),
        client.invalidateQueries({ queryKey: ["database", "catalog"] }),
      ]);
      onSaved(saved);
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <div className="flex flex-col gap-4">
      {entityKindLocked && (
        <Alert>
          <AlertTitle>نوع السجل ثابت</AlertTitle>
          <AlertDescription>
            {row
              ? `نوع هذا السجل هو ${draft.kind === "person" ? "شخص" : "مؤسسة"} ولا يمكن تغييره هنا.`
              : `سيُنشأ هذا السجل كـ ${defaults.kind === "person" ? "شخص" : "مؤسسة"}. نوع السجل لا يتغير من هذه النافذة.`}
          </AlertDescription>
        </Alert>
      )}
      {row && table.name === "contributions" && (
        <Alert>
          <AlertTitle>الدور ثابت في هذه المساهمة</AlertTitle>
          <AlertDescription>
            مفتاح المساهمة مركّب ويشمل الدور. لإسناد دور مختلف، أضف مساهمة جديدة ثم أزل الحالية.
          </AlertDescription>
        </Alert>
      )}
      <Tabs
        value={activeTab}
        onValueChange={(next) => {
          if (jsonError) {
            setError("صحّح JSON أو تجاهل النص غير الصالح قبل الانتقال إلى طريقة تحرير أخرى.");
            return;
          }
          if (next === "json") setJsonText(JSON.stringify(jsonFields, null, 2));
          else setJsonText(null);
          setActiveTab(String(next));
        }}
      >
        <TabsList>
          <TabsTrigger value="fields">الحقول</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="structure">البنية</TabsTrigger>
        </TabsList>
        <TabsContent value="fields">
          <FieldGroup>
            {editable
              .filter((column) => !lockedNames.has(column.name))
              .map((column) => {
                const label =
                  Object.entries(labels).find(([key]) => key === column.name)?.[1] ?? column.name;
                const value = draft[column.name];
                const hint = Object.entries(hints).find(([key]) => key === column.name)?.[1];
                const reference = referenceFor(column.name);
                const sourceFilter =
                  column.name === "source_id" || column.name === "target_id"
                    ? { kind: "organization" }
                    : undefined;

                if (column.name === "asset_id") {
                  return (
                    <CatalogAssetField
                      key={column.name}
                      label={label}
                      value={z.string().safeParse(value).data ?? null}
                      nullable={column.nullable}
                      onChange={(next) => change(column.name, next || null)}
                    />
                  );
                }
                if (reference) {
                  return (
                    <ReferenceField
                      key={column.name}
                      label={label}
                      table={reference}
                      value={z.string().safeParse(value).data ?? null}
                      useIdValue
                      filters={sourceFilter}
                      onChange={(next) => change(column.name, next)}
                    />
                  );
                }
                if (column.data_type === "bool") {
                  return (
                    <Field key={column.name} orientation="horizontal">
                      <Checkbox
                        id={`${id}-${column.name}`}
                        checked={value === true}
                        onCheckedChange={(checked) => change(column.name, checked === true)}
                      />
                      <FieldLabel htmlFor={`${id}-${column.name}`}>{label}</FieldLabel>
                    </Field>
                  );
                }
                const field = column.enum_values.length ? (
                  <SelectField
                    label={label}
                    value={z.string().safeParse(value).data ?? ""}
                    items={column.enum_values.map((item) => ({ value: item, label: item }))}
                    onChange={(next) => change(column.name, next)}
                  />
                ) : (
                  <TextField
                    label={label}
                    value={z.union([z.string(), z.number()]).safeParse(value).data ?? ""}
                    multiline={column.name === "description"}
                    type={
                      ["int2", "int4", "int8", "float4", "float8", "numeric"].includes(
                        column.data_type,
                      )
                        ? "number"
                        : column.data_type === "date"
                          ? "date"
                          : "text"
                    }
                    onChange={(next) => {
                      const numeric = [
                        "int2",
                        "int4",
                        "int8",
                        "float4",
                        "float8",
                        "numeric",
                      ].includes(column.data_type);
                      change(
                        column.name,
                        numeric
                          ? next === "" && column.nullable
                            ? null
                            : Number(next)
                          : next === "" && column.nullable
                            ? null
                            : next,
                      );
                    }}
                  />
                );
                return (
                  <div key={column.name} className="flex flex-col gap-1">
                    {field}
                    {hint && <FieldDescription>{hint}</FieldDescription>}
                  </div>
                );
              })}
          </FieldGroup>
        </TabsContent>
        <TabsContent value="json">
          <div className="flex flex-col gap-3">
            <FieldDescription>
              حرّر أسماء الحقول وقيمها مباشرة. الحقول المحمية وهوية السجل محفوظة. الحقول المحذوفة من
              النص تبقى كما هي عند تحديث سجل موجود؛ استخدم null لإفراغ حقل يقبل ذلك.
            </FieldDescription>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!!jsonError || save.isPending}
                onClick={() => {
                  try {
                    setJsonText(
                      JSON.stringify(JSON.parse(jsonText ?? JSON.stringify(jsonFields)), null, 2),
                    );
                  } catch {
                    setJsonError("صيغة JSON غير صالحة.");
                  }
                }}
              >
                تنسيق JSON
              </Button>
              {jsonError && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={save.isPending}
                  onClick={() => {
                    setJsonText(JSON.stringify(jsonFields, null, 2));
                    setJsonError(null);
                    setError(null);
                  }}
                >
                  تجاهل النص غير الصالح
                </Button>
              )}
            </div>
            <Suspense fallback={<Skeleton className="h-64" />}>
              <CodeEditor
                value={jsonText ?? JSON.stringify(jsonFields, null, 2)}
                onChange={changeJsonText}
                readOnly={save.isPending || !table.writable}
                suggestions={jsonKeys}
              />
            </Suspense>
            {!jsonError && (
              <FieldDescription>
                التعديلات الصالحة متزامنة مع الحقول. اضغط حفظ التغييرات لتطبيقها على السجل.
              </FieldDescription>
            )}
          </div>
        </TabsContent>
        <TabsContent value="structure">
          <Suspense fallback={<Skeleton className="h-64" />}>
            <JsonTreeEditor
              label="قيم السجل"
              value={jsonFields}
              readOnly={save.isPending || !table.writable}
              onChange={(next) => {
                if (changeJson(next)) setJsonText(null);
              }}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
      {(error || jsonError) && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحديث المسودة</AlertTitle>
          <AlertDescription>{jsonError ?? error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!table.writable || save.isPending || !!jsonError}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
        </Button>
        {onCancel && (
          <Button variant="outline" disabled={save.isPending} onClick={onCancel}>
            إلغاء
          </Button>
        )}
      </div>
    </div>
  );
}
