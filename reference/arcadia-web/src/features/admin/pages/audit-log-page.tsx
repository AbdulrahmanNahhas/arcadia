import type { AuditLogEntry, AuditLogPage as AuditLogPageData } from "@arcadia/contracts";
import { BroomIcon, CaretDownIcon, CaretUpIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { useCurrentAccount } from "@/features/accounts/api";
import { apiFetch } from "@/lib/api";
import { AdminPageHeader } from "../components/admin-page-header";

const pageSize = 50;

export const auditKeys = {
  all: ["admin", "audit-logs"] as const,
  page: (filters: { targetType: string | null; q: string; offset: number }) =>
    [...auditKeys.all, filters] as const,
};

function fetchAuditPage(filters: { targetType: string | null; q: string; offset: number }) {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(filters.offset) });
  if (filters.targetType) params.set("targetType", filters.targetType);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  return apiFetch<AuditLogPageData>(`/api/v1/admin/audit-logs?${params.toString()}`);
}

const targetTypeLabels = new Map<string, string>([
  ["titles", "الأعمال"],
  ["installments", "الأقسام والحلقات"],
  ["media", "الوسائط"],
  ["media-artwork-ingest", "جلب الصور"],
  ["entities", "الأشخاص والاستوديوهات"],
  ["vocabularies", "المفردات"],
  ["accounts", "الحسابات"],
  ["awards", "الجوائز"],
  ["planets", "الكواكب"],
  ["relationships", "العلاقات"],
  ["audit-logs", "سجل العمليات"],
]);

function actionLabel(action: string) {
  switch (action) {
    case "admin.post":
      return "إنشاء";
    case "admin.put":
    case "admin.patch":
      return "تعديل";
    case "admin.delete":
      return "حذف";
    default:
      return action;
  }
}

/**
 * `/admin/audit` — every admin mutation the API middleware recorded (and the CLI's own rows),
 * newest first, filterable by target and text. Owner-only, matching the API.
 */
export function AuditLogPage() {
  const { data: account } = useCurrentAccount();
  const isOwner = account?.account.role === "owner";
  const [targetType, setTargetType] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const filters = { targetType, q: search, offset };
  const page = useQuery({
    queryKey: auditKeys.page(filters),
    queryFn: () => fetchAuditPage(filters),
    enabled: isOwner,
    placeholderData: (previous) => previous,
  });
  const total = page.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.floor(offset / pageSize) + 1;

  if (account && !isOwner) {
    return (
      <div className="flex min-w-0 flex-col gap-8">
        <AdminPageHeader title="سجل العمليات" description="متاح لمالك الأرشيف فقط." />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <AdminPageHeader
        title="سجل العمليات"
        description="كل تعديل إداري مرّ عبر الواجهة أو الأداة النصية: من فعله، على ماذا، ومتى."
        actions={<PruneControl />}
      />
      <Card className="mx-5 mb-6 min-w-0 sm:mx-6">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>{total} عملية</CardTitle>
              <CardDescription>
                الصفحة {current} من {pageCount}
              </CardDescription>
            </div>
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setOffset(0);
                setSearch(q);
              }}
            >
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="ابحث في الملخص أو المعرّف"
                className="h-9 w-64"
              />
              <Button type="submit" variant="outline" size="sm">
                <MagnifyingGlassIcon data-icon="inline-start" /> بحث
              </Button>
            </form>
          </div>
          {page.data && page.data.targetTypes.length > 0 && (
            <ToggleGroup
              value={[targetType ?? "all"]}
              multiple={false}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="تصفية حسب الهدف"
              onValueChange={(values) => {
                const next = values[0];
                setOffset(0);
                setTargetType(!next || next === "all" ? null : String(next));
              }}
            >
              <ToggleGroupItem value="all">الكل</ToggleGroupItem>
              {page.data.targetTypes.map((type) => (
                <ToggleGroupItem key={type} value={type}>
                  {targetTypeLabels.get(type) ?? type}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </CardHeader>
        <CardContent className="min-w-0">
          {page.data && page.data.items.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد عمليات</EmptyTitle>
                <EmptyDescription>لا شيء يطابق التصفية الحالية.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <TableHead>الوقت</TableHead>
                  <TableHead>من</TableHead>
                  <TableHead>الإجراء</TableHead>
                  <TableHead>الهدف</TableHead>
                  <TableHead>الملخص</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(page.data?.items ?? []).map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - pageSize))}
            >
              الأحدث
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + pageSize >= total}
              onClick={() => setOffset(offset + pageSize)}
            >
              الأقدم
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const when = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(entry.createdAt),
  );
  const hasChanges = Object.keys(entry.changes).length > 0;
  return (
    <>
      <TableRow>
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{when}</TableCell>
        <TableCell>
          {entry.actor ? (
            <span className="flex items-center gap-2">
              {entry.actor.avatarKey ? (
                <AccountAvatar
                  avatarKey={entry.actor.avatarKey}
                  label={entry.actor.displayName}
                  className="size-7"
                />
              ) : null}
              <span className="text-sm">{entry.actor.displayName}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">النظام / الأداة النصية</span>
          )}
        </TableCell>
        <TableCell>
          <Badge variant={entry.action.endsWith("delete") ? "destructive" : "secondary"}>
            {actionLabel(entry.action)}
          </Badge>
        </TableCell>
        <TableCell className="text-xs">
          <span className="block">
            {targetTypeLabels.get(entry.targetType) ?? entry.targetType}
          </span>
          {entry.targetId && (
            <code dir="ltr" className="block truncate font-mono text-[11px] text-muted-foreground">
              {entry.targetId}
            </code>
          )}
        </TableCell>
        <TableCell className="max-w-96 truncate text-sm" title={entry.summary}>
          {entry.summary}
        </TableCell>
        <TableCell className="text-end">
          {hasChanges && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-expanded={open}
              aria-label="التفاصيل"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <CaretUpIcon /> : <CaretDownIcon />}
            </Button>
          )}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30">
            <pre dir="ltr" className="max-h-72 overflow-auto font-mono text-xs leading-5">
              {JSON.stringify(entry.changes, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** Owner-only prune: "delete everything older than N days", confirmed inline. */
function PruneControl() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState("180");
  const [result, setResult] = useState<string | null>(null);
  const prune = useMutation({
    mutationFn: (olderThanDays: number) =>
      apiFetch<{ deleted: number }>("/api/v1/admin/audit-logs", {
        method: "DELETE",
        body: JSON.stringify({ olderThanDays }),
      }),
    onSuccess: (data) => {
      setResult(`حُذفت ${data.deleted} عملية.`);
      void queryClient.invalidateQueries({ queryKey: auditKeys.all });
    },
    onError: (error) => setResult(error instanceof Error ? error.message : "تعذّر التنظيف."),
  });
  const value = Number.parseInt(days, 10);
  const valid = Number.isInteger(value) && value >= 1;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">احذف الأقدم من</span>
        <Input
          inputMode="numeric"
          value={days}
          onChange={(event) => setDays(event.target.value)}
          className="h-9 w-20 text-center font-mono"
          aria-label="عدد الأيام"
        />
        <span className="text-muted-foreground">يوماً</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!valid || prune.isPending}
          onClick={() => {
            if (window.confirm(`حذف كل العمليات الأقدم من ${value} يوماً نهائياً؟`)) {
              setResult(null);
              prune.mutate(value);
            }
          }}
        >
          <BroomIcon data-icon="inline-start" /> تنظيف
        </Button>
      </div>
      {result && <p className="text-xs text-muted-foreground">{result}</p>}
    </div>
  );
}
