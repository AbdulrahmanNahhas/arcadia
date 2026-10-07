import type { ValidationIssue } from "@arcadia/contracts";
import {
  ArrowSquareOutIcon,
  BroomIcon,
  CheckCircleIcon,
  MagicWandIcon,
  TrashIcon,
  WarningCircleIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "../components/admin-page-header";
import { maintenanceKeys, repairIssue, validationQueryOptions } from "../maintenance/api";

const categoryLabels = new Map<ValidationIssue["category"], string>([
  ["integrity", "البنية"],
  ["metadata", "البيانات"],
  ["media", "الوسائط"],
  ["vocabulary", "المفردات"],
  ["jellyfin", "Jellyfin"],
]);
const severityOrder = { error: 0, warning: 1, info: 2 } satisfies Record<
  ValidationIssue["severity"],
  number
>;
const categories = [...categoryLabels.keys()];
function isCategory(value: string): value is ValidationIssue["category"] {
  return categories.some((entry) => entry === value);
}

function severityBadge(severity: ValidationIssue["severity"]) {
  if (severity === "error") return <Badge variant="destructive">خطأ</Badge>;
  if (severity === "warning") return <Badge variant="secondary">تنبيه</Badge>;
  return <Badge variant="outline">ملاحظة</Badge>;
}

/**
 * `/admin/validation` — every explicit problem the API can name, grouped so the admin can work
 * one kind at a time, with the fix on the row: open the page that edits it, or delete what can
 * be deleted safely (orphaned images, records whose file is gone). "أصلح ما يمكن" runs every
 * auto-repairable row in one go. Editorial judgement calls are never auto-fixed.
 */
export function ValidationPage() {
  const queryClient = useQueryClient();
  const { data: issues } = useSuspenseQuery(validationQueryOptions());
  const [category, setCategory] = useState<ValidationIssue["category"] | "all">("all");
  const [severity, setSeverity] = useState<ValidationIssue["severity"] | "all">("all");
  const [feedback, setFeedback] = useState<string | null>(null);

  const counts = useMemo(() => {
    const byCategory = new Map<ValidationIssue["category"], number>();
    for (const issue of issues)
      byCategory.set(issue.category, (byCategory.get(issue.category) ?? 0) + 1);
    return {
      byCategory,
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length,
      auto: issues.filter((issue) => issue.autoRepairable).length,
    };
  }, [issues]);

  const visible = useMemo(
    () =>
      issues
        .filter((issue) => category === "all" || issue.category === category)
        .filter((issue) => severity === "all" || issue.severity === severity)
        .toSorted(
          (a, b) =>
            severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title),
        ),
    [issues, category, severity],
  );

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["catalog-validation"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-media-assets"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-overview-v2"] }),
    ]);

  const repairOne = useMutation({
    mutationFn: (issueId: string) => repairIssue(issueId),
    onSuccess: async () => {
      setFeedback("تم الإصلاح.");
      await invalidate();
    },
    onError: (error) => setFeedback(error instanceof Error ? error.message : "تعذّر الإصلاح."),
  });
  const repairAll = useMutation({
    mutationFn: async () => {
      let done = 0;
      for (const issue of issues.filter((entry) => entry.autoRepairable)) {
        try {
          await repairIssue(issue.id);
          done += 1;
        } catch {
          // Keep going; the remaining rows re-render with whatever is still broken.
        }
      }
      return done;
    },
    onSuccess: async (done) => {
      setFeedback(`أُصلحت ${done} ملاحظة تلقائياً.`);
      await invalidate();
    },
  });

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-10">
      <AdminPageHeader
        title="التحقق من البيانات"
        description="مشكلات صريحة يمكن التصرف فيها من هنا: افتح الصفحة التي تُصلحها، أو احذف ما يمكن حذفه بأمان."
        actions={
          <Button
            variant="outline"
            disabled={counts.auto === 0 || repairAll.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `حذف ${counts.auto} أصلاً غير مستخدم أو سجلاً بلا ملف؟ لا يمكن التراجع.`,
                )
              ) {
                repairAll.mutate();
              }
            }}
          >
            <MagicWandIcon data-icon="inline-start" />
            {repairAll.isPending ? "جارٍ الإصلاح…" : `أصلح ما يمكن تلقائياً (${counts.auto})`}
          </Button>
        }
      />

      <div className="grid gap-3 px-5 sm:grid-cols-3 sm:px-6">
        <SeverityTile
          icon={<WarningCircleIcon />}
          label="أخطاء مانعة"
          value={counts.errors}
          active={severity === "error"}
          tone="destructive"
          onClick={() => setSeverity(severity === "error" ? "all" : "error")}
        />
        <SeverityTile
          icon={<WarningIcon />}
          label="تنبيهات"
          value={counts.warnings}
          active={severity === "warning"}
          tone="warning"
          onClick={() => setSeverity(severity === "warning" ? "all" : "warning")}
        />
        <SeverityTile
          icon={<CheckCircleIcon />}
          label="ملاحظات"
          value={counts.info}
          active={severity === "info"}
          tone="muted"
          onClick={() => setSeverity(severity === "info" ? "all" : "info")}
        />
      </div>

      <Card className="mx-5 mb-6 min-w-0 sm:mx-6">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>{visible.length} ملاحظة</CardTitle>
              <CardDescription>
                {feedback ?? "مرتّبة بالخطورة ثم بالاسم. الأزرار على اليسار تنفّذ الإجراء مباشرة."}
              </CardDescription>
            </div>
            <ToggleGroup
              value={[category]}
              multiple={false}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="تصفية حسب الفئة"
              onValueChange={(values) => {
                const next = String(values[0] ?? "all");
                setCategory(isCategory(next) ? next : "all");
              }}
            >
              <ToggleGroupItem value="all">الكل ({issues.length})</ToggleGroupItem>
              {[...categoryLabels].map(([value, label]) => (
                <ToggleGroupItem key={value} value={value} disabled={!counts.byCategory.get(value)}>
                  {label} ({counts.byCategory.get(value) ?? 0})
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          {visible.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا شيء هنا</EmptyTitle>
                <EmptyDescription>
                  {issues.length === 0 ? "كل الفحوص نظيفة." : "لا ملاحظات تطابق التصفية."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">المستوى</TableHead>
                  <TableHead>السجل</TableHead>
                  <TableHead>المشكلة</TableHead>
                  <TableHead className="w-56 text-end">الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>{severityBadge(issue.severity)}</TableCell>
                    <TableCell className="max-w-72">
                      <div className="truncate font-medium" title={issue.title}>
                        {issue.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {categoryLabels.get(issue.category)} ·{" "}
                        <code dir="ltr" className="font-mono">
                          {issue.path}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-96">
                      <div className="text-sm">{issue.message}</div>
                      <div className="text-xs text-muted-foreground">{issue.action}</div>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        {issue.repairPath && (
                          <Button
                            variant="outline"
                            size="sm"
                            nativeButton={false}
                            render={<Link to={issue.repairPath} />}
                          >
                            <ArrowSquareOutIcon data-icon="inline-start" /> افتح
                          </Button>
                        )}
                        {issue.autoRepairable && (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={repairOne.isPending}
                            onClick={() => repairOne.mutate(issue.id)}
                          >
                            <BroomIcon data-icon="inline-start" /> احذف الأصل
                          </Button>
                        )}
                        {issue.id.startsWith("asset-missing:") && (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={repairOne.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "حذف سجل الصورة وكل تعييناتها؟ الملف نفسه غير موجود أصلاً.",
                                )
                              ) {
                                repairOne.mutate(issue.id);
                              }
                            }}
                          >
                            <TrashIcon data-icon="inline-start" /> احذف السجل
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SeverityTile({
  icon,
  label,
  value,
  active,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  active: boolean;
  tone: "destructive" | "warning" | "muted";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 rounded-xl border p-4 text-start transition-colors",
        active ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-full [&_svg]:size-5",
          tone === "destructive" && "bg-destructive/10 text-destructive",
          tone === "warning" && "bg-classification-caution/15 text-classification-caution",
          tone === "muted" && "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="font-mono text-2xl font-semibold tabular-nums">
          {value.toLocaleString("ar")}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}
