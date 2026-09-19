import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CopyIcon,
  DownloadSimpleIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { archiveKeys, getAdminDuplicates, getAdminQuality } from "@/features/archive/api";
import { apiBaseUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "../components/admin-page-header";
import {
  describeJobResult,
  jobLabels,
  jobStatusLabel,
  jobsQueryOptions,
  jobTypeLabel,
  type MaintenanceJobType,
  maintenanceJobTypes,
  maintenanceKeys,
  runMaintenanceJob,
} from "../maintenance/api";

const dateTime = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });

/**
 * `/admin/archive` — "الصيانة": the tools that act on the whole archive (validate, media
 * inspection, purges, export) with the results they produced, the per-title completeness list
 * you can work through, and duplicate suspects. Every button here does something real and
 * shows what it did.
 */
export function MaintenancePage() {
  return (
    <div className="flex min-w-0 flex-col gap-6 pb-10">
      <AdminPageHeader
        title="الصيانة"
        description="أدوات تعمل على الأرشيف كله وتُظهر نتيجتها، وقائمة اكتمال لكل عمل، وكاشف التكرار."
      />
      <div className="flex flex-col gap-6 px-5 sm:px-6">
        <ToolsCard />
        <QualityCard />
        <DuplicatesCard />
      </div>
    </div>
  );
}

