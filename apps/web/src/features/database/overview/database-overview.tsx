import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  BracesIcon,
  HistoryIcon,
  ImagesIcon,
  ListChecksIcon,
  TablePropertiesIcon,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { databaseSchemaOptions } from "@/features/database/data/database.queries";
import { CatalogCountCards } from "@/features/database/overview/catalog-count-cards";
import { collections } from "@/features/database/records/collections";

const tools = [
  {
    to: "/database/validation",
    title: "التحقق من المكتبة",
    description: "اعثر على السجلات التي تحتاج مراجعة وافتحها مباشرة.",
    icon: ListChecksIcon,
  },
  {
    to: "/database/json",
    title: "محرر JSON",
    description: "حرر سجل العمل كاملاً مع المراجعة قبل الحفظ.",
    icon: BracesIcon,
  },
  {
    to: "/database/images",
    title: "مكتبة الصور",
    description: "الملصقات والخلفيات والشعارات وربطها بالسجلات.",
    icon: ImagesIcon,
  },
  {
    to: "/database/revisions",
    title: "سجل التعديلات",
    description: "راجع التغييرات السابقة واستعد سجلاً عند الحاجة.",
    icon: HistoryIcon,
  },
] as const;

export function DatabaseOverview() {
  const schema = useQuery(databaseSchemaOptions());
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="قاعدة البيانات"
        description="إدارة المحتوى والعلاقات والصور ومراجعة سلامة المكتبة من مكان واحد."
        eyebrow="مساحة البيانات"
        actions={
          <Link to="/database/works/new" className={buttonVariants()}>
            مسودة عمل جديد
          </Link>
        }
      />
      {schema.isError && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر الاتصال بالبيانات</AlertTitle>
          <AlertDescription>{schema.error.message}</AlertDescription>
        </Alert>
      )}
      <CatalogCountCards />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardDescription>المخطط الحالي</CardDescription>
            <CardTitle>
              {schema.isPending ? "…" : schema.isError ? "—" : `${schema.data.length} جدولاً`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">جداول المخطط الحالي</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>الحقول</CardDescription>
            <CardTitle>
              {schema.isPending
                ? "…"
                : schema.isError
                  ? "—"
                  : `${schema.data.reduce((total, table) => total + table.columns.length, 0)} حقلاً`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">الحقول المعرّفة في قاعدة البيانات</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>فئات المكتبة</CardTitle>
            <CardDescription>افتح فئة لعرض سجلاتها وتحريرها.</CardDescription>
          </div>
          <Link to="/database/tables" className={buttonVariants({ variant: "outline" })}>
            <TablePropertiesIcon data-icon="inline-start" />
            استكشاف جميع الجداول
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection) => (
              <Link
                key={collection.slug}
                to="/database/$collection"
                params={{ collection: collection.slug }}
                className="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <span className="flex items-center gap-3">
                  <collection.icon className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{collection.title}</span>
                </span>
                <ArrowLeftIcon className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Card key={tool.to} size="sm">
            <CardHeader>
              <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <tool.icon aria-hidden="true" />
              </span>
              <CardTitle>{tool.title}</CardTitle>
              <CardDescription>{tool.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to={tool.to}
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full justify-between",
                })}
              >
                <span>فتح</span>
                <ArrowLeftIcon data-icon="inline-end" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
