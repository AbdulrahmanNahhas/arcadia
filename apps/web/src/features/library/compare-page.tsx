import {
  ArrowRightIcon,
  CheckIcon,
  ClipboardTextIcon,
  DownloadSimpleIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
  ScalesIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { cn } from "@/lib/utils";
import { getWorkStructures, getWorks } from "@/server/library.functions";
import { WorkArtwork } from "./components/work-artwork";
import { kindLabels } from "./filtering";
import type { Work, WorkStructure } from "./model";
import { scoreCriteria, scoreCriterionLabels } from "./scoring";

const MAX_WORKS = 10;

type CompareView = "overview" | "scores" | "installments" | "details";

const compareViewLabels: Record<CompareView, string> = {
  overview: "نظرة عامة",
  scores: "التقييمات",
  installments: "الأجزاء",
  details: "التفاصيل",
};

export function ComparePage({
  ids,
  onIdsChange,
}: {
  ids: string[];
  onIdsChange: (ids: string[]) => void;
}) {
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

  const structuresQuery = useQuery({
    queryKey: ["compare-structures", works.map((work) => work.id).join(",")],
    queryFn: () => getWorkStructures({ data: { workIds: works.map((work) => work.id) } }),
    enabled: works.length >= 2,
  });

  const addWork = (id: string) => {
    if (ids.includes(id) || ids.length >= MAX_WORKS) return;
    onIdsChange([...ids, id]);
  };
  const removeWork = (id: string) => onIdsChange(ids.filter((existing) => existing !== id));

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

  const canCompare = works.length >= 2;

  return (
    <PlatformShell>
      <section className="archive-grid border-b border-white/8">
        <div className="mx-auto max-w-400 px-5 pb-10 pt-28 sm:px-8 sm:pt-36">
          <Link
            to="/browse"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRightIcon /> المكتبة
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.18em] text-primary">
                <ScalesIcon /> لوح المقارنة
              </p>
              <h1 className="mt-3 font-heading text-4xl font-semibold sm:text-5xl">
                قارن اختياراتك
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                أضف حتى {MAX_WORKS} أعمال من المكتبة، وقارن تقييماتها وأجزاءها وتفاصيلها جنباً إلى
                جنب.
              </p>
            </div>
            <Badge variant="outline" className="h-9 gap-1.5 px-3 text-sm">
              {works.length} / {MAX_WORKS} أعمال
            </Badge>
          </div>
        </div>
      </section>

      <main className="mx-auto flex max-w-400 flex-col gap-6 px-5 py-8 sm:px-8">
        <section
          aria-label="الأعمال المختارة"
          className="scroll-fade-x -mx-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8"
        >
          <div className="flex min-w-max gap-4">
            {works.map((work, index) => (
              <WorkCompareCard
                key={work.id}
                work={work}
                order={index + 1}
                onRemove={() => removeWork(work.id)}
              />
            ))}
            {works.length < MAX_WORKS ? (
              <WorkPickerDialog
                allWorks={allWorks}
                excludeIds={new Set(ids)}
                remaining={MAX_WORKS - works.length}
                onAdd={addWork}
              />
            ) : null}
          </div>
        </section>

        {canCompare ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-5">
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
              <div className="flex flex-wrap items-center gap-2">
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

            {view === "overview" && <Overview works={works} />}
            {view === "scores" && <ScoreMatrix works={works} />}
            {view === "installments" && (
              <InstallmentsMatrix works={works} structures={structuresQuery.data} />
            )}
            {view === "details" && <DetailsMatrix works={works} />}
          </>
        ) : (
          <Empty className="min-h-64 border border-dashed border-white/10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScalesIcon />
              </EmptyMedia>
              <EmptyTitle>
                {works.length === 0 ? "أضف عملين على الأقل" : "أضف عملاً واحداً آخر"}
              </EmptyTitle>
              <EmptyDescription>
                استخدم بطاقة «أضف عملاً» أعلاه للبحث في المكتبة، ثم شاهد المقارنة تُبنى تلقائياً.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </main>
    </PlatformShell>
  );
}

function WorkPickerDialog({
  allWorks,
  excludeIds,
  remaining,
  onAdd,
}: {
  allWorks: Work[];
  excludeIds: Set<string>;
  remaining: number;
  onAdd: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return allWorks
      .filter((work) => !excludeIds.has(work.id))
      .filter((work) =>
        needle
          ? [work.title, work.arabicTitle ?? ""].join(" ").toLocaleLowerCase().includes(needle)
          : true,
      )
      .slice(0, 40);
  }, [allWorks, excludeIds, query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex h-full min-h-64 w-44 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 text-muted-foreground outline-none transition hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
          />
        }
      >
        <PlusCircleIcon className="size-8" weight="duotone" />
        <span className="text-sm font-medium">أضف عملاً</span>
        <span className="text-xs">متبقٍ {remaining}</span>
      </DialogTrigger>
      <DialogContent className="max-h-[85svh] max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="p-5 pb-0 text-start">
          <DialogTitle>أضف عملاً للمقارنة</DialogTitle>
          <DialogDescription>حتى {MAX_WORKS} أعمال في اللوح نفسه.</DialogDescription>
        </DialogHeader>
        <div className="p-5">
          <InputGroup>
            <InputGroupAddon>
              <MagnifyingGlassIcon />
            </InputGroupAddon>
            <InputGroupInput
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث عن عمل بالاسم…"
            />
          </InputGroup>
        </div>
        <div className="flex max-h-96 flex-col gap-1 overflow-y-auto px-5 pb-5">
          {results.map((work) => (
            <button
              key={work.id}
              type="button"
              onClick={() => {
                onAdd(work.id);
                setOpen(false);
                setQuery("");
              }}
              className="flex items-center gap-3 rounded-xl p-2 text-start outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <WorkArtwork
                work={work}
                compact
                showType={false}
                showRating={false}
                className="w-10"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {work.arabicTitle || work.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {kindLabels[work.kind]} · {work.year ?? "—"}
                </span>
              </span>
              <PlusCircleIcon className="shrink-0 text-muted-foreground" />
            </button>
          ))}
          {!results.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا نتائج مطابقة.</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkCompareCard({
  work,
  order,
  onRemove,
}: {
  work: Work;
  order: number;
  onRemove: () => void;
}) {
  return (
    <Card className="relative w-44 shrink-0 gap-4 py-4 shadow-sm sm:w-56">
      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute end-2 top-2 z-10 rounded-full bg-background/80 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
        aria-label={`إزالة ${work.arabicTitle || work.title} من المقارنة`}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
      <CardHeader className="gap-3 px-4">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>الاختيار {toArabicNumber(order)}</span>
          <Badge variant="secondary">{kindLabels[work.kind]}</Badge>
        </div>
        <WorkArtwork work={work} showType={false} showRating={false} compact className="w-full" />
        <div className="min-w-0">
          <CardTitle className="line-clamp-2 leading-snug">
            {work.arabicTitle || work.title}
          </CardTitle>
          <CardDescription className="mt-1 truncate">
            {work.creator || "الصنّاع غير مسجلين"}
          </CardDescription>
          <p className="mt-2 text-xs text-muted-foreground">{work.year ?? "سنة غير معروفة"}</p>
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
        <div className="min-w-170">
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

function InstallmentsMatrix({
  works,
  structures,
}: {
  works: Work[];
  structures: WorkStructure[] | undefined;
}) {
  const byWorkId = new Map((structures ?? []).map((structure) => [structure.workId, structure]));
  const rows: Array<{ label: string; value: (work: Work) => string }> = [
    {
      label: "عدد الأجزاء",
      value: (work) => String(byWorkId.get(work.id)?.seasons.length ?? 0),
    },
    {
      label: "إجمالي الحلقات",
      value: (work) => String(byWorkId.get(work.id)?.totalUnits ?? 0),
    },
    {
      label: "آخر جزء مسجّل",
      value: (work) => byWorkId.get(work.id)?.seasons.at(-1)?.title || "—",
    },
    {
      label: "تقييم آخر جزء",
      value: (work) => {
        const rating = byWorkId.get(work.id)?.seasons.at(-1)?.rating;
        return rating != null ? rating.toFixed(1) : "—";
      },
    },
  ];
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>بنية الأجزاء</CardTitle>
        <CardDescription>عدد الأجزاء والحلقات، وآخر جزء مسجّل لكل عمل.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {structures ? (
          <div className="min-w-170">
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
              {rows.flatMap((row) => {
                const cells = [
                  <p
                    key={`${row.label}-label`}
                    className="border-b py-3 text-sm text-muted-foreground"
                  >
                    {row.label}
                  </p>,
                ];
                for (const work of works)
                  cells.push(
                    <p key={`${row.label}-${work.id}`} className="border-b py-3 text-sm leading-6">
                      {row.value(work)}
                    </p>,
                  );
                return cells;
              })}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">جارٍ تحميل بنية الأجزاء…</p>
        )}
      </CardContent>
    </Card>
  );
}

function DetailsMatrix({ works }: { works: Work[] }) {
  const rows: Array<{ label: string; value: (work: Work) => string }> = [
    { label: "النوع", value: (work) => kindLabels[work.kind] },
    { label: "سنة الإصدار", value: (work) => (work.year ? String(work.year) : "—") },
    { label: "صنّاع العمل", value: (work) => work.creator || "—" },
    { label: "حالة الإصدار", value: (work) => work.releaseStatus },
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
        <div className="min-w-170">
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
            {rows.flatMap((row) => {
              const cells = [
                <p
                  key={`${row.label}-label`}
                  className="border-b py-3 text-sm text-muted-foreground"
                >
                  {row.label}
                </p>,
              ];
              for (const work of works)
                cells.push(
                  <p key={`${row.label}-${work.id}`} className="border-b py-3 text-sm leading-6">
                    {row.value(work)}
                  </p>,
                );
              return cells;
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function highestScore(works: Work[], criterion: (typeof scoreCriteria)[number]) {
  const candidates = works.flatMap((work) => {
    const value = work.scoreComponents[criterion];
    return value === undefined ? [] : [{ work, value }];
  });
  return candidates.toSorted((left, right) => right.value - left.value)[0];
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
  context.fillText("مقارنة نحّاسينما", width - 56, 55);
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
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => resolve(null));
    image.src = path;
  });
}

function truncateForCanvas(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
