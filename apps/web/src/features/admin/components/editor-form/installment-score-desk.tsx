import { CheckCircleIcon, FloppyDiskIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EditableWorkStructure, WorkKind, WorkStructure } from "@/features/library/model";
import {
  calculatedRating,
  type ScoreCriterion,
  scoreCriteria,
  scoreLabel,
  scoreWeights,
} from "@/features/library/scoring";
import { saveWorkStructure } from "@/server/library.functions";

type InstallmentScore = {
  story: number | null;
  characters: number | null;
  depth: number | null;
  worldBuilding: number | null;
  originality: number | null;
  craft: number | null;
};

const emptyScore = (): InstallmentScore => ({
  story: null,
  characters: null,
  depth: null,
  worldBuilding: null,
  originality: null,
  craft: null,
});

function editableStructure(structure: WorkStructure): EditableWorkStructure {
  return {
    workId: structure.workId,
    seasons: structure.seasons.map((installment) => ({
      id: installment.id,
      title: installment.title,
      installmentKind: installment.installmentKind ?? "season",
      summary: installment.summary ?? "",
      releaseStatus: installment.releaseStatus ?? "unknown",
      posterPath: installment.posterPath ?? null,
      score: { ...emptyScore(), ...installment.score },
      seasonNumber: installment.seasonNumber,
      position: installment.position,
      runtimeMinutes: installment.runtimeMinutes,
      unitCount: installment.unitCount,
      releaseAt: installment.releaseAt,
      tmdbId: installment.tmdbId ?? null,
      imdbId: installment.imdbId ?? null,
      tvdbId: installment.tvdbId ?? null,
      anilistId: installment.anilistId ?? null,
      malId: installment.malId ?? null,
      units: installment.units.map((unit) => ({
        id: unit.id,
        unitType: "episode",
        title: unit.title,
        unitNumber: unit.unitNumber,
        position: unit.position,
        runtimeMinutes: unit.runtimeMinutes,
        releaseAt: unit.releaseAt,
      })),
    })),
    ungroupedUnits: structure.ungroupedUnits.map((unit) => ({
      id: unit.id,
      unitType: "episode",
      title: unit.title,
      unitNumber: unit.unitNumber,
      position: unit.position,
      runtimeMinutes: unit.runtimeMinutes,
      releaseAt: unit.releaseAt,
    })),
  };
}

function completedCriteria(score: InstallmentScore) {
  return scoreCriteria.filter((criterion) => score[criterion] !== null).length;
}

function installmentRating(score: InstallmentScore) {
  return calculatedRating(
    Object.fromEntries(
      scoreCriteria.flatMap((criterion) =>
        score[criterion] === null ? [] : [[criterion, score[criterion]]],
      ),
    ),
  );
}

function scoreStatus(score: InstallmentScore) {
  const completed = completedCriteria(score);
  if (completed === scoreCriteria.length) return "مكتمل";
  if (completed === 0) return "غير مُقيّم";
  return `${completed}/${scoreCriteria.length} مكونات`;
}

function installmentLabel(kind: "season" | "movie" | "special", position: number) {
  if (kind === "season") return `الموسم ${position}`;
  if (kind === "movie") return `فيلم ${position}`;
  return `عمل خاص ${position}`;
}

