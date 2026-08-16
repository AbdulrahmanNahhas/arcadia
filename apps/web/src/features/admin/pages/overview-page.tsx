import {
  ArrowLeftIcon,
  BuildingsIcon,
  FilmSlateIcon,
  LinkSimpleIcon,
  PlanetIcon,
  ShieldCheckIcon,
  SparkleIcon,
  TelevisionSimpleIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { getAdminOverview } from "@/server/library.functions";
import { getCatalogValidation } from "@/server/platform.functions";
import { AdminPageHeader } from "../components/admin-page-header";

const number = new Intl.NumberFormat("ar");

export function AdminOverviewPage() {
  const { data: metrics } = useSuspenseQuery({
    queryKey: ["admin-overview-v2"],
    queryFn: () => getAdminOverview(),
  });
  const { data: issues } = useSuspenseQuery({
    queryKey: ["catalog-validation"],
    queryFn: () => getCatalogValidation(),
  });
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const completeReleaseDates = metrics.installments - metrics.missing_release_dates;
  const readiness = [
    {
      label: "العناوين العربية",
      complete: metrics.titles - metrics.missing_arabic,
      total: metrics.titles,
    },
    {
      label: "ملصقات العناوين",
      complete: metrics.titles - metrics.missing_posters,
      total: metrics.titles,
    },
    {
      label: "تواريخ الأجزاء",
      complete: completeReleaseDates,
      total: metrics.installments,
    },
    {
      label: "التقييمات التحريرية المكتملة",
      complete: metrics.scored_installments,
      total: metrics.installments,
    },
    {
      label: "التحليل والتحذيرات",
      complete: metrics.titles - metrics.missing_guidance,
      total: metrics.titles,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-10">
      <AdminPageHeader
        title="مركز قيادة الأرشيف"
        description="ما يحتاج قراراً تحريرياً الآن، وكيف تتدفق العناوين إلى أجزاء وحلقات في PostgreSQL v2."
      />

      <div className="flex flex-col gap-6 px-5 sm:px-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>خريطة الكتالوج</CardTitle>
                <CardDescription>
                  البنية الفعلية التي يستهلكها الموقع، لا جداول الإصدار القديم.
                </CardDescription>
              </div>
              <Badge variant="outline">PostgreSQL v2</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1.25fr_auto_1fr]">
              <OrbitMetric
                icon={FilmSlateIcon}
                label="عنوان جامع"
                value={metrics.titles}
                detail={`${metrics.private_titles} مخفي عن المنصة`}
              />
              <OrbitArrow />
              <OrbitMetric
                icon={TelevisionSimpleIcon}
                label="موسم أو فيلم"
                value={metrics.installments}
                detail={`${metrics.seasons} موسم · ${metrics.movies} فيلم · ${metrics.specials} خاص`}
                primary
              />
              <OrbitArrow />
              <OrbitMetric
                icon={SparkleIcon}
                label="حلقة"
                value={metrics.episodes}
                detail="مرتبطة بجزء ثابت"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>جاهزية النشر</CardTitle>
              <CardDescription>
                اكتمال البيانات التي تظهر للعائلة في صفحات التصفح والتفاصيل.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {readiness.map((item) => {
                const percentage = item.total
                  ? Math.round((item.complete / item.total) * 100)
                  : 100;
                return (
                  <div key={item.label} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span>{item.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {number.format(item.complete)} / {number.format(item.total)}
                      </span>
                    </div>
                    <Progress value={percentage} aria-label={`${item.label}: ${percentage}%`} />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>قائمة العمل التالية</CardTitle>
              <CardDescription>روابط مباشرة إلى النواقص التي تستحق المعالجة أولاً.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <QueueItem label="أخطاء تمنع الاعتماد" count={errors} to="/admin/validation" urgent />
              <QueueItem
                label="أجزاء بلا تاريخ إصدار"
                count={metrics.missing_release_dates}
                to="/admin/catalog"
              />
              <QueueItem
                label="عناوين بلا تحليل أو تحذير"
                count={metrics.missing_guidance}
                to="/admin/catalog"
              />
              <QueueItem
                label="عناوين بلا كوكب"
                count={metrics.unassigned_titles}
                to="/admin/planets"
              />
              <QueueItem
                label="عناوين بلا ملصق"
                count={metrics.missing_posters}
                to="/admin/catalog"
              />
              <QueueItem
                label="أصول غير مستخدمة"
                count={metrics.unreferenced_assets}
                to="/admin/media"
              />
              <QueueItem
                label="أخطاء حذف ملفات"
                count={metrics.media_failures}
                to="/admin/media"
                urgent
              />
              <QueueItem
                label="مصطلحات مؤرشفة مستخدمة"
                count={metrics.inactive_term_usage}
                to="/admin/vocabularies"
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>شبكة المعرفة</CardTitle>
              <CardDescription>
                الكيانات والعلاقات التي تغذي صفحات الأشخاص والاستوديوهات.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <KnowledgeMetric icon={UserIcon} label="الأشخاص" value={metrics.people} />
                <KnowledgeMetric
                  icon={BuildingsIcon}
                  label="الاستوديوهات"
                  value={metrics.studios}
                />
                <KnowledgeMetric icon={LinkSimpleIcon} label="المساهمات" value={metrics.credits} />
                <KnowledgeMetric
                  icon={FilmSlateIcon}
                  label="علاقات العناوين"
                  value={metrics.relationships}
                />
                <KnowledgeMetric icon={PlanetIcon} label="الكواكب النشطة" value={metrics.planets} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>حالة النظام</CardTitle>
              <CardDescription>المصادقة والتكاملات المتاحة في هذه النسخة.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Alert>
                <ShieldCheckIcon />
                <AlertTitle>جلسات الحسابات مفعّلة</AlertTitle>
                <AlertDescription>
                  تحمي Better Auth الواجهة وواجهات API بجلسات حقيقية وصلاحيات دقيقة. حسابات البذور
                  مخصصة للتطوير فقط، والتسجيل العام مغلق لصالح الدعوات وإدارة المالك.
                </AlertDescription>
              </Alert>
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">PostgreSQL جاهز</Badge>
                <Badge variant="secondary">Better Auth جاهز</Badge>
                <Badge variant="outline">OpenAPI v1</Badge>
                <Badge variant="outline">Jellyfin مؤجل</Badge>
                <Badge variant="outline">التشغيل مؤجل</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OrbitMetric({
  icon: Icon,
  label,
  value,
  detail,
  primary = false,
}: {
  icon: ComponentType;
  label: string;
  value: number;
  detail: string;
  primary?: boolean;
}) {
  return (
    <div className="flex min-h-36 flex-col justify-between rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon />
      </div>
      <div>
        <strong className="font-mono text-4xl font-semibold tabular-nums">
          {number.format(value)}
        </strong>
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      </div>
      {primary ? <span className="mt-3 h-1 rounded-full bg-primary" aria-hidden="true" /> : null}
    </div>
  );
}

function OrbitArrow() {
  return (
    <div className="hidden items-center text-muted-foreground md:flex" aria-hidden="true">
      <ArrowLeftIcon />
    </div>
  );
}

function QueueItem({
  label,
  count,
  to,
  urgent = false,
}: {
  label: string;
  count: number;
  to: string;
  urgent?: boolean;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      <Badge variant={urgent && count ? "destructive" : count ? "secondary" : "outline"}>
        {number.format(count)}
      </Badge>
      <ArrowLeftIcon />
    </Link>
  );
}

function KnowledgeMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <Icon />
      <strong className="font-mono text-2xl tabular-nums">{number.format(value)}</strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
