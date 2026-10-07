import { useMutation } from "@tanstack/react-query";

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
import { PageHeader } from "@/features/dashboard/page-header";

import { validateCatalog } from "./validation.functions";
export function MaintenancePage() {
  const validation = useMutation({ mutationFn: () => validateCatalog() });
  return (
    <>
      <PageHeader
        title="التحقق والصيانة"
        description="فحص سلامة بيانات المكتبة الحالية دون تطبيق إصلاحات تلقائية."
        eyebrow="قاعدة البيانات / الجودة"
      />
      <Card>
        <CardHeader>
          <CardTitle>فحص المكتبة</CardTitle>
          <CardDescription>العناوين والصور والمعلومات التحريرية والعلاقات.</CardDescription>
        </CardHeader>
        <CardContent>
          {validation.isError && (
            <Alert variant="destructive">
              <AlertTitle>تعذّر الفحص</AlertTitle>
              <AlertDescription>{validation.error.message}</AlertDescription>
            </Alert>
          )}
          {validation.isSuccess && <Badge variant="outline">{validation.data.length} ملاحظة</Badge>}
          <pre className="max-h-96 overflow-auto" dir="ltr">
            {validation.data ? JSON.stringify(validation.data, null, 2) : ""}
          </pre>
        </CardContent>
        <CardFooter>
          <Button disabled={validation.isPending} onClick={() => validation.mutate()}>
            {validation.isPending ? "جارٍ الفحص…" : "تشغيل الفحص"}
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
