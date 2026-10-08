import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { BracesIcon, CopyIcon, Undo2Icon, WandSparklesIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/features/dashboard/page-header";

import { ChangeReview } from "./change-review";
import {
  documentRow,
  equalValue,
  fieldKeys,
  projectDocuments,
  projectionSchema,
  workFields,
  type WorkField,
  type WorkSnapshot,
} from "./document-model";
import { workSnapshotsOptions } from "./document.queries";
import { useDocumentReview } from "./use-document-review";
import { SelectField } from "./work-fields";

const CodeEditor = lazy(() =>
  import("./code-editor").then((module) => ({ default: module.CodeEditor })),
);
const groups = [...new Set(workFields.map((field) => field.group))];
const identityFields: WorkField[] = ["canonicalTitle", "titleAr", "aliases", "trivia", "summary"];
export function JsonEditorPage() {
  const state = useSearch({ from: "__root__" });
  const ids = state.ids?.length ? state.ids : state.work ? [state.work] : [];
  return (
    <>
      <PageHeader
        title="مساحة تحرير JSON"
        description={
          ids.length
            ? `${ids.length} عمل في نطاق التحرير.`
            : "حدد الأعمال من الكتالوج لفتح مستند واحد أو تحرير عدة أعمال معاً."
        }
      />
      {ids.length ? (
        <JsonLoader ids={ids} />
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>اختر الأعمال أولاً</EmptyTitle>
            <EmptyDescription>
              حدد عملاً أو أكثر باستخدام مربعات التحديد، ثم افتح محرر JSON من شريط التحديد.
            </EmptyDescription>
          </EmptyHeader>
          <Link
            to="/database/$collection"
            params={{ collection: "works" }}
            className={buttonVariants()}
          >
            <BracesIcon data-icon="inline-start" />
            العودة إلى الأعمال
          </Link>
        </Empty>
      )}
    </>
  );
}
function JsonLoader({ ids }: { ids: string[] }) {
  const query = useQuery(workSnapshotsOptions(ids));
  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError)
    return (
      <Alert variant="destructive">
        <AlertTitle>تعذّر تحميل الأعمال</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
        <Button variant="outline" onClick={() => void query.refetch()}>
          إعادة المحاولة
        </Button>
      </Alert>
    );
  return (
    <JsonWorkspace
      key={query.data.map((snapshot) => snapshot.revision).join(":")}
      snapshots={query.data}
    />
  );
}
function JsonWorkspace({ snapshots }: { snapshots: WorkSnapshot[] }) {
  const [fields, setFields] = useState<WorkField[]>(identityFields);
  const [buffers, setBuffers] = useState(
    snapshots.map(({ document }) => documentRow.parse(document)),
  );
  const initial = JSON.stringify(
    projectDocuments(
      snapshots.map(({ document }) => document),
      fields,
    ),
    null,
    2,
  );
  const [draft, setDraft] = useState(initial);
  const [fieldSearch, setFieldSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [preset, setPreset] = useState("identity");
  const parsed = (() => {
    try {
      return projectionSchema.safeParse(JSON.parse(draft));
    } catch {
      return null;
    }
  })();
  const dirty = parsed?.success ? !equalValue(JSON.parse(initial), parsed.data) : draft !== initial;
  const flow = useDocumentReview(snapshots, draft, dirty);
  function update(value: string) {
    setDraft(value);
    setNotice(null);
    flow.changed();
  }
  function choose(next: WorkField[]) {
    if (!parsed?.success) {
      setNotice("صحّح JSON قبل تغيير نطاق الحقول حتى تبقى المسودة محفوظة.");
      return;
    }
    const merged = buffers.map((record) => ({
      ...record,
      ...parsed.data.records.find((value) => value.id === record.id),
    }));
    setBuffers(merged);
    setFields(next);
    update(
      JSON.stringify(
        {
          schemaVersion: 1,
          fields: next,
          records: merged.map((record) =>
            Object.fromEntries([
              ["id", record.id],
              ...next.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]),
            ]),
          ),
        },
        null,
        2,
      ),
    );
  }
  const error = flow.save.error ?? flow.prepare.error;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={flow.review ? "outline" : "secondary"}>1 · المحرر</Badge>
        <span className="text-muted-foreground">←</span>
        <Badge variant={flow.review ? "secondary" : "outline"}>2 · مراجعة التغييرات</Badge>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>لم تُحفظ التغييرات</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert>
          <AlertTitle>{notice}</AlertTitle>
        </Alert>
      )}
      {flow.review ? (
        <ChangeReview
          review={flow.review}
          busy={flow.busy}
          onBack={flow.back}
          onSave={() => {
            if (flow.review) flow.save.mutate(flow.review.ticket);
          }}
        />
      ) : (
        <>
          <div className="grid min-w-0 items-start gap-5 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>نطاق التحرير</CardTitle>
                <CardDescription>
                  الحقول غير المختارة تبقى كما هي. معرّفات الأعمال ثابتة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <SelectField
                    label="قالب الحقول"
                    value={preset}
                    items={[
                      { value: "identity", label: "هوية العمل" },
                      { value: "indexing", label: "الفهرسة" },
                      { value: "editorial", label: "التحرير" },
                      { value: "structure", label: "البنية والتقييمات" },
                      { value: "all", label: "كل الحقول المتاحة" },
                    ]}
                    onChange={(value) => {
                      if (!parsed?.success) return;
                      setPreset(value);
                      choose(
                        value === "all"
                          ? fieldKeys
                          : value === "identity"
                            ? identityFields
                            : value === "structure"
                              ? ["installments"]
                              : workFields
                                  .filter(
                                    (field) =>
                                      field.group ===
                                      (value === "indexing" ? "الفهرسة" : "التحرير"),
                                  )
                                  .map((field) => field.key),
                      );
                    }}
                  />
                  <Input
                    aria-label="بحث عن الحقول"
                    placeholder="ابحث عن حقل…"
                    value={fieldSearch}
                    onChange={(event) => setFieldSearch(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={flow.busy}
                      onClick={() => choose(fieldKeys)}
                    >
                      الكل
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={flow.busy}
                      onClick={() => choose(["canonicalTitle"])}
                    >
                      العنوان فقط
                    </Button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <FieldGroup>
                      {groups.map((group) => {
                        const items = workFields.filter(
                          (field) =>
                            field.group === group &&
                            `${field.label} ${field.key}`
                              .toLowerCase()
                              .includes(fieldSearch.toLowerCase()),
                        );
                        return items.length ? (
                          <FieldSet key={group}>
                            <FieldLegend variant="label">{group}</FieldLegend>
                            <FieldGroup>
                              {items.map((field) => (
                                <Field key={field.key} orientation="horizontal">
                                  <Checkbox
                                    id={`json-field-${field.key}`}
                                    checked={fields.includes(field.key)}
                                    disabled={flow.busy}
                                    onCheckedChange={(checked) =>
                                      choose(
                                        checked
                                          ? [...fields, field.key]
                                          : fields.filter((key) => key !== field.key),
                                      )
                                    }
                                  />
                                  <FieldLabel htmlFor={`json-field-${field.key}`}>
                                    <span>
                                      {field.label}
                                      <span
                                        dir="ltr"
                                        className="block font-utility text-xs text-muted-foreground"
                                      >
                                        {field.key}
                                      </span>
                                    </span>
                                  </FieldLabel>
                                </Field>
                              ))}
                            </FieldGroup>
                          </FieldSet>
                        ) : null;
                      })}
                    </FieldGroup>
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>
            <div className="flex min-w-0 flex-col gap-3 xl:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge variant={parsed?.success ? "outline" : "destructive"}>
                  {parsed?.success ? "JSON صالح" : "JSON يحتاج تصحيحاً"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {snapshots.length} سجل · {fields.length} حقل · {draft.length.toLocaleString()} حرف
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!parsed?.success || flow.busy}
                  onClick={() => {
                    if (parsed?.success) update(JSON.stringify(parsed.data, null, 2));
                  }}
                >
                  <WandSparklesIcon data-icon="inline-start" />
                  تنسيق
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(draft)
                      .then(() => setNotice("نُسخ JSON"))
                      .catch(() => setNotice("تعذّر النسخ؛ يمكنك تحديد النص ونسخه من المحرر."))
                  }
                >
                  <CopyIcon data-icon="inline-start" />
                  نسخ
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!dirty || flow.busy}
                  onClick={() => {
                    if (window.confirm("تجاهل التغييرات وإعادة النسخة الأصلية؟")) {
                      setBuffers(snapshots.map(({ document }) => documentRow.parse(document)));
                      update(initial);
                    }
                  }}
                >
                  <Undo2Icon data-icon="inline-start" />
                  استعادة الأصل
                </Button>
              </div>
              <Suspense fallback={<Skeleton className="h-96" />}>
                <CodeEditor value={draft} onChange={update} />
              </Suspense>
              <p className="text-xs leading-6 text-muted-foreground">
                Ctrl / ⌘ + F للبحث داخل JSON. إزالة حقل من المستند لا تحذفه من العمل. القوائم
                المختارة تمثل قيمها الجديدة؛ حذف الأجزاء والحلقات يتطلب مساراً مستقلاً.
              </p>
              <Card>
                <CardHeader>
                  <CardTitle>مرجع القيم</CardTitle>
                  <CardDescription>
                    أمثلة على القيم المسموحة؛ فحص العلاقات والمراجع يتم عند المراجعة.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="font-medium">الصيغة</dt>
                      <dd dir="ltr" className="mt-1 font-utility text-muted-foreground">
                        animated · live-action
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium">حالة النشر</dt>
                      <dd dir="ltr" className="mt-1 font-utility text-muted-foreground">
                        draft · in_review · approved · published · archived
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium">المخاطر</dt>
                      <dd dir="ltr" className="mt-1 font-utility text-muted-foreground">
                        none · low · medium · high
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium">الأجزاء</dt>
                      <dd dir="ltr" className="mt-1 font-utility text-muted-foreground">
                        season · movie · special
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4 shadow-sm">
            <span className="text-sm text-muted-foreground">
              {dirty ? "مسودة غير محفوظة" : "لا توجد تغييرات"}
            </span>
            <Button
              disabled={!dirty || !parsed?.success || flow.busy}
              onClick={() => flow.prepare.mutate(draft)}
            >
              {flow.prepare.isPending ? "جارٍ إعداد المراجعة…" : "مراجعة التغييرات"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
