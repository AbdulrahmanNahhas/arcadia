import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  BracesIcon,
  Building2Icon,
  DatabaseIcon,
  GlobeIcon,
  HistoryIcon,
  ImagesIcon,
  ListChecksIcon,
  ServerIcon,
  UsersIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CatalogCountCards } from "@/features/database/catalog-count-cards";
import { readinessOptions } from "@/features/server/api";

import { PageHeader } from "./page-header";

const editorialActions = [
  {
    route: "validation",
    title: "التحقق من المكتبة",
    description: "راجع الملاحظات وانتقل مباشرة إلى السجلات التي تحتاج عملاً.",
    icon: ListChecksIcon,
  },
  {
    route: "json",
    title: "محرر JSON",
    description: "حرر بيانات العمل كاملة مع مراجعة التغييرات قبل الحفظ.",
    icon: BracesIcon,
  },
  {
    route: "people",
    title: "الأشخاص",
    description: "راجع الأشخاص ومساهماتهم في الأعمال.",
    icon: UsersIcon,
  },
  {
    route: "studios",
    title: "الاستوديوهات",
    description: "أدر الاستوديوهات وعلاقاتها بالمكتبة.",
    icon: Building2Icon,
  },
  {
    route: "planets",
    title: "العوالم",
    description: "نظّم الأعمال ضمن العوالم والسلاسل.",
    icon: GlobeIcon,
  },
  {
    route: "images",
    title: "مكتبة الصور",
    description: "راجع ملفات الصور وروابطها بالسجلات.",
    icon: ImagesIcon,
  },
  {
    route: "revisions",
    title: "سجل التعديلات",
    description: "راجع التغييرات السابقة واستعد سجلاً عند الحاجة.",
    icon: HistoryIcon,
  },
] as const;

function QuickAccessLink({ action }: { action: (typeof editorialActions)[number] }) {
  const contents = (
    <>
      <action.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold">{action.title}</span>
        <span className="text-xs text-muted-foreground">{action.description}</span>
      </span>
    </>
  );
  const className =
    "flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent";

  switch (action.route) {
    case "validation":
      return (
        <Link to="/database/validation" className={className}>
          {contents}
        </Link>
      );
    case "json":
      return (
        <Link to="/database/json" className={className}>
          {contents}
        </Link>
      );
    case "people":
      return (
        <Link to="/database/$collection" params={{ collection: "people" }} className={className}>
          {contents}
        </Link>
      );
    case "studios":
      return (
        <Link to="/database/$collection" params={{ collection: "studios" }} className={className}>
          {contents}
        </Link>
      );
    case "planets":
      return (
        <Link to="/database/$collection" params={{ collection: "planets" }} className={className}>
          {contents}
        </Link>
      );
    case "images":
      return (
        <Link to="/database/images" className={className}>
          {contents}
        </Link>
      );
    case "revisions":
      return (
        <Link to="/database/revisions" className={className}>
          {contents}
        </Link>
      );
  }
}

export function DashboardHome() {
  const health = useQuery(readinessOptions());
  const connected = health.isSuccess;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="لوحة المكتبة"
        description="نظرة مباشرة على محتوى المكتبة وأدوات العمل التحريري."
        eyebrow="نحّاسيو / إدارة المكتبة"
        actions={
          <Link to="/database" className={buttonVariants()}>
            <DatabaseIcon data-icon="inline-start" />
            فتح قاعدة البيانات
            <ArrowLeftIcon data-icon="inline-end" />
          </Link>
        }
      />
      {health.isError && (
        <Alert variant="destructive">
          <AlertTitle>الخادم غير متاح الآن</AlertTitle>
          <AlertDescription>تحقق من تشغيل الخدمة المحلية، ثم أعد فحص الاتصال.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <CatalogCountCards />
        </div>
        <Card size="sm">
          <CardHeader>
            <CardDescription>حالة الخادم</CardDescription>
            <CardTitle>
              <span role="status" aria-live="polite">
                {health.isPending ? "جارٍ الاتصال" : connected ? "متصل" : "غير متصل"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={connected ? "default" : "outline"}>
                {connected ? "الخدمة جاهزة" : "بانتظار الاتصال"}
              </Badge>
              <span className="text-xs text-muted-foreground">الخادم وقاعدة البيانات</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              disabled={health.isFetching}
              onClick={() => void health.refetch()}
            >
              <ServerIcon data-icon="inline-start" />
              {health.isFetching ? "جارٍ الفحص" : "إعادة فحص الاتصال"}
            </Button>
          </CardFooter>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>وصول سريع</CardTitle>
          <CardDescription>افتح مساحة التحرير المناسبة لمهمتك التالية.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {editorialActions.map((action) => (
              <QuickAccessLink key={action.route} action={action} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
