import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  BracesIcon,
  ImagesIcon,
  ImportIcon,
  TablePropertiesIcon,
} from "lucide-react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/features/dashboard/page-header";

import { collections } from "./collections";
import { databaseSchemaOptions } from "./database.queries";
import schemaCatalog from "./schema-catalog.json";

const tableCount = new Set(schemaCatalog.map((column) => column.table_name)).size;
const tools = [
  {
    to: "/database/imports",
    title: "استيراد البيانات",
    description: "ابحث في TMDB، راجع التغييرات، وأضف الصور من Fanart.",
    icon: ImportIcon,
  },
  {
    to: "/database/images",
    title: "مكتبة الصور",
    description: "الملصقات والخلفيات والشعارات وربطها بالسجلات.",
    icon: ImagesIcon,
  },
  {
    to: "/database/json",
    title: "محرر JSON",
    description: "مسودات قابلة للتحقق، تحرير متقدم، ومعاينة قبل الحفظ.",
    icon: BracesIcon,
  },
] as const;

export function DatabaseOverview() {
  const schema = useQuery(databaseSchemaOptions());
  return (
    <>
      <PageHeader
        title="قاعدة البيانات"
        description="مكان واحد لإدارة جميع بيانات المكتبة: من العمل وحلقاته إلى الصور والمراجع والعلاقات."
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
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>المخطط الحالي</CardDescription>
            <CardTitle>{schema.data?.length ?? tableCount} جدولاً</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">من مخطط قاعدة البيانات الفعلي</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>الحقول</CardDescription>
            <CardTitle>
              {schema.data?.reduce((total, table) => total + table.columns.length, 0) ??
                schemaCatalog.length}{" "}
              حقلاً
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">الأنواع والمفاتيح وقابلية القيم الفارغة</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>فئات التحرير</CardDescription>
            <CardTitle>{collections.length} مساحة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">نوافذ مركّزة بدلاً من محرر ضخم واحد</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>المحتوى والمعرفة</CardTitle>
            <CardDescription>اختر فئة لفتح جدولها وأدواتها.</CardDescription>
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
          <Card key={tool.to} interactive className="group flex flex-col justify-between">
            <CardHeader className="justify-between h-full">
              <div className="flex flex-col gap-3 mb-2">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <tool.icon className="size-5" />
                </span>
                <div className="flex flex-col gap-1">
                  <CardTitle>{tool.title}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </div>
              </div>
              <Link
                to={tool.to}
                className={buttonVariants({
                  variant: "outline",
                  className: "group/btn w-full justify-between mt-auto",
                })}
              >
                <span>فتح الأدوات</span>
                <ArrowLeftIcon data-icon="inline-end" />
              </Link>
            </CardHeader>
          </Card>
        ))}
      </div>
    </>
  );
}
