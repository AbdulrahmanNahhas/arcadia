import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  DatabaseIcon,
  DownloadSimpleIcon,
  PulseIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  archiveKeys,
  getAdminAudit,
  getAdminDuplicates,
  getAdminJobs,
  getAdminQuality,
  runAdminJob,
  updateTitleWorkflow,
} from "@/features/archive/api";
import { apiBaseUrl } from "@/lib/api";
import { AdminPageHeader } from "../components/admin-page-header";

const dateTime = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });

export function ArchiveOperationsPage() {
  const client = useQueryClient();
  const [quality, audit, jobs, duplicates] = useQueries({
    queries: [
      { queryKey: [...archiveKeys.admin, "quality"], queryFn: getAdminQuality },
      { queryKey: [...archiveKeys.admin, "audit"], queryFn: getAdminAudit },
      { queryKey: [...archiveKeys.admin, "jobs"], queryFn: getAdminJobs },
      { queryKey: [...archiveKeys.admin, "duplicates"], queryFn: getAdminDuplicates },
    ],
  });
  const refreshAdmin = () => client.invalidateQueries({ queryKey: archiveKeys.admin });
  const jobMutation = useMutation({ mutationFn: runAdminJob, onSuccess: refreshAdmin });
  const workflowMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "in_review" | "published" }) =>
      updateTitleWorkflow(id, status),
    onSuccess: refreshAdmin,
  });
  const qualityRows = quality.data ?? [];
  const averageQuality = qualityRows.length
    ? Math.round(qualityRows.reduce((sum, row) => sum + row.score, 0) / qualityRows.length)
    : 100;
  const readyToPublish = qualityRows.filter((row) => !row.issues.length).length;

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-10">
      <AdminPageHeader
        title="غرفة عمليات الأرشيف"
        description="الجودة، سير النشر، سجل التغييرات، والمهام الثقيلة في شاشة واحدة."
      />
      <div className="space-y-6 px-5 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            title="جودة البيانات"
            value={`${averageQuality}%`}
            icon={PulseIcon}
            detail={`${qualityRows.filter((row) => row.issues.length).length} عمل يحتاج عناية`}
          />
          <Metric
            title="جاهزة للنشر"
            value={String(readyToPublish)}
            icon={CheckCircleIcon}
            detail="بلا نواقص مسجّلة"
          />
          <Metric
            title="آخر المهام"
            value={String(jobs.data?.length ?? 0)}
            icon={DatabaseIcon}
            detail="تشغيل محلي قابل للتتبع"
          />
          <Metric
            title="اشتباه تكرار"
            value={String(duplicates.data?.length ?? 0)}
            icon={ShieldCheckIcon}
            detail={`${audit.data?.length ?? 0} عملية في سجل التدقيق`}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <Card>
            <CardHeader>
              <CardTitle>قائمة جودة المحتوى</CardTitle>
              <CardDescription>
                درجة قابلة للتفسير، لا رقم غامض. افتح العمل أو انقله إلى المراجعة.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العمل</TableHead>
                    <TableHead>الجودة</TableHead>
                    <TableHead>النواقص</TableHead>
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qualityRows.slice(0, 30).map((row) => (
                    <TableRow key={row.entityId}>
                      <TableCell>
                        <Link
                          to="/admin/catalog/$workId"
                          params={{ workId: row.entityId }}
                          className="font-medium hover:text-primary"
                        >
                          {row.label}
                        </Link>
                      </TableCell>
                      <TableCell className="min-w-32">
                        <div className="flex items-center gap-2">
                          <Progress value={row.score} />
                          <span className="font-mono text-xs">{row.score}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-md flex-wrap gap-1">
                          {row.issues.length ? (
                            row.issues.map((issue) => (
                              <Badge key={issue} variant="outline">
                                {issue}
                              </Badge>
                            ))
                          ) : (
                            <Badge>
                              <CheckCircleIcon /> مكتمل
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={workflowMutation.isPending}
                          onClick={() =>
                            workflowMutation.mutate({
                              id: row.entityId,
                              status: row.issues.length ? "in_review" : "published",
                            })
                          }
                        >
                          {row.issues.length ? "للمراجعة" : "نشر"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>المهام والأدوات</CardTitle>
              <CardDescription>عمليات واضحة مع سجل نتيجة؛ بلا عمليات صامتة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["validate", "فحص شامل"],
                ["recalculate-quality", "إعادة حساب الجودة"],
                ["inspect-media", "فحص الوسائط"],
                ["refresh-collections", "تحديث المجموعات"],
              ].map(([type, label]) => (
                <Button
                  key={type}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={jobMutation.isPending}
                  onClick={() => jobMutation.mutate(type)}
                >
                  <ArrowClockwiseIcon /> {label}
                </Button>
              ))}
              <Button
                className="w-full justify-start"
                nativeButton={false}
                render={
                  <a
                    href={`${apiBaseUrl}/api/v1/admin/archive/export`}
                    download="arcadia-export.json"
                  />
                }
              >
                <DownloadSimpleIcon /> تصدير JSON داخلي
              </Button>
              {jobs.data?.slice(0, 4).map((job) => (
                <div key={job.id} className="rounded-xl bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span>{job.type}</span>
                    <Badge variant="secondary">{job.status}</Badge>
                  </div>
                  <Progress className="mt-2" value={job.progress} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>سجل التدقيق</CardTitle>
            <CardDescription>من غيّر ماذا ومتى، مع هدف التغيير.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1 sm:grid-cols-2">
            {audit.data?.slice(0, 16).map((entry) => (
              <div key={entry.id} className="flex gap-3 border-b py-3 last:border-0">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="text-sm">
                    <strong>{entry.actorName ?? "النظام"}</strong> · {entry.summary}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {entry.action} · {dateTime.format(new Date(entry.createdAt))}
                  </p>
                </div>
              </div>
            ))}
            {!audit.data?.length ? (
              <p className="col-span-full py-8 text-center text-muted-foreground">
                يبدأ السجل مع أول تغيير في سير العمل.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
      {duplicates.data?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>كاشف التكرار</CardTitle>
            <CardDescription>
              عناوين أو كيانات تتطابق بعد إزالة المسافات والرموز؛ راجعها قبل الدمج.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {duplicates.data.map((group) => (
              <div
                key={`${group.entityType}:${group.normalizedValue}`}
                className="rounded-2xl border p-4"
              >
                <Badge variant="outline">{group.entityType === "title" ? "أعمال" : "كيانات"}</Badge>
                <ul className="mt-3 space-y-1 text-sm">
                  {group.candidates.map((candidate) => (
                    <li key={candidate.id}>{candidate.label}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
  detail,
}: {
  title: string;
  value: string;
  icon: typeof PulseIcon;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>{title}</CardDescription>
          <Icon className="text-primary" />
        </div>
        <CardTitle className="font-mono text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}
