import type { ValidationIssue } from "@arcadia/contracts";
import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon, CircleAlertIcon, InfoIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/features/editor/fields/work-fields";

type Severity = ValidationIssue["severity"];
type Category = ValidationIssue["category"];
type IssueDestination =
  | { kind: "work"; workId: string }
  | { kind: "images" }
  | { kind: "vocabularies" };

const severityLabels = {
  error: "يحتاج معالجة",
  warning: "مراجعة مطلوبة",
  info: "للمراجعة",
} satisfies Record<Severity, string>;

const severityVariants = {
  error: "destructive",
  warning: "secondary",
  info: "outline",
} satisfies Record<Severity, "destructive" | "secondary" | "outline">;

const categoryLabels = {
  integrity: "سلامة البيانات",
  metadata: "معلومات العمل",
  media: "الصور والوسائط",
  vocabulary: "المفردات",
  jellyfin: "التشغيل",
} satisfies Record<Category, string>;

function getIssueDestination(issue: ValidationIssue) {
  if (issue.entityType === "work") {
    return { kind: "work", workId: issue.entityId } satisfies IssueDestination;
  }

  if (issue.entityType === "installment") {
    const workId = issue.repairPath?.match(/^\/admin\/catalog\/([0-9a-f-]+)(?:\/|$)/i)?.[1];
    if (workId) {
      return { kind: "work", workId } satisfies IssueDestination;
    }
  }

  if (issue.entityType === "asset") {
    return { kind: "images" } satisfies IssueDestination;
  }

  if (issue.entityType === "vocabulary") {
    return { kind: "vocabularies" } satisfies IssueDestination;
  }

  return null;
}

function IssueActionLink({ destination, label }: { destination: IssueDestination; label: string }) {
  const className = buttonVariants({ variant: "outline", size: "sm" });
  const action = (
    <>
      {label}
      <ArrowUpRightIcon data-icon="inline-end" />
    </>
  );

  if (destination.kind === "work") {
    return (
      <Link
        to="/database/works/$workId"
        params={{ workId: destination.workId }}
        className={className}
      >
        {action}
      </Link>
    );
  }
  if (destination.kind === "images") {
    return (
      <Link to="/database/images" className={className}>
        {action}
      </Link>
    );
  }
  return (
    <Link to="/database/$collection" params={{ collection: "vocabularies" }} className={className}>
      {action}
    </Link>
  );
}

function actionLabel(issue: ValidationIssue) {
  switch (issue.path) {
    case "title.metadata":
      return "مراجعة بيانات العمل";
    case "media.poster":
      return "فتح العمل واختيار صورة موجودة";
    case "media.assignments":
    case "media.file":
      return "مراجعة مكتبة الصور";
    case "installment.imdbId":
    case "installment.episodes":
      return "فتح العمل ومراجعة الأجزاء";
    default:
      return issue.entityType === "vocabulary" ? "مراجعة المفردات" : "فتح السجل المرتبط";
  }
}

function IssueIcon({ severity }: { severity: Severity }) {
  if (severity === "info") return <InfoIcon aria-hidden="true" />;
  return <CircleAlertIcon aria-hidden="true" />;
}

function ValidationIssueCard({ issue }: { issue: ValidationIssue }) {
  const destination = getIssueDestination(issue);
  const message =
    issue.path === "media.poster"
      ? "لا يوجد ملصق أساسي للعمل. اختر صورة مسجلة في مكتبة الصور واربطها بهذا العمل."
      : issue.path === "installment.imdbId"
        ? "لا يوجد معرّف IMDb أو TMDB لهذا الجزء."
        : issue.message;

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <CardTitle className="wrap-break-word">{issue.title}</CardTitle>
            <CardDescription>{message}</CardDescription>
          </div>
          <Badge variant={severityVariants[issue.severity]}>
            <IssueIcon severity={issue.severity} />
            {severityLabels[issue.severity]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{categoryLabels[issue.category]}</Badge>
          <code className="max-w-full truncate text-xs text-muted-foreground" dir="ltr">
            {issue.path}
          </code>
        </div>
        {issue.path !== "media.poster" && (
          <p className="mt-3 text-sm text-muted-foreground">
            {issue.path === "installment.episodes"
              ? "افتح العمل وأضف الحلقات من قسم البنية أو محرر JSON."
              : issue.action}
          </p>
        )}
      </CardContent>
      {destination && (
        <CardFooter>
          <IssueActionLink destination={destination} label={actionLabel(issue)} />
        </CardFooter>
      )}
    </Card>
  );
}

function SeveritySummary({ issues }: { issues: ValidationIssue[] }) {
  const counts = {
    error: issues.filter((issue) => issue.severity === "error").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length,
  };

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {(["error", "warning", "info"] as const).map((severity) => (
        <Card key={severity} size="sm">
          <CardHeader>
            <CardDescription>{severityLabels[severity]}</CardDescription>
            <CardTitle>{counts[severity]}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function ValidationResults({ issues }: { issues: ValidationIssue[] }) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");
  if (issues.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>المكتبة سليمة</EmptyTitle>
          <EmptyDescription>لم يعثر الفحص على ملاحظات تحتاج إلى مراجعة.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const filteredIssues = issues.filter(
    (issue) =>
      (severity === "all" || issue.severity === severity) &&
      (category === "all" || issue.category === category) &&
      `${issue.title} ${issue.message} ${issue.path}`.toLowerCase().includes(search.toLowerCase()),
  );
  const rank = { error: 0, warning: 1, info: 2 } satisfies Record<Severity, number>;
  const orderedIssues = filteredIssues.toSorted((left, right) => {
    return (
      rank[left.severity] - rank[right.severity] || left.title.localeCompare(right.title, "ar")
    );
  });

  return (
    <div className="flex flex-col gap-5" aria-live="polite">
      <SeveritySummary issues={issues} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">الملاحظات</h2>
        <Badge variant="outline">
          {filteredIssues.length} من {issues.length} ملاحظة
        </Badge>
      </div>
      <FieldGroup>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            aria-label="بحث في ملاحظات التحقق"
            placeholder="ابحث في الملاحظات…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <SelectField
            label="درجة الملاحظة"
            value={severity}
            onChange={setSeverity}
            items={[
              { value: "all", label: "كل الدرجات" },
              ...Object.entries(severityLabels).map(([value, label]) => ({ value, label })),
            ]}
          />
          <SelectField
            label="الفئة"
            value={category}
            onChange={setCategory}
            items={[
              { value: "all", label: "كل الفئات" },
              ...Object.entries(categoryLabels).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
      </FieldGroup>
      {!filteredIssues.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد ملاحظات مطابقة</EmptyTitle>
            <EmptyDescription>غيّر البحث أو مرشحات الدرجة والفئة.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <div className="grid gap-3 xl:grid-cols-2">
        {orderedIssues.map((issue) => (
          <ValidationIssueCard key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  );
}
