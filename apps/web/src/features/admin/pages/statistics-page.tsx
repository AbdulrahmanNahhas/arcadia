import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { getAdminStatistics } from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";

const chartConfig = {
  value: {
    label: "العدد",
    color: "var(--chart-1)",
  },
  secondary: {
    label: "ثانوي",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type Pair = {
  key: string;
  value: number;
};

type Ranked = Pair & {
  labelAr: string;
};

export function StatisticsPage() {
  const [visibility, setVisibility] = useState<"all" | "public" | "private">("all");

  const { data } = useSuspenseQuery({
    queryKey: ["admin-statistics", visibility],
    queryFn: () => getAdminStatistics(visibility),
  });

  const scoreDistribution = data.scoreDistribution.map((item) => ({
    key: item.bucket,
    labelAr: item.bucket,
    value: item.value,
  }));

  return (
    <div dir="rtl" className="flex min-w-0 flex-col gap-6 pb-12">
      <AdminPageHeader
        title="إحصاءات الكتالوج"
        description="قراءة تحريرية لبنية الأرشيف وتغطيته، لا أرقام زينة منفصلة عن العمل اليومي."
        actions={
          <ToggleGroup
            value={[visibility]}
            onValueChange={(value) => {
              setVisibility((value[0] as typeof visibility) ?? "all");
            }}
            variant="outline"
            aria-label="نطاق الإحصاءات"
            dir="rtl"
          >
            <ToggleGroupItem value="all">الكل</ToggleGroupItem>

            <ToggleGroupItem value="public">العام</ToggleGroupItem>

            <ToggleGroupItem value="private">الخاص</ToggleGroupItem>
          </ToggleGroup>
        }
      />

      <div className="grid auto-rows-fr gap-5 px-5 sm:px-6 xl:grid-cols-12">
        <DonutCard
          title="الرؤية"
          description="العناوين العامة والخاصة"
          data={data.visibility}
          className="xl:col-span-4"
        />

        <DistributionCard
          title="نوع الكتالوج"
          description="أفلام مقابل أعمال ذات مواسم"
          data={data.kinds}
          className="xl:col-span-4"
        />

        <CoverageCard
          scored={data.scoreCoverage.scored}
          total={data.scoreCoverage.total}
          className="xl:col-span-4"
        />

        <TimelineCard data={data.releaseTimeline} className="xl:col-span-8" />

        <DistributionCard
          title="حالة الأجزاء"
          description="الحالة الواقعية لكل جزء"
          data={data.installmentStatus}
          className="xl:col-span-4"
        />

        <RankedCard
          title="التصنيفات"
          description="الأكثر حضوراً في الكتالوج"
          data={data.genres}
          className="xl:col-span-4"
        />

        <RankedCard
          title="الوسوم الأكثر حضوراً"
          description="الوسوم المستخدمة بكثرة"
          data={data.tags}
          className="xl:col-span-4"
        />

        <RankedCard
          title="ملامح الطابع"
          description="السمات المزاجية والموضوعية"
          data={data.tones}
          className="xl:col-span-4"
        />

        <CountriesBarCard
          title="الدول"
          description="توزيع الأعمال حسب البلد"
          data={data.countries}
          className="xl:col-span-6"
        />

        <PlanetBarCard
          title="الكواكب"
          description="ثقل الأرشيف داخل كل كوكب"
          data={data.planets}
          className="xl:col-span-6"
        />

        <ScoreDistributionCard
          title="توزيع التقييم"
          description="عدد الأجزاء ضمن كل نطاق تقييمي"
          data={scoreDistribution}
          className="xl:col-span-4"
        />

        <MediaCard data={data.media} className="xl:col-span-4" />

        <RankedCard
          title="تركيب المساهمين"
          description="حجم مساهمة كل طرف في الأرشيف"
          data={data.contributors}
          className="xl:col-span-4"
        />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card dir="rtl" className={cn("flex h-full min-w-0 flex-col overflow-hidden", className)}>
      <CardHeader className="shrink-0 pb-3">
        <CardTitle className="text-base font-semibold sm:text-lg">{title}</CardTitle>

        {description ? (
          <CardDescription className="leading-6">{description}</CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex min-h-60 flex-1 items-center justify-center">
      <Empty className="border-0 py-8">
        <EmptyHeader>
          <EmptyTitle>لا توجد بيانات</EmptyTitle>
          <EmptyDescription>غيّر نطاق العرض أو أكمل بيانات الكتالوج.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

function DonutCard({
  title,
  description,
  data,
  className,
}: {
  title: string;
  description: string;
  data: Pair[];
  className?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartCard title={title} description={description} className={className}>
      {data.length ? (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-4">
          <div className="relative min-h-0 w-full">
            <ChartContainer config={chartConfig} className="size-full min-h-60">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />

                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="key"
                  innerRadius="58%"
                  outerRadius="82%"
                  strokeWidth={3}
                  cx="50%"
                  cy="50%"
                >
                  {data.map((item, index) => (
                    <Cell key={item.key} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                {total.toLocaleString("ar")}
              </span>

              <span className="mt-1 text-xs text-muted-foreground">إجمالي العناوين</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {data.map((item, index) => {
              const percent = total ? Math.round((item.value / total) * 100) : 0;

              return (
                <div
                  key={item.key}
                  className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: palette[index % palette.length],
                    }}
                  />

                  <span className="min-w-0 wrap-break-word text-xs text-muted-foreground">
                    {item.key}
                  </span>

                  <span className="ms-auto shrink-0 font-mono text-xs font-semibold tabular-nums">
                    {item.value.toLocaleString("ar")}
                  </span>

                  <span className="shrink-0 text-[10px] text-muted-foreground">{percent}٪</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

function DistributionCard({
  title,
  description,
  data,
  className,
}: {
  title: string;
  description: string;
  data: Pair[];
  className?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <ChartCard title={title} description={description} className={className}>
      {data.length ? (
        <div className="flex min-h-0 flex-1 flex-col bg-muted p-4 rounded-4xl border">
          {/* Summary */}
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-border/60 pb-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                الإجمالي
              </p>

              <p className="mt-1 font-mono text-3xl font-semibold tracking-tight tabular-nums">
                {total.toLocaleString("ar")}
              </p>
            </div>

            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
              {data.length} فئات
            </span>
          </div>

          {/* Distribution */}
          <div className="flex flex-1 flex-col justify-center gap-4">
            {data.map((item, index) => {
              const percent = total ? Math.round((item.value / total) * 100) : 0;

              const relative = (item.value / max) * 100;

              return (
                <div key={item.key} className="group">
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="size-2.5 shrink-0 rounded-full ring-4 ring-current/10"
                        style={{
                          backgroundColor: palette[index % palette.length],
                          color: palette[index % palette.length],
                        }}
                      />

                      <span className="min-w-0 wrap-break-word text-sm font-medium leading-5">
                        {item.key}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-baseline gap-2">
                      <span className="font-mono text-sm font-semibold tabular-nums">
                        {item.value.toLocaleString("ar")}
                      </span>

                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {percent}٪
                      </span>
                    </div>
                  </div>

                  <div className="relative h-3 overflow-hidden rounded-full bg-muted/70">
                    <div
                      className="absolute inset-y-0 inset-s-0 rounded-full transition-[width] duration-500"
                      style={{
                        width: `${relative}%`,
                        backgroundColor: palette[index % palette.length],
                      }}
                    />

                    <div
                      className="absolute inset-y-0 inset-s-0 rounded-full opacity-30 blur-sm transition-[width] duration-500"
                      style={{
                        width: `${relative}%`,
                        backgroundColor: palette[index % palette.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer context */}
          <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
            <span>نسبة كل فئة من إجمالي البيانات</span>

            <span className="font-mono tabular-nums">100٪</span>
          </div>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

function TimelineCard({
  data,
  className,
}: {
  data: Array<{
    year: number;
    value: number;
  }>;
  className?: string;
}) {
  return (
    <ChartCard
      title="خط الإصدار"
      description="تراكم العناوين حسب سنة الإصدار"
      className={className}
    >
      {data.length ? (
        <div className="flex min-h-72 flex-1">
          <ChartContainer config={chartConfig} className="h-full min-h-72 w-full min-w-0">
            <AreaChart
              data={data}
              margin={{
                top: 12,
                right: 8,
                left: 0,
                bottom: 4,
              }}
            >
              <defs>
                <linearGradient id="release-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.42} />

                  <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.03} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.45} />

              <XAxis
                dataKey="year"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                width={38}
                tick={{
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              />

              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />

              <Area
                dataKey="value"
                type="monotone"
                fill="url(#release-fill)"
                stroke="var(--color-value)"
                strokeWidth={2.5}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

function CoverageCard({
  scored,
  total,
  className,
}: {
  scored: number;
  total: number;
  className?: string;
}) {
  const percent = total ? Math.round((scored / total) * 100) : 0;

  const radial = [
    {
      name: "coverage",
      value: percent,
      fill: "var(--chart-2)",
    },
  ];

  return (
    <ChartCard
      title="تغطية التقييم"
      description={`${scored.toLocaleString("ar")} من ${total.toLocaleString("ar")} جزء مكتمل`}
      className={className}
    >
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3">
        <div className="relative min-h-60 min-w-0">
          <ChartContainer config={chartConfig} className="absolute inset-0 size-full">
            <RadialBarChart
              data={radial}
              startAngle={90}
              endAngle={90 - percent * 3.6}
              innerRadius="58%"
              outerRadius="82%"
              cx="50%"
              cy="50%"
            >
              <RadialBar dataKey="value" background cornerRadius={12} />
            </RadialBarChart>
          </ChartContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
              {percent}٪
            </span>

            <span className="mt-1 text-xs text-muted-foreground">مكتمل</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-center">
            <div className="font-mono text-sm font-semibold tabular-nums">
              {scored.toLocaleString("ar")}
            </div>

            <div className="mt-1 text-[10px] text-muted-foreground">مكتمل</div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-center">
            <div className="font-mono text-sm font-semibold tabular-nums">
              {(total - scored).toLocaleString("ar")}
            </div>

            <div className="mt-1 text-[10px] text-muted-foreground">متبقٍ</div>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

function RankedCard({
  title,
  description,
  data,
  className,
}: {
  title: string;
  description?: string;
  data: Ranked[];
  className?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <ChartCard title={title} description={description} className={className}>
      {data.length ? (
        <div className="flex flex-1 flex-col">
          <ol className="flex flex-col gap-3">
            {data.slice(0, 8).map((item, index) => (
              <li
                key={item.key}
                className="grid grid-cols-[2ch_minmax(0,1fr)_auto] items-start gap-3"
              >
                <span className="pt-0.5 font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0">
                  <div className="wrap-break-word text-sm leading-5">{item.labelAr}</div>

                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{
                        width: `${(item.value / max) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <span className="pt-0.5 font-mono text-xs font-semibold tabular-nums">
                  {item.value.toLocaleString("ar")}
                </span>
              </li>
            ))}
          </ol>

          {data.length > 8 ? (
            <div className="mt-auto pt-4 text-center text-[10px] text-muted-foreground">
              عرض أعلى 8 نتائج
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

function PlanetBarCard({
  title,
  description,
  data,
  className,
}: {
  title: string;
  description?: string;
  data: Ranked[];
  className?: string;
}) {
  const visible = data.slice(0, 10);
  const max = Math.max(...visible.map((item) => item.value), 1);

  return (
    <ChartCard title={title} description={description} className={className}>
      {visible.length ? (
        <div className="flex flex-1 flex-col justify-center  gap-3">
          {visible.map((item, index) => {
            const label = item.labelAr.replace(/^كوكب\s*/u, "");

            return (
              <div
                key={item.key}
                className="grid grid-cols-[2ch_minmax(0,1fr)_auto] items-center gap-3"
              >
                <span className="font-mono text-[10px] text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="min-w-0 wrap-break-word text-sm leading-5">{label}</span>

                    <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
                      {item.value.toLocaleString("ar")}
                    </span>
                  </div>

                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{
                        width: `${(item.value / max) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <span className="text-[10px] text-muted-foreground">
                  {Math.round((item.value / max) * 100)}٪
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

function ScoreDistributionCard({
  title,
  description,
  data,
  className,
}: {
  title: string;
  description?: string;
  data: Ranked[];
  className?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartCard title={title} description={description} className={className}>
      {data.length ? (
        <div className="flex flex-1 flex-col gap-4">
          <div className="h-full min-h-72 w-full">
            <ChartContainer config={chartConfig} className="size-full">
              <BarChart
                data={data}
                margin={{
                  top: 12,
                  right: 8,
                  left: 0,
                  bottom: 4,
                }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.45} />

                <XAxis
                  dataKey="labelAr"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }}
                />

                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }}
                />

                <ChartTooltip content={<ChartTooltipContent />} />

                <Bar dataKey="value" fill="var(--color-value)" radius={[7, 7, 2, 2]} barSize={28} />
              </BarChart>
            </ChartContainer>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span>إجمالي التقييمات</span>

            <span className="font-mono font-semibold tabular-nums text-foreground">
              {total.toLocaleString("ar")}
            </span>
          </div>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

function MediaCard({
  data,
  className,
}: {
  data: {
    assets: number;
    bytes: number;
    reused: number;
    roles: Pair[];
    formats: Pair[];
  };
  className?: string;
}) {
  const roleMax = Math.max(...data.roles.map((item) => item.value), 1);

  return (
    <ChartCard title="مخزن الصور" description="الحجم وإعادة الاستخدام" className={className}>
      <div className="flex flex-1 flex-col gap-5">
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <dt className="text-[10px] text-muted-foreground">الأصول</dt>

            <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">
              {data.assets.toLocaleString("ar")}
            </dd>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <dt className="text-[10px] text-muted-foreground">معاد استخدامها</dt>

            <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">
              {data.reused.toLocaleString("ar")}
            </dd>
          </div>

          <div className="col-span-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <dt className="text-[10px] text-muted-foreground">المساحة</dt>

            <dd className="mt-1 font-mono text-lg font-semibold">
              {new Intl.NumberFormat("ar", {
                style: "unit",
                unit: "megabyte",
                maximumFractionDigits: 1,
              }).format(data.bytes / 1024 / 1024)}
            </dd>
          </div>
        </dl>

        {data.roles.length ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium">توزيع الأدوار</p>

              <span className="text-[10px] text-muted-foreground">{data.roles.length} أنواع</span>
            </div>

            <div className="space-y-2.5">
              {data.roles.slice(0, 4).map((item, index) => (
                <div key={item.key}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="min-w-0 wrap-break-word text-xs text-muted-foreground">
                      {item.key}
                    </span>

                    <span className="shrink-0 font-mono text-[10px] tabular-nums">
                      {item.value.toLocaleString("ar")}
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(item.value / roleMax) * 100}%`,
                        backgroundColor: palette[index % palette.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {data.formats.length ? (
          <div className="mt-auto border-t border-border/60 pt-4">
            <p className="mb-2 text-xs font-medium">الصيغ</p>

            <div className="flex flex-wrap gap-2">
              {data.formats.map((item) => (
                <span
                  key={item.key}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {item.key.replace("image/", "")} · {item.value.toLocaleString("ar")}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </ChartCard>
  );
}

function CountriesBarCard({
  title,
  description,
  data,
  className,
}: {
  title: string;
  description?: string;
  data: Ranked[];
  className?: string;
}) {
  const chartData = data.slice(0, 10);

  return (
    <ChartCard title={title} description={description} className={className}>
      {chartData.length ? (
        <div className="h-full min-h-80 w-full min-w-0">
          <ChartContainer config={chartConfig} className="size-full">
            <BarChart
              data={chartData}
              margin={{
                top: 12,
                right: 8,
                left: 0,
                bottom: 44,
              }}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.45} />

              <XAxis
                dataKey="labelAr"
                tickLine={false}
                axisLine={false}
                interval={0}
                tickMargin={10}
                height={44}
                tick={{
                  fill: "var(--muted-foreground)",
                  fontSize: 10,
                }}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                width={34}
                tick={{
                  fill: "var(--muted-foreground)",
                  fontSize: 10,
                }}
              />

              <ChartTooltip
                cursor={{
                  fill: "var(--muted)",
                  opacity: 0.3,
                }}
                content={
                  <ChartTooltipContent
                    formatter={(value) => [Number(value).toLocaleString("ar"), "عمل"]}
                  />
                }
              />

              <Bar dataKey="value" fill="var(--color-value)" radius={[7, 7, 2, 2]} barSize={28} />
            </BarChart>
          </ChartContainer>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}
