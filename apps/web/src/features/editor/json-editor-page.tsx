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
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/features/dashboard/page-header";
import { ServiceNotice } from "@/features/dashboard/service-notice";

import template from "./work-template.json";

const CodeEditor = lazy(() =>
  import("./code-editor").then((module) => ({ default: module.CodeEditor })),
);
const freshDraft = JSON.stringify(template, null, 2);
export function JsonEditorPage() {
  const [draft, setDraft] = useState(freshDraft);
  const [result, setResult] = useState<string | null>(null);
  const [valid, setValid] = useState(false);
  const updateDraft = useCallback((value: string) => {
    setDraft(value);
    setResult(null);
  }, []);
  function validate(format = false) {
    try {
      const parsed = JSON.parse(draft);
      if (format) setDraft(JSON.stringify(parsed, null, 2));
      setValid(true);
      setResult("JSON صالح نحوياً. التحقق من مخطط السجل سيُجرى عند اتصال واجهة البيانات.");
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
        upcoming
        actions={
          <>
            <Button variant="outline" onClick={() => validate()}>
              <CheckIcon data-icon="inline-start" />
              تحقق من JSON
            </Button>
            <Button disabled>
              <SaveIcon data-icon="inline-start" />
              مراجعة وحفظ
            </Button>
          </>
        }
      />
      <ServiceNotice />
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>مسودة عمل</CardTitle>
            <CardDescription>
              بنية محرر العمل الحالي، دون تحميل أو تعديل أي سجل حقيقي.
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
              <Button variant="outline" disabled>
                اختيار سجل موجود
              </Button>
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
