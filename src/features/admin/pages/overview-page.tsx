import {
  ActivityIcon,
  ArrowLeftIcon,
  BuildingsIcon,
  DatabaseIcon,
  PlanetIcon,
  ShieldWarningIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEntities, getTrackingPage, getWorks } from "@/server/library.functions";
import { getAdminPlanets, getCatalogValidation } from "@/server/platform.functions";
import { AdminPageHeader } from "../components/admin-page-header";

export function AdminOverviewPage() {
  const { data: works } = useSuspenseQuery({ queryKey: ["works"], queryFn: () => getWorks() });
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  const { data: planets } = useSuspenseQuery({
    queryKey: ["admin-planets"],
    queryFn: () => getAdminPlanets(),
  });
  const { data: issues } = useSuspenseQuery({
    queryKey: ["catalog-validation"],
    queryFn: () => getCatalogValidation(),
  });
  const { data: tracking } = useSuspenseQuery({
    queryKey: ["tracking-overview"],
    queryFn: () => getTrackingPage({ data: { limit: 5 } }),
  });
  const stats = [
    { title: "الأعمال", value: works.length, description: "كل أنواع الوسائط", icon: DatabaseIcon },
    {
      title: "الكيانات",
      value: entities.length,
      description: `${entities.filter((item) => item.entityType === "person").length} شخص`,
      icon: BuildingsIcon,
    },
    {
      title: "الكواكب",
      value: planets.filter((planet) => planet.isActive).length,
      description: `${planets.reduce((sum, planet) => sum + planet.reviewCount, 0)} إسناد للمراجعة`,
      icon: PlanetIcon,
    },
    {
      title: "التحقق",
      value: issues.length,
      description: `${issues.filter((issue) => issue.severity === "error").length} خطأ`,
      icon: ShieldWarningIcon,
    },
  ];
  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="نظرة عامة"
        description="ملخص تشغيلي هادئ للكتالوج، جودة البيانات، والتقدم المحلي."
      />
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 px-6"
        aria-label="مؤشرات الكتالوج"
      >
        {stats.map(({ title, value, description, icon: Icon }) => (
          <Card key={title}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="text-muted-foreground" />
              </div>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <strong className="font-mono text-3xl font-semibold tabular-nums">
                {new Intl.NumberFormat("ar").format(value)}
              </strong>
            </CardContent>
          </Card>
        ))}
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr] p-6 pt-0">
        <Card>
          <CardHeader>
            <CardTitle>آخر نشاط</CardTitle>
            <CardDescription>أحدث خمس نقاط مسجلة في المتعقّب المحلي.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {tracking.items.map((entry) => {
              const work = works.find((item) => item.id === entry.workId);
              return (
                <div key={entry.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <ActivityIcon className="text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {work?.arabicTitle || work?.title || entry.workId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.occurredOn} · {entry.progress} {work?.progressUnit}
                    </p>
                  </div>
                  <Badge variant="outline">{entry.status}</Badge>
                </div>
              );
            })}
            {!tracking.items.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                لا يوجد نشاط مسجل بعد.
              </p>
            )}
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/admin/tracker" />}
              className="mt-2"
            >
              فتح المتعقّب <ArrowLeftIcon data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>الأولويات</CardTitle>
            <CardDescription>أعمال إدارية تحتاج قراراً بشرياً.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Priority
              label="أخطاء تحقق"
              count={issues.filter((issue) => issue.severity === "error").length}
              to="/admin/validation"
            />
            <Priority
              label="إسنادات كواكب للمراجعة"
              count={planets.reduce((sum, planet) => sum + planet.reviewCount, 0)}
              to="/admin/planets"
            />
            <Priority
              label="كيانات بلا وصف"
              count={entities.filter((entity) => !entity.description.trim()).length}
              to="/admin/people"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Priority({ label, count, to }: { label: string; count: number; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
    >
      <span className="flex-1 text-sm">{label}</span>
      <Badge variant={count ? "secondary" : "outline"}>{count}</Badge>
      <ArrowLeftIcon className="text-muted-foreground" />
    </Link>
  );
}
