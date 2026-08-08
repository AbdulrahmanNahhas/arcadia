import {
  ArrowRightIcon,
  CheckIcon,
  ClipboardTextIcon,
  DownloadSimpleIcon,
  ImageIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { getWorks } from "@/server/library.functions";
import { statusLabel } from "./components/tracking-form";
import { WorkArtwork } from "./components/work-artwork";
import { kindLabels } from "./filtering";
import type { Work } from "./model";
import { scoreCriteria, scoreCriterionLabels } from "./scoring";

type CompareView = "overview" | "scores" | "details";

const compareViewLabels: Record<CompareView, string> = {
  overview: "نظرة عامة",
  scores: "التقييمات",
  details: "التفاصيل",
};

export function ComparePage({ ids }: { ids: string[] }) {
  const { data: allWorks } = useSuspenseQuery({
    queryKey: ["works"],
    queryFn: () => getWorks(),
  });
  const [view, setView] = useState<CompareView>("overview");
  const [exportState, setExportState] = useState<"idle" | "copied">("idle");

  const works = useMemo(() => {
    const worksById = new Map(allWorks.map((work) => [work.id, work]));
    return ids.flatMap((id) => {
      const work = worksById.get(id);
      return work ? [work] : [];
    });
  }, [allWorks, ids]);

  const handleExport = async (kind: "download" | "copy") => {
    const blob = await createComparisonPng(works);
    if (!blob) return;

    if (kind === "download") {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "arcadia-comparison.png";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      return;
    }

    if ("ClipboardItem" in window && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setExportState("copied");
      window.setTimeout(() => setExportState("idle"), 2_000);
    }
  };

  if (works.length < 2) {
    return <CompareEmpty />;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex max-w-[1560px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              to="/library"
              search={{}}
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0")}
              aria-label="العودة إلى المكتبة"
            >
              <ArrowRightIcon />
            </Link>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <SparkleIcon />
                لوح المقارنة
              </p>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                قارن اختياراتك
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {works.length} أعمال، بالترتيب الذي اخترته في المكتبة.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              value={[view]}
              onValueChange={(value) => {
                const next = value.at(-1) as CompareView | undefined;
                if (next) setView(next);
              }}
              variant="outline"
              spacing={0}
              aria-label="طريقة عرض المقارنة"
            >
              {(Object.keys(compareViewLabels) as CompareView[]).map((mode) => (
                <ToggleGroupItem key={mode} value={mode} size="sm">
                  {compareViewLabels[mode]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button variant="outline" size="sm" onClick={() => void handleExport("copy")}>
              {exportState === "copied" ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <ClipboardTextIcon data-icon="inline-start" />
              )}
              {exportState === "copied" ? "نُسخت الصورة" : "نسخ صورة"}
            </Button>
            <Button size="sm" onClick={() => void handleExport("download")}>
              <DownloadSimpleIcon data-icon="inline-start" />
              تنزيل PNG
            </Button>
          </div>
        </header>

        <section className="overflow-x-auto pb-4" aria-label="الأعمال المختارة">
          <div
            className="grid min-w-max gap-4"
            style={{ gridTemplateColumns: `repeat(${works.length}, minmax(230px, 1fr))` }}
          >
            {works.map((work, index) => (
              <WorkCompareCard key={work.id} work={work} order={index + 1} />
            ))}
          </div>
        </section>

        {view === "overview" && <Overview works={works} />}
        {view === "scores" && <ScoreMatrix works={works} />}
        {view === "details" && <DetailsMatrix works={works} />}
      </main>
    </div>
  );
}

function WorkCompareCard({ work, order }: { work: Work; order: number }) {
  return (
    <Card className="gap-4 py-4 shadow-sm">
      <CardHeader className="gap-3 px-4">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>الاختيار {toArabicNumber(order)}</span>
          <Badge variant="secondary">{kindLabels[work.kind]}</Badge>
        </div>
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
          <WorkArtwork
            work={work}
            showType={false}
            showRating={false}
            compact
            className="w-[72px] shadow-sm"
          />
          <div className="min-w-0 py-1">
            <CardTitle className="line-clamp-2 leading-snug">
              {work.arabicTitle || work.title}
            </CardTitle>
            <CardDescription className="mt-1 truncate">
              {work.creator || "الصنّاع غير مسجلين"}
            </CardDescription>
            <p className="mt-2 text-xs text-muted-foreground">{work.year ?? "سنة غير معروفة"}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        <div className="flex items-end justify-between gap-3 rounded-xl bg-muted/55 px-3 py-2.5">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">التقييم الكلي</p>
            <p className="mt-0.5 text-xs text-muted-foreground">من 10</p>
          </div>
          <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
            {work.calculatedRating?.toFixed(1) ?? "—"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Overview({ works }: { works: Work[] }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <ScoreMatrix works={works} compact />
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>الخلاصة السريعة</CardTitle>
          <CardDescription>أعلى قيمة مسجلة في كل خانة.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {scoreCriteria.map((criterion) => {
            const winner = highestScore(works, criterion);
            return (
              <div
                key={criterion}
                className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 px-3 py-2.5"
              >
                <span className="text-sm text-muted-foreground">
                  {scoreCriterionLabels[criterion].ar}
                </span>
                <span className="min-w-0 truncate text-sm font-medium">
                  {winner
                    ? `${winner.work.arabicTitle || winner.work.title} · ${winner.value.toFixed(1)}`
                    : "لا توجد بيانات"}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

function ScoreMatrix({ works, compact = false }: { works: Work[]; compact?: boolean }) {
  return (
    <Card className="min-w-0 shadow-sm">
      <CardHeader>
        <CardTitle>{compact ? "بصمة التقييم" : "تفاصيل التقييم"}</CardTitle>
        <CardDescription>كل شريط على مقياس موحّد من عشرة.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div
            className="grid items-center gap-x-4 gap-y-4"
            style={{ gridTemplateColumns: `150px repeat(${works.length}, minmax(150px, 1fr))` }}
          >
            <div />
            {works.map((work) => (
              <p key={work.id} className="truncate text-sm font-medium">
                {work.arabicTitle || work.title}
              </p>
            ))}
            {scoreCriteria.map((criterion) => (
              <ScoreRow key={criterion} works={works} criterion={criterion} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreRow({
  works,
  criterion,
}: {
  works: Work[];
  criterion: (typeof scoreCriteria)[number];
}) {
  const highest = highestScore(works, criterion)?.value;
  return (
    <>
      <p className="text-sm text-muted-foreground">{scoreCriterionLabels[criterion].ar}</p>
      {works.map((work) => {
        const value = work.scoreComponents[criterion];
        return (
          <Progress
            key={work.id}
            value={value === undefined ? null : value * 10}
            className={cn("gap-1.5", value === undefined && "opacity-45")}
          >
            <ProgressLabel className="sr-only">{scoreCriterionLabels[criterion].ar}</ProgressLabel>
            <ProgressValue
              className={cn(
                "font-mono text-xs tabular-nums",
                value === highest && "font-semibold text-primary",
              )}
            >
              {() => (value === undefined ? "—" : value.toFixed(1))}
            </ProgressValue>
          </Progress>
        );
      })}
    </>
  );
}

function DetailsMatrix({ works }: { works: Work[] }) {
  const rows: Array<{ label: string; value: (work: Work) => string }> = [
    { label: "النوع", value: (work) => kindLabels[work.kind] },
    { label: "سنة الإصدار", value: (work) => (work.year ? String(work.year) : "—") },
    { label: "صنّاع العمل", value: (work) => work.creator || "—" },
    { label: "حالة المتابعة", value: (work) => statusLabel(work.status) },
    {
      label: "التقدّم",
      value: (work) =>
        work.progressTotal
          ? `${work.progress} / ${work.progressTotal}`
          : work.progress
            ? String(work.progress)
            : "لم يبدأ",
    },
    { label: "الوسوم", value: (work) => work.genres.slice(0, 3).join(" · ") || "—" },
  ];
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>التفاصيل جنباً إلى جنب</CardTitle>
        <CardDescription>الحقائق الأساسية دون مغادرة صفحة المقارنة.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div
            className="grid gap-x-4"
            style={{ gridTemplateColumns: `150px repeat(${works.length}, minmax(150px, 1fr))` }}
          >
            <div />
            {works.map((work) => (
              <p key={work.id} className="border-b pb-3 text-sm font-medium">
                {work.arabicTitle || work.title}
              </p>
            ))}
            {rows.flatMap((row) => [
              <p key={`${row.label}-label`} className="border-b py-3 text-sm text-muted-foreground">
                {row.label}
              </p>,
              ...works.map((work) => (
                <p key={`${row.label}-${work.id}`} className="border-b py-3 text-sm leading-6">
                  {row.value(work)}
                </p>
              )),
            ])}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CompareEmpty() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4">
      <Empty className="border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ImageIcon />
          </EmptyMedia>
          <EmptyTitle>اختر عملين للمقارنة</EmptyTitle>
          <EmptyDescription>
            افتح تفاصيل أي عمل في المكتبة، ثم استخدم زر «اختيار» في أعلى النافذة.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/library" search={{}} className={buttonVariants()}>
            العودة إلى المكتبة
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </EmptyContent>
      </Empty>
    </main>
  );
}

function highestScore(works: Work[], criterion: (typeof scoreCriteria)[number]) {
  const candidates = works.flatMap((work) => {
    const value = work.scoreComponents[criterion];
    return value === undefined ? [] : [{ work, value }];
  });
  return candidates.sort((left, right) => right.value - left.value)[0];
}

function toArabicNumber(value: number) {
  return new Intl.NumberFormat("ar").format(value);
}

async function createComparisonPng(works: Work[]): Promise<Blob | null> {
  const width = Math.max(1000, works.length * 280 + 120);
  const height = 760;
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(2, 2);
  context.fillStyle = "#faf9f6";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#28343c";
  context.font = "600 28px sans-serif";
  context.textAlign = "right";
  context.fillText("مقارنة أركاديا", width - 56, 55);
  context.fillStyle = "#68747c";
  context.font = "16px sans-serif";
  context.fillText(`${works.length} أعمال · التقييمات الشخصية`, width - 56, 82);

  const columnWidth = (width - 112) / works.length;
  await Promise.all(
    works.map(async (work, index) => {
      const x = 56 + index * columnWidth;
      const image = await loadCanvasImage(work.imagePath);
      if (image) context.drawImage(image, x, 116, columnWidth - 24, 258);
      else {
        context.fillStyle = "#dbe4e6";
        context.fillRect(x, 116, columnWidth - 24, 258);
      }
      context.fillStyle = "#28343c";
      context.font = "600 18px sans-serif";
      context.textAlign = "right";
      context.fillText(
        truncateForCanvas(work.arabicTitle || work.title, 22),
        x + columnWidth - 24,
        408,
      );
      context.fillStyle = "#68747c";
      context.font = "14px sans-serif";
      context.fillText(`${kindLabels[work.kind]} · ${work.year ?? "—"}`, x + columnWidth - 24, 434);
      context.fillStyle = "#2563b8";
      context.font = "600 34px sans-serif";
      context.fillText(work.calculatedRating?.toFixed(1) ?? "—", x + columnWidth - 24, 488);
      scoreCriteria.forEach((criterion, scoreIndex) => {
        const y = 535 + scoreIndex * 30;
        const value = work.scoreComponents[criterion];
        context.fillStyle = "#d9dfe1";
        context.fillRect(x, y, columnWidth - 24, 8);
        if (value !== undefined) {
          context.fillStyle = "#3584e4";
          context.fillRect(x, y, ((columnWidth - 24) * value) / 10, 8);
        }
      });
    }),
  );
  context.fillStyle = "#68747c";
  context.font = "13px sans-serif";
  context.textAlign = "right";
  scoreCriteria.forEach((criterion, index) => {
    context.fillText(scoreCriterionLabels[criterion].ar, width - 56, 542 + index * 30);
  });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function loadCanvasImage(path: string | null) {
  if (!path) return Promise.resolve<HTMLImageElement | null>(null);
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = path;
  });
}

function truncateForCanvas(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
