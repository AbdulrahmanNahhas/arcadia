import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ValidationResults } from "@/features/database/validation/validation-results";
import { validateCatalog } from "@/features/database/validation/validation.functions";

export function MaintenancePage() {
  const [hasRun, setHasRun] = useState(false);
  const validation = useMutation({
    mutationFn: () => validateCatalog(),
    onSuccess: () => setHasRun(true),
  });
  const buttonLabel = validation.isPending
    ? "جارٍ فحص المكتبة…"
    : validation.isError
      ? "إعادة الفحص"
      : hasRun
        ? "تحديث نتائج الفحص"
        : "تشغيل الفحص";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="التحقق والصيانة"
        description="راجع سلامة بيانات المكتبة، ثم افتح السجل المناسب لمعالجة كل ملاحظة."
        eyebrow="قاعدة البيانات / الجودة"
      />
      <Card>
        <CardHeader>
          <CardTitle>فحص المكتبة</CardTitle>
          <CardDescription>
            يفحص المعلومات التحريرية، بنية الأعمال، المفردات، وملفات الصور. لا يغيّر الفحص أي بيانات.
          </CardDescription>
        </CardHeader>
        {validation.isError && (
          <CardContent>
            <Alert variant="destructive">
              <AlertTitle>تعذّر إكمال الفحص</AlertTitle>
              <AlertDescription>{validation.error.message}</AlertDescription>
            </Alert>
          </CardContent>
        )}
        {validation.isSuccess && (
          <CardContent>
            <ValidationResults issues={validation.data} />
          </CardContent>
        )}
        {!hasRun && !validation.isError && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              ابدأ الفحص لعرض الملاحظات كبطاقات مع روابط مباشرة إلى السجلات ذات الصلة.
            </p>
          </CardContent>
        )}
        <CardFooter>
          <Button disabled={validation.isPending} onClick={() => validation.mutate()}>
            {buttonLabel}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