function ToolsCard() {
  const queryClient = useQueryClient();
  const jobs = useQuery(jobsQueryOptions());
  const [lastResult, setLastResult] = useState<{ type: MaintenanceJobType; text: string } | null>(
    null,
  );
  const run = useMutation({
    mutationFn: (type: MaintenanceJobType) => runMaintenanceJob(type),
    onSuccess: async (outcome, type) => {
      setLastResult({ type, text: describeJobResult(outcome.result) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: maintenanceKeys.all }),
        queryClient.invalidateQueries({ queryKey: archiveKeys.admin }),
        queryClient.invalidateQueries({ queryKey: ["catalog-validation"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-media-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview-v2"] }),
      ]);
    },
    onError: (error, type) =>
      setLastResult({ type, text: error instanceof Error ? error.message : "فشلت المهمة." }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>الأدوات</CardTitle>
        <CardDescription>
          كل أداة تعمل فوراً وتُسجَّل في سجل المهام مع نتيجتها. الحمراء تحذف فعلاً — تأكيد قبل التنفيذ.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {maintenanceJobTypes.map((type) => {
          const meta = jobLabels[type];
          const busy = run.isPending && run.variables === type;
          return (
            <div
              key={type}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-4",
                meta.destructive ? "border-destructive/30" : "border-border",
              )}
            >
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {meta.destructive ? (
                    <WarningIcon className="text-destructive" />
                  ) : (
                    <MagnifyingGlassIcon className="text-primary" />
                  )}
                  {meta.title}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{meta.description}</p>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {lastResult?.type === type ? lastResult.text : ""}
                </span>
                <Button
                  size="sm"
                  variant={meta.destructive ? "destructive" : "outline"}
                  disabled={run.isPending}
                  onClick={() => {
                    if (meta.destructive && !window.confirm(`${meta.title}؟ لا يمكن التراجع.`))
                      return;
                    run.mutate(type);
                  }}
                >
                  <PlayIcon data-icon="inline-start" /> {busy ? "يعمل…" : "تشغيل"}
                </Button>
              </div>
            </div>
          );
        })}
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4 md:col-span-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-medium">
              <DownloadSimpleIcon className="text-primary" /> تصدير الأرشيف
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              ملف JSON بكل الأعمال والأجزاء والحلقات — نسخة قابلة للقراءة خارج قاعدة البيانات.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={
              <a
                href={`${apiBaseUrl}/api/v1/admin/archive/export`}
                download="arcadia-export.json"
              />
            }
          >
            <DownloadSimpleIcon data-icon="inline-start" /> تنزيل JSON
          </Button>
        </div>
        <div className="md:col-span-2">
          <h3 className="mb-2 text-sm font-medium">آخر المهام</h3>
          {jobs.data && jobs.data.length > 0 ? (
            <ul className="divide-y divide-border rounded-xl border border-border text-sm">
              {jobs.data.slice(0, 8).map((job) => (
                <li key={job.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="font-medium">{jobTypeLabel(job.type)}</span>
                  <Badge
                    variant={
                      job.status === "failed"
                        ? "destructive"
                        : job.status === "completed"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {jobStatusLabel(job.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {dateTime.format(new Date(job.createdAt))}
                  </span>
                  <span className="ms-auto text-xs text-muted-foreground">
                    {job.error ?? describeJobResult(job.result)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">لم تُشغَّل أي مهمة بعد.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type QualityFilter = "all" | "incomplete" | "ready";

function QualityCard() {
  const quality = useQuery({
    queryKey: [...archiveKeys.admin, "quality"],
    queryFn: getAdminQuality,
  });
  const [filter, setFilter] = useState<QualityFilter>("incomplete");
  const [issue, setIssue] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const rows = useMemo(() => quality.data ?? [], [quality.data]);
  const issueKinds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows)
      for (const entry of row.issues) counts.set(entry, (counts.get(entry) ?? 0) + 1);
    return [...counts.entries()].toSorted((a, b) => b[1] - a[1]);
  }, [rows]);
  const visible = rows
    .filter((row) =>
      filter === "incomplete"
        ? row.issues.length > 0
        : filter === "ready"
          ? row.issues.length === 0
          : true,
    )
    .filter((row) => !issue || row.issues.includes(issue))
    .filter(
      (row) =>
        !search.trim() || row.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    )
    .toSorted((a, b) => a.score - b.score || a.label.localeCompare(b.label));
  const ready = rows.filter((row) => row.issues.length === 0).length;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>اكتمال الأعمال</CardTitle>
            <CardDescription>
              {ready} من {rows.length} عمل مكتمل البيانات. اختر نقصاً بعينه لتعمل عليه دفعة واحدة.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث باسم العمل"
              className="h-8 w-48"
            />
            <ToggleGroup
              value={[filter]}
              multiple={false}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="حالة الاكتمال"
              onValueChange={(values) => {
                const next = values[0];
                setFilter(next === "all" || next === "ready" ? next : "incomplete");
              }}
            >
              <ToggleGroupItem value="incomplete">ناقصة</ToggleGroupItem>
              <ToggleGroupItem value="ready">مكتملة</ToggleGroupItem>
              <ToggleGroupItem value="all">الكل</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        {issueKinds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {issueKinds.map(([kind, count]) => (
              <button
                key={kind}
                type="button"
                aria-pressed={issue === kind}
                onClick={() => setIssue(issue === kind ? null : kind)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  issue === kind
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {kind} · {count}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table className="min-w-160">
          <TableHeader>
            <TableRow>
              <TableHead>العمل</TableHead>
              <TableHead className="w-40">الاكتمال</TableHead>
              <TableHead>النواقص</TableHead>
              <TableHead className="w-44 text-end">الإجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.slice(0, 100).map((row) => (
              <TableRow key={row.entityId}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={row.score} />
                    <span className="font-mono text-xs">{row.score}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-md flex-wrap gap-1">
                    {row.issues.length ? (
                      row.issues.map((entry) => (
                        <Badge key={entry} variant="outline">
                          {entry}
                        </Badge>
                      ))
                    ) : (
                      <Badge>
                        <CheckCircleIcon /> مكتمل
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={
                        <Link to="/admin/catalog/$workId" params={{ workId: row.entityId }} />
                      }
                    >
                      <ArrowSquareOutIcon data-icon="inline-start" /> افتح
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  لا أعمال تطابق التصفية.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {visible.length > 100 && (
          <p className="px-4 py-2 text-xs text-muted-foreground">
            تُعرض أول 100 من {visible.length}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DuplicatesCard() {
  const duplicates = useQuery({
    queryKey: [...archiveKeys.admin, "duplicates"],
    queryFn: getAdminDuplicates,
  });
  const groups = duplicates.data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CopyIcon className="text-primary" /> كاشف التكرار
        </CardTitle>
        <CardDescription>
          {groups.length === 0
            ? "لا أسماء متطابقة بعد تجاهل المسافات والرموز."
            : `${groups.length} مجموعة بأسماء متطابقة بعد تجاهل المسافات والرموز — افتح كليهما وقرّر: دمج، أو إعادة تسمية إن كانا عملين مختلفين فعلاً.`}
        </CardDescription>
      </CardHeader>
      {groups.length > 0 && (
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <div
              key={`${group.entityType}:${group.normalizedValue}`}
              className="rounded-xl border border-border p-4"
            >
              <Badge variant="outline">
                {group.entityType === "title" ? "أعمال" : "أشخاص واستوديوهات"}
              </Badge>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {group.candidates.map((candidate) => (
                  <li key={candidate.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{candidate.label}</span>
                    {group.entityType === "title" ? (
                      <Link
                        to="/admin/catalog/$workId"
                        params={{ workId: candidate.id }}
                        className="shrink-0 text-xs text-primary hover:underline"
                      >
                        افتح
                      </Link>
                    ) : (
                      <Link
                        to="/admin/people"
                        className="shrink-0 text-xs text-primary hover:underline"
                      >
                        افتح
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
