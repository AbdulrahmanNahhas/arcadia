import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  BracesIcon,
  DatabaseIcon,
  DownloadIcon,
  RefreshCwIcon,
  ServerIcon,
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
import { readinessOptions } from "@/features/server/api";

import { PageHeader } from "./page-header";
import { RecordTable } from "./record-table";

export function DashboardHome() {
  const health = useQuery(readinessOptions());
  const connected = health.isSuccess;
  return (
    <>
      <PageHeader
        title="لوحة التحكم"
        description="إدارة بيانات المكتبة والخدمات والملفات وأجهزة العائلة من مكان واحد."
        eyebrow="نحّاسيو / إدارة الخادم"
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            <p className="text-xs text-muted-foreground">
              {connected ? "الخدمة وقاعدة البيانات جاهزتان" : "تحقق من تشغيل الخدمة المحلية"}
            </p>
          </CardContent>
        </Card>
        {[
          { title: "التنزيلات", description: "طابور المهام والملفات" },
          { title: "مساحة المكتبة", description: "الاستخدام والمجلدات" },
          { title: "آخر نسخة احتياطية", description: "النسخ والتحقق من الاستعادة" },
        ].map((stat) => (
          <Card key={stat.title} size="sm">
            <CardHeader>
              <CardDescription>{stat.title}</CardDescription>
              <CardTitle>—</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.description} · قيد الربط</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>قاعدة بيانات العائلة</CardTitle>
            <CardDescription>
              الأعمال والحلقات والكيانات والجوائز والصور، مع نوافذ تحرير مركّزة وأدوات متقدمة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: "TMDB وFanart",
                  to: "/database/imports",
                  description: "استيراد ومراجعة البيانات والصور",
                },
                {
                  title: "محرر JSON",
                  to: "/database/json",
                  description: "مسودات وأخطاء واضحة ومعاينة تغييرات",
                },
                {
                  title: "مكتبة الصور",
                  to: "/database/images",
                  description: "الملصقات والخلفيات وربطها بالسجلات",
                },
                {
                  title: "جميع الجداول",
                  to: "/database/tables",
                  description: "مخطط حقيقي لكل جداول البيانات",
                },
              ].map((tool) => (
                <Link
                  key={tool.to}
                  to={tool.to}
                  className="flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-accent"
                >
                  <span className="text-sm font-semibold">{tool.title}</span>
                  <span className="text-xs text-muted-foreground">{tool.description}</span>
                </Link>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Link to="/database/works/new" className={buttonVariants({ variant: "outline" })}>
              <BracesIcon data-icon="inline-start" />
              ابدأ مسودة عمل
            </Link>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>الاتصال المحلي</CardTitle>
            <CardDescription>الخادم وقاعدة البيانات يعملان على هذا الجهاز.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-primary">
                <ServerIcon />
              </span>
              <Badge variant={connected ? "default" : "outline"}>
                {connected ? "الاتصال جاهز" : "بانتظار الاتصال"}
              </Badge>
              <p className="text-sm leading-6 text-muted-foreground">
                {connected
                  ? "يمكنك استكشاف جميع واجهات الإدارة. الوصول للسجلات والحفظ سيُتاحان عند اكتمال توصيل الخدمات."
                  : "تعذّر الاتصال بالخادم. تحقق من تشغيله ثم حاول مرة أخرى."}
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              disabled={health.isFetching}
              onClick={() => {
                void health.refetch();
              }}
            >
              <RefreshCwIcon data-icon="inline-start" />
              {health.isFetching ? "جارٍ الفحص" : "إعادة فحص الاتصال"}
            </Button>
          </CardFooter>
        </Card>
      </div>
      <RecordTable
        title="النشاط والمهام الأخيرة"
        columns={["المهمة", "النوع", "الحالة", "الوقت", "النتيجة"]}
      />
      <div className="flex flex-wrap gap-3">
        <Link
          to="/server/$section"
          params={{ section: "downloads" }}
          className={buttonVariants({ variant: "outline" })}
        >
          <DownloadIcon data-icon="inline-start" />
          التنزيلات
        </Link>
        <Link
          to="/server/$section"
          params={{ section: "backups" }}
          className={buttonVariants({ variant: "outline" })}
        >
          <ArchiveIcon data-icon="inline-start" />
          النسخ والاستعادة
        </Link>
      </div>
    </>
  );
}
