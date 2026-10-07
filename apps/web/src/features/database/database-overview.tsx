import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  BracesIcon,
  DatabaseIcon,
  ImagesIcon,
  ImportIcon,
  TablePropertiesIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/features/dashboard/page-header";
import { ServiceNotice } from "@/features/dashboard/service-notice";

import { collections } from "./collections";
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
      <ServiceNotice />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>المخطط الحالي</CardDescription>
            <CardTitle>{tableCount} جدولاً</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">من مخطط قاعدة البيانات الفعلي</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>الحقول</CardDescription>
            <CardTitle>{schemaCatalog.length} حقلاً</CardTitle>
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
        <CardHeader>
          <CardTitle>المحتوى والمعرفة</CardTitle>
          <CardDescription>اختر فئة لفتح جدولها وأدواتها.</CardDescription>
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
        <CardFooter>
          <Link to="/database/tables" className={buttonVariants({ variant: "outline" })}>
            <TablePropertiesIcon data-icon="inline-start" />
            استكشاف جميع الجداول
          </Link>
        </CardFooter>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {tools.map((tool) => (
          <Card key={tool.to}>
            <CardHeader>
              <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
                <tool.icon />
              </span>
              <CardTitle>{tool.title}</CardTitle>
              <CardDescription>{tool.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                الواجهة متاحة للمعاينة، والخدمة قيد الربط.
              </p>
            </CardContent>
            <CardFooter>
              <Link to={tool.to} className={buttonVariants({ variant: "outline" })}>
                فتح الأدوات
                <ArrowLeftIcon data-icon="inline-end" />
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <DatabaseIcon className="size-4" />
        هذا استعراض للمخطط والواجهات، ولا يغيّر بيانات المكتبة.
      </p>
    </>
  );
}
