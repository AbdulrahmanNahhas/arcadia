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
import { getAdminStatistics } from "@/server/library.functions";
import { AdminPageHeader } from "../components/admin-page-header";

const chartConfig = {
  value: { label: "العدد", color: "var(--chart-1)" },
  secondary: { label: "ثانوي", color: "var(--chart-2)" },
} satisfies ChartConfig;
const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function StatisticsPage() {
  const [visibility, setVisibility] = useState<"all" | "public" | "private">("all");
  const { data } = useSuspenseQuery({
    queryKey: ["admin-statistics", visibility],
    queryFn: () => getAdminStatistics(visibility),
  });
  return (
    <div className="flex min-w-0 flex-col gap-6 pb-12">
      <AdminPageHeader
        title="إحصاءات الكتالوج"
        description="قراءة تحريرية لبنية الأرشيف وتغطيته، لا أرقام زينة منفصلة عن العمل اليومي."
        actions={
          <ToggleGroup
            value={[visibility]}
            onValueChange={(value) => setVisibility((value[0] as typeof visibility) ?? "all")}
            variant="outline"
            aria-label="نطاق الإحصاءات"
          >
            <ToggleGroupItem value="all">الكل</ToggleGroupItem>
            <ToggleGroupItem value="public">العام</ToggleGroupItem>
            <ToggleGroupItem value="private">الخاص</ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <div className="grid gap-5 px-5 sm:px-6 xl:grid-cols-12">
        <DonutCard
          title="الرؤية"
          description="العناوين العامة والخاصة"
          data={data.visibility}
          className="xl:col-span-4"
        />
        <HorizontalBarCard
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
        <HorizontalBarCard
          title="حالة الأجزاء"
          description="الحالة الواقعية لكل جزء"
          data={data.installmentStatus}
          className="xl:col-span-4"
        />
        <RankedCard title="التصنيفات" data={data.genres} className="xl:col-span-4" />
        <RankedCard title="الوسوم الأكثر حضوراً" data={data.tags} className="xl:col-span-4" />
        <RankedCard title="ملامح الطابع" data={data.tones} className="xl:col-span-4" />
        <VerticalBarCard title="الدول" data={data.countries} className="xl:col-span-6" />
        <VerticalBarCard title="الكواكب" data={data.planets} className="xl:col-span-6" />
        <VerticalBarCard
          title="توزيع التقييم"
          data={data.scoreDistribution.map((item) => ({
            key: item.bucket,
            labelAr: item.bucket,
            value: item.value,
          }))}
          className="xl:col-span-5"
        />
        <MediaCard data={data.media} className="xl:col-span-3" />
        <RankedCard title="تركيب المساهمين" data={data.contributors} className="xl:col-span-4" />
      </div>
    </div>
  );
}

type Pair = { key: string; value: number };
type Ranked = Pair & { labelAr: string };
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
    <Card className={`min-w-0 overflow-hidden ${className ?? ""}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden">{children}</CardContent>
    </Card>
  );
}
function EmptyChart() {
  return (
    <Empty className="min-h-48">
      <EmptyHeader>
        <EmptyTitle>لا توجد بيانات</EmptyTitle>
        <EmptyDescription>غيّر نطاق العرض أو أكمل بيانات الكتالوج.</EmptyDescription>
      </EmptyHeader>
    </Empty>
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
  return (
    <ChartCard title={title} description={description} className={className}>
      {data.length ? (
        <ChartContainer config={chartConfig} className="mx-auto max-h-56">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius={52}
              outerRadius={78}
              strokeWidth={3}
            >
              {data.map((item, index) => (
                <Cell key={item.key} fill={palette[index % palette.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}
function HorizontalBarCard({
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
  return (
    <ChartCard title={title} description={description} className={className}>
      {data.length ? (
        <ChartContainer config={chartConfig} className="max-h-56">
          <BarChart data={data} layout="vertical" margin={{ right: 8 }}>
            <CartesianGrid horizontal={false} />
            <YAxis dataKey="key" type="category" tickLine={false} axisLine={false} width={70} />
            <XAxis type="number" hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={5} />
          </BarChart>
        </ChartContainer>
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
  data: Array<{ year: number; value: number }>;
  className?: string;
}) {
  return (
    <ChartCard
      title="خط الإصدار"
      description="تراكم العناوين حسب سنة الإصدار"
      className={className}
    >
      {data.length ? (
        <ChartContainer config={chartConfig} className="max-h-64">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="release-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.45} />
                <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="year" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="value"
              type="monotone"
              fill="url(#release-fill)"
              stroke="var(--color-value)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
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
  const radial = [{ name: "coverage", value: percent, fill: "var(--chart-2)" }];
  return (
    <ChartCard
      title="تغطية التقييم"
      description={`${scored} من ${total} جزء مكتمل`}
      className={className}
    >
      <ChartContainer config={chartConfig} className="mx-auto max-h-56">
        <RadialBarChart
          data={radial}
          startAngle={90}
          endAngle={90 - percent * 3.6}
          innerRadius={62}
          outerRadius={92}
        >
          <RadialBar dataKey="value" background cornerRadius={8} />
        </RadialBarChart>
      </ChartContainer>
      <p className="-mt-28 mb-20 text-center font-mono text-3xl font-semibold">{percent}%</p>
    </ChartCard>
  );
}
function RankedCard({
  title,
  data,
  className,
}: {
  title: string;
  data: Ranked[];
  className?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <ChartCard title={title} className={className}>
      {data.length ? (
        <ol className="flex flex-col gap-3">
          {data.slice(0, 8).map((item, index) => (
            <li key={item.key} className="grid grid-cols-[2ch_1fr_auto] items-center gap-3 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate">{item.labelAr}</span>
                <span className="h-1.5 rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(item.value / max) * 100}%` }}
                  />
                </span>
              </div>
              <span className="font-mono text-xs">{item.value}</span>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}
function VerticalBarCard({
  title,
  data,
  className,
}: {
  title: string;
  data: Ranked[];
  className?: string;
}) {
  return (
    <ChartCard title={title} className={className}>
      {data.length ? (
        <ChartContainer config={chartConfig} className="max-h-64">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="labelAr" tickLine={false} axisLine={false} interval={0} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ChartContainer>
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
  data: { assets: number; bytes: number; reused: number; roles: Pair[]; formats: Pair[] };
  className?: string;
}) {
  return (
    <ChartCard title="مخزن الصور" description="الحجم وإعادة الاستخدام" className={className}>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-muted-foreground">الأصول</dt>
          <dd className="font-mono text-3xl">{data.assets}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">معاد استخدامها</dt>
          <dd className="font-mono text-3xl">{data.reused}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">المساحة</dt>
          <dd className="font-mono text-xl">
            {new Intl.NumberFormat("ar", {
              style: "unit",
              unit: "megabyte",
              maximumFractionDigits: 1,
            }).format(data.bytes / 1024 / 1024)}
          </dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {data.formats.map((item) => (
          <span key={item.key}>
            {item.key.replace("image/", "")} · {item.value}
          </span>
        ))}
      </div>
    </ChartCard>
  );
}
