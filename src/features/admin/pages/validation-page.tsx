import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
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
  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="التحقق من البيانات"
        description="مشكلات صريحة تحتاج مراجعة؛ لا تُصلح القيم الملتبسة تلقائياً."
      />
      <Card className="m-6 mt-0 mr-4">
        <CardHeader>
          <CardTitle>نتيجة الفحص</CardTitle>
          <CardDescription>
            {issues.length} ملاحظة، منها {errors} أخطاء مانعة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {issues.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المستوى</TableHead>
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
                      <strong className="block text-sm">{issue.title}</strong>
                      <span className="text-xs text-muted-foreground">
                        {issue.entityType} · {issue.entityId}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{issue.path}</TableCell>
                    <TableCell>{issue.message}</TableCell>
                    <TableCell className="text-muted-foreground">{issue.action}</TableCell>
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