export function InstallmentScoreDesk({
  structure,
  workKind,
}: {
  structure: WorkStructure | undefined;
  workKind: WorkKind;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<EditableWorkStructure | null>(null);
  const [activeInstallmentId, setActiveInstallmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!structure) return;
    const nextDraft = editableStructure(structure);
    setDraft(nextDraft);
    setActiveInstallmentId((active) =>
      active && nextDraft.seasons.some((installment) => installment.id === active)
        ? active
        : (nextDraft.seasons[0]?.id ?? null),
    );
  }, [structure]);

  const mutation = useMutation({
    mutationFn: saveWorkStructure,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-structure", structure?.workId] });
    },
  });

  const scores = useMemo(
    () =>
      (draft?.seasons ?? []).map((installment) => ({
        id: installment.id ?? `${installment.installmentKind}-${installment.position}`,
        score: { ...emptyScore(), ...installment.score },
      })),
    [draft],
  );
  const completeInstallments = scores.filter(
    ({ score }) => installmentRating(score) !== null,
  ).length;
  const isDirty =
    structure !== undefined &&
    draft !== null &&
    JSON.stringify(draft) !== JSON.stringify(editableStructure(structure));

  const updateScore = (installmentId: string, criterion: ScoreCriterion, value: number | null) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        seasons: current.seasons.map((installment) =>
          installment.id === installmentId
            ? {
                ...installment,
                score: { ...emptyScore(), ...installment.score, [criterion]: value },
              }
            : installment,
        ),
      };
    });
  };

  if (!structure || !draft) {
    return <ScoreDeskLoading />;
  }

  if (!draft.seasons.length) {
    return (
      <Empty className="min-h-56">
        <EmptyMedia variant="icon">
          <WarningCircleIcon />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>لا توجد أجزاء لتقييمها</EmptyTitle>
          <EmptyDescription>
            أضف موسماً أو فيلماً من محرر البنية أولاً، ثم قيّم كل جزء على حدة.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/20 [--card-spacing:--spacing(5)]">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="font-heading text-lg">مكتب التقييم</CardTitle>
            <CardDescription>
              يُحفظ كل تقييم على الجزء أو الموسم الخاص به. النتيجة تُحسب تلقائياً عند اكتمال المعايير
              الستة.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2" dir="ltr">
            <strong className="font-mono text-2xl tabular-nums">{completeInstallments}</strong>
            <span className="text-xs text-muted-foreground">/ {draft.seasons.length} مكتمل</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeInstallmentId ?? undefined} onValueChange={setActiveInstallmentId}>
          <TabsList
            className="mb-5 w-full max-w-full justify-start overflow-x-auto"
            aria-label="اختيار الجزء للتقييم"
          >
            {draft.seasons.map((installment) => {
              const id = installment.id ?? `${installment.installmentKind}-${installment.position}`;
              const score = { ...emptyScore(), ...installment.score };
              return (
                <TabsTrigger key={id} value={id} className="shrink-0">
                  <span className="truncate">
                    {installmentLabel(installment.installmentKind, installment.position)}
                  </span>
                  <Badge
                    variant={installmentRating(score) === null ? "outline" : "secondary"}
                    className="font-mono text-[10px]"
                  >
                    {installmentRating(score)?.toFixed(1) ?? "—"}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {draft.seasons.map((installment) => {
            const id = installment.id ?? `${installment.installmentKind}-${installment.position}`;
            const score = { ...emptyScore(), ...installment.score };
            return (
              <TabsContent key={id} value={id}>
                <InstallmentScorePanel
                  installment={installment}
                  score={score}
                  workKind={workKind}
                  onScoreChange={(criterion, value) => updateScore(id, criterion, value)}
                />
              </TabsContent>
            );
          })}
        </Tabs>
        {mutation.error && (
          <Alert variant="destructive" className="mt-5">
            <AlertDescription>{mutation.error.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {isDirty ? "لديك تعديلات غير محفوظة." : "كل التقييمات المحفوظة محدثة."}
        </span>
        <Button
          type="button"
          disabled={!isDirty || mutation.isPending}
          onClick={() => draft && mutation.mutate({ data: draft })}
        >
          <FloppyDiskIcon data-icon="inline-start" />
          {mutation.isPending ? "جارٍ حفظ التقييمات…" : "حفظ التقييمات"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function InstallmentScorePanel({
  installment,
  score,
  workKind,
  onScoreChange,
}: {
  installment: EditableWorkStructure["seasons"][number];
  score: InstallmentScore;
  workKind: WorkKind;
  onScoreChange: (criterion: ScoreCriterion, value: number | null) => void;
}) {
  const rating = installmentRating(score);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{installment.title}</p>
          <p className="text-xs text-muted-foreground">
            {installmentLabel(installment.installmentKind, installment.position)} ·{" "}
            {scoreStatus(score)}
          </p>
        </div>
        <div className="flex items-end gap-2" dir="ltr">
          <strong className="font-mono text-4xl font-semibold tabular-nums">
            {rating?.toFixed(1) ?? "—"}
          </strong>
          <span className="mb-1 text-xs text-muted-foreground">/ 10</span>
        </div>
      </div>
      <FieldGroup className="gap-5">
        {scoreCriteria.map((criterion) => {
          const label = scoreLabel(criterion, workKind).ar;
          const value = score[criterion];
          return (
            <Field key={criterion} className="gap-2">
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor={`${installment.id}-${criterion}`}>{label}</FieldLabel>
                <span className="font-mono text-xs text-muted-foreground">
                  {Math.round(scoreWeights[criterion] * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-[1fr_5rem] items-center gap-4" dir="ltr">
                <Slider
                  min={0}
                  max={10}
                  step={0.5}
                  value={[value ?? 0]}
                  aria-label={label}
                  onValueChange={(next) =>
                    onScoreChange(criterion, Array.isArray(next) ? next[0] : next)
                  }
                />
                <Input
                  id={`${installment.id}-${criterion}`}
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={value ?? ""}
                  placeholder="—"
                  aria-label={`تقييم ${label}`}
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (!raw) return onScoreChange(criterion, null);
                    const next = Number(raw);
                    if (Number.isFinite(next) && next >= 0 && next <= 10)
                      onScoreChange(criterion, next);
                  }}
                />
              </div>
            </Field>
          );
        })}
      </FieldGroup>
      {rating !== null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircleIcon />
          اكتملت المعادلة الموزونة لهذا الجزء.
        </div>
      )}
    </div>
  );
}

function ScoreDeskLoading() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>مكتب التقييم</CardTitle>
        <CardDescription>جارٍ تحميل الأجزاء والتقييمات المحفوظة…</CardDescription>
      </CardHeader>
    </Card>
  );
}
