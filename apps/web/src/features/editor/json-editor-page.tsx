import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { BracesIcon, CheckIcon, FileJsonIcon, SaveIcon, WandSparklesIcon } from "lucide-react";
import { lazy, Suspense, useCallback, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/features/dashboard/page-header";
import { databaseKeys } from "@/features/database/database.queries";
import { applyWork, exportWork } from "@/features/database/work.functions";

import template from "./work-template.json";

const CodeEditor = lazy(() =>
  import("./code-editor").then((module) => ({ default: module.CodeEditor })),
);
const freshDraft = JSON.stringify(template, null, 2);
export function JsonEditorPage() {
  const { work } = useSearch({ from: "__root__" });
  const existing = useQuery({
    queryKey: [...databaseKeys.all, "work", work],
    queryFn: ({ signal }) => exportWork({ data: { id: work ?? "" }, signal }),
    enabled: !!work,
  });
  if (work && existing.isPending) return <Skeleton className="h-96" />;
  if (work && existing.isError)
    return (
      <Alert variant="destructive">
        <AlertTitle>تعذّر تحميل العمل</AlertTitle>
        <AlertDescription>{existing.error.message}</AlertDescription>
      </Alert>
    );
  return (
    <JsonWorkbench
      key={work ?? "new"}
      initialDraft={existing.data ? JSON.stringify(existing.data, null, 2) : freshDraft}
    />
  );
}
function JsonWorkbench({ initialDraft }: { initialDraft: string }) {
  const [draft, setDraft] = useState(initialDraft);
  const [result, setResult] = useState<string | null>(null);
  const [valid, setValid] = useState(false);
  const [reviewed, setReviewed] = useState<string | null>(null);
  const client = useQueryClient();
  const load = useMutation({
    mutationFn: (id: string) => exportWork({ data: { id } }),
    onSuccess: (document) => {
      setDraft(JSON.stringify(document, null, 2));
      setResult("تم تحميل العمل الحالي.");
      setReviewed(null);
    },
    onError: (error: Error) => {
      setValid(false);
      setResult(error.message);
    },
  });
  const save = useMutation({
    mutationFn: (dryRun: boolean) => applyWork({ data: { json: draft, dryRun } }),
    onSuccess: async (_, dryRun) => {
      setValid(true);
      if (dryRun) {
        setReviewed(draft);
        setResult("اجتازت المسودة التحقق والمعاملة التجريبية. راجعها ثم اضغط تطبيق الدمج.");
      } else {
        setReviewed(null);
        setResult("حُفظ العمل بالدمج وسُجّل التغيير.");
        await client.invalidateQueries({ queryKey: databaseKeys.all });
      }
    },
    onError: (error: Error) => {
      setValid(false);
      setReviewed(null);
      setResult(error.message);
    },
  });
  const updateDraft = useCallback((value: string) => {
    setDraft(value);
    setResult(null);
    setReviewed(null);
  }, []);
  function validate(format = false) {
    try {
      const parsed = JSON.parse(draft);
      if (format) {
        setDraft(JSON.stringify(parsed, null, 2));
        setReviewed(null);
      }
      setValid(true);
      setResult("JSON صالح نحوياً. مراجعة الحفظ تتحقق من المخطط وتجرب المعاملة قبل تطبيقها.");
    } catch {
      setValid(false);
      setResult("JSON غير صالح. راجع علامات الخطأ داخل المحرر، خصوصاً الفواصل والأقواس.");
    }
  }
  return (
    <>
      <PageHeader
        title="محرر JSON"
        description="تحرير متقدم مع أرقام الأسطر والطي والبحث وعلامات الأخطاء. المسودة محلية، والحفظ يتطلب مراجعة التغييرات."
        eyebrow="قاعدة البيانات / أدوات التحرير"
        actions={
          <>
            <Button variant="outline" onClick={() => validate()}>
              <CheckIcon data-icon="inline-start" />
              تحقق من JSON
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate(reviewed !== draft)}>
              <SaveIcon data-icon="inline-start" />
              {reviewed === draft ? "تطبيق الدمج" : "مراجعة وحفظ"}
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>مسودة عمل</CardTitle>
            <CardDescription>
              مستند عمل كامل. الحفظ يدمج القيم دون حذف الأجزاء أو العلاقات الغائبة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-96" />}>
              <CodeEditor value={draft} onChange={updateDraft} />
            </Suspense>
          </CardContent>
          <CardFooter>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => validate(true)}>
                <WandSparklesIcon data-icon="inline-start" />
                تنسيق
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(freshDraft);
                  setResult(null);
                }}
              >
                <FileJsonIcon data-icon="inline-start" />
                مسودة جديدة
              </Button>
            </div>
          </CardFooter>
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>المخطط والمراجع</CardTitle>
              <CardDescription>الأسماء والمعرّفات المسموحة للحقول المرتبطة.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  load.mutate(String(data.get("workId")));
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="json-work-id">معرّف العمل الحالي</FieldLabel>
                    <Input id="json-work-id" name="workId" dir="ltr" required placeholder="UUID" />
                  </Field>
                  <Button type="submit" variant="outline" disabled={load.isPending}>
                    تحميل العمل
                  </Button>
                </FieldGroup>
              </form>
              <div className="flex flex-col gap-3">
                <Badge variant="outline">
                  <BracesIcon data-icon="inline-start" />
                  صيغة عمل كاملة
                </Badge>
                <p className="text-sm leading-6 text-muted-foreground">
                  الأسماء البديلة، المحتوى العائلي، الصور، المساهمات، الأجزاء والحلقات في مستند واحد.
                </p>
                <p className="text-xs text-muted-foreground">
                  معرّفات السجلات الحالية تُحفظ عند تحديثها. الدمج والحذف سيُعرضان في معاينة مستقلة.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">يمكن نسخ المعرّف من جدول الأعمال.</p>
            </CardFooter>
          </Card>
          {result && (
            <Alert variant={valid ? "default" : "destructive"}>
              <AlertTitle>{valid ? "اجتاز فحص الصيغة" : "تحتاج المسودة إلى تصحيح"}</AlertTitle>
              <AlertDescription>{result}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </>
  );
}
