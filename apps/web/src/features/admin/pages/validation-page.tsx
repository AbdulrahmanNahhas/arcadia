import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCatalogValidation } from "@/server/platform.functions";
import { AdminPageHeader } from "../components/admin-page-header";

export function ValidationPage() {
  const { data: issues } = useSuspenseQuery({
    queryKey: ["catalog-validation"],
    queryFn: () => getCatalogValidation(),
  });
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const automatic = issues.filter((issue) => issue.autoRepairable).length;
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <AdminPageHeader
        title="التحقق من البيانات"
        description="مشكلات صريحة تحتاج مراجعة؛ لا تُصلح القيم الملتبسة تلقائياً."
      />
      <Card className="mx-5 mb-6 min-w-0 sm:mx-6">
        <CardHeader>
          <CardTitle>نتيجة الفحص</CardTitle>
          <CardDescription>
            {issues.length} ملاحظة، منها {errors} أخطاء مانعة و{automatic} إصلاحات آمنة.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          {issues.length ? (
            <Table className="min-w-[58rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>المستوى</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>السجل</TableHead>
                  <TableHead>المسار</TableHead>
                  <TableHead>المشكلة</TableHead>
                  <TableHead>الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>
                      <Badge
                        variant={
                          issue.severity === "error"
                            ? "destructive"
                            : issue.severity === "warning"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {issue.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{issue.category ?? "integrity"}</Badge>
                    </TableCell>
                    <TableCell>
                      <strong className="block text-sm">{issue.title}</strong>
                      <span className="text-xs text-muted-foreground">
                        {issue.entityType} · {issue.entityId}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-64 truncate font-mono text-xs" dir="ltr">
                      {issue.path}
                    </TableCell>
                    <TableCell className="max-w-80 whitespace-normal">{issue.message}</TableCell>
                    <TableCell>
                      <p className="text-muted-foreground">{issue.action}</p>
                      {issue.repairPath ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="mt-1 px-0"
                          nativeButton={false}
                          render={<a href={issue.repairPath} />}
                        >
                          فتح شاشة الإصلاح
                        </Button>
                      ) : null}
                      {issue.autoRepairable ? (
                        <Badge variant="secondary" className="ms-2">
                          آمن تلقائياً
                        </Badge>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>الكتالوج سليم</EmptyTitle>
                <EmptyDescription>لم يكتشف الفحص الحالي أي مشكلة.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
