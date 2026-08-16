import type { AwardRecognition } from "@arcadia/contracts";
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  ClockIcon,
  FilmStripIcon,
  InfoIcon,
  PlayIcon,
  StarIcon,
  TelevisionIcon,
  TrophyIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentAccount } from "@/features/accounts/api";
import { recordHistory } from "@/features/archive/api";
import { WorkFamilyActions } from "@/features/archive/work-family-actions";
import type { Entity, Work, WorkStructure } from "@/features/library/model";
import { scoreCriteria, scoreLabel, scoreWeights } from "@/features/library/scoring";
import { useArabicTranslations } from "@/features/library/translations";
import type { Recommendation, RiskAssessment } from "@/features/platform/model";
import { TitleSocialSection } from "@/features/social/title-social-section";
import { cn } from "@/lib/utils";
import { getEntities } from "@/server/library.functions";
import { getPlatformWorkDetail } from "@/server/platform.functions";
import { EntityDialog } from "./components/entity-dialog";
import { PlatformShell } from "./components/platform-shell";
import { WorkCard } from "./components/work-card";

type PlanetInfo = { slug: string; icon: string; nameAr: string; primaryColor: string } | null;

export function WorkDetailPage({
  workId,
  initialInstallmentId,
}: {
  workId: string;
  initialInstallmentId?: string;
}) {
  const { data: accountData } = useCurrentAccount();
  const isAdmin = accountData?.account.role === "owner" || accountData?.account.role === "editor";
  const { data } = useSuspenseQuery({
    queryKey: ["platform-work", workId, isAdmin],
    queryFn: () => getPlatformWorkDetail({ data: { workId, includePrivate: isAdmin } }),
  });
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  const { taxonomyLabel } = useArabicTranslations();
  const [selectedInstallmentId, setSelectedInstallmentId] = useState(initialInstallmentId ?? "");
  useEffect(() => {
    recordHistory(workId).catch(() => undefined);
  }, [workId]);
  if (!data)
    return (
      <PlatformShell>
        <div className="mx-auto max-w-3xl px-5 py-32">هذا العمل غير متاح في المنصة الرئيسية.</div>
      </PlatformShell>
    );
  const { work, structure, planet, risks, recommendations } = data;
  const people = work.contributors.flatMap((credit) => {
    const entity = entities.find((item) => item.id === credit.entityId);
    return entity?.entityType === "person" ? [{ entity, credit }] : [];
  });
  const studios = work.contributors.flatMap((credit) => {
    const entity = entities.find((item) => item.id === credit.entityId);
    return entity?.entityType === "organization" ? [{ entity, credit }] : [];
  });
  const audienceLabel = work.audience ? taxonomyLabel("audience", work.audience) : null;
  const hasMedia = structure.seasons.length > 0;
  const hasCast = people.length > 0 || studios.length > 0;

  const tabs = [
    { id: "overview", label: "نظرة عامة" },
    hasMedia && { id: "episodes", label: "الأجزاء والحلقات" },
    hasCast && { id: "cast", label: "صنّاع العمل" },
    { id: "scores", label: "التقييم" },
    { id: "reviews", label: "مراجعات العائلة" },
    { id: "details", label: "التفاصيل" },
  ].filter(Boolean) as Array<{ id: string; label: string }>;

  return (
    <PlatformShell immersive>
      <WorkHero work={work} planet={planet?.planet ?? null} audienceLabel={audienceLabel} />

      <Tabs
        defaultValue={initialInstallmentId ? "episodes" : "overview"}
        className="mx-auto max-w-400 gap-0 px-5 sm:px-8"
      >
        <div className="sticky top-14 z-30 -mx-5 overflow-x-auto border-y border-border/40 bg-background/80 px-5 backdrop-blur-xl sm:-mx-8 sm:px-8">
          <TabsList variant="line" className="h-10! min-w-max justify-start gap-3 p-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="h-8 hover:bg-accent! flex-none rounded-full px-3 text-sm"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div id="family-progress" className="border-b border-border/40 py-6">
          <TitleSocialSection titleId={work.id} mode="quick" />
          <div className="mt-3">
            <WorkFamilyActions titleId={work.id} title={work.arabicTitle || work.title} />
          </div>
        </div>

        <div className="grid gap-10 md:py-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14">
          <main className="min-w-0">
            <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
              <OverviewSection
                work={work}
                structure={structure}
                risks={risks}
                taxonomyLabel={taxonomyLabel}
              />
              <div className="mt-10 border-t pt-10">
                <TitleSocialSection titleId={work.id} mode="discussion" />
              </div>
            </TabsContent>

            {hasMedia && (
              <TabsContent value="episodes" className="mt-0 focus-visible:outline-none">
                <EpisodesSection
                  structure={structure}
                  work={work}
                  selectedId={selectedInstallmentId}
                  onSelectedIdChange={setSelectedInstallmentId}
                />
              </TabsContent>
            )}

            {hasCast && (
              <TabsContent value="cast" className="mt-0 focus-visible:outline-none">
                <CastSection people={people} studios={studios} />
              </TabsContent>
            )}

            <TabsContent value="scores" className="mt-0 focus-visible:outline-none">
              <ScoreSection work={work} />
            </TabsContent>

            <TabsContent value="reviews" className="mt-0 focus-visible:outline-none">
              <TitleSocialSection titleId={work.id} mode="reviews" />
            </TabsContent>

            <TabsContent value="details" className="mt-0 focus-visible:outline-none">
              <WorkDetails work={work} structure={structure} taxonomyLabel={taxonomyLabel} />
            </TabsContent>
          </main>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-32 lg:max-h-[calc(100svh-9rem)] lg:self-start lg:overflow-y-auto lg:pe-2 p-1">
            <MetadataPanel
              work={work}
              planetName={planet?.planet.nameAr ?? "غير معيّن"}
              audienceLabel={audienceLabel ?? "غير محدد"}
            />
            <ParentGuideCard risks={risks} />
          </aside>
        </div>
      </Tabs>

      {recommendations.length > 0 && (
        <div className="mx-auto max-w-400 px-5 pb-28 sm:px-8">
          <SimilarSection recommendations={recommendations} />
        </div>
      )}
    </PlatformShell>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Dot() {
  return (
    <span aria-hidden className="text-foreground/25">
      •
    </span>
  );
}

function WorkHero({
  work,
  planet,
  audienceLabel,
}: {
  work: Work;
  planet: PlanetInfo;
  audienceLabel: string | null;
}) {
  const glow = planet?.primaryColor ?? "#7c8cf8";
  const heroAward =
    work.awards.find((recognition) => recognition.isFeatured) ??
    work.awards.find((recognition) => recognition.result === "winner") ??
    work.awards[0];

  return (
    <section className="relative isolate min-h-[80svh] overflow-hidden border-b border-border/40">
      {work.bannerPath || work.imagePath ? (
        <img
          src={work.bannerPath || work.imagePath || undefined}
          alt=""
          className="absolute inset-0 -z-20 size-full object-cover"
        />
      ) : null}
      {/* signature: an ambient glow keyed to the work's planet color, echoed
          in the eyebrow chip and the accent bars used across the page */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: `radial-gradient(60% 55% at 78% 15%, ${glow}33, transparent 70%)` }}
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-tl from-background via-25% via-background to-background/0" />
      {/*<div className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/10 to-bacgronund/20" />*/}

      <div className="mx-auto flex min-h-[80svh] max-w-400 items-end px-5 pb-14 pt-32 sm:px-8 lg:items-center lg:pb-0">
        <div className="max-w-2xl">
          {planet && (
            <Link
              to="/planets/$planetSlug"
              params={{ planetSlug: planet.slug }}
              className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition hover:brightness-110"
              style={{
                borderColor: `${glow}55`,
                color: glow,
                backgroundColor: `${glow}14`,
              }}
            >
              <span>{planet.icon}</span>
              {planet.nameAr}
            </Link>
          )}

          <h1 className="text-balance font-heading text-4xl leading-normal font-semibold sm:text-6xl lg:text-7xl">
            {work.arabicTitle || work.title}
          </h1>
          {work.arabicTitle && (
            <p className="mt-3 font-mono text-base text-muted-foreground sm:text-lg" dir="ltr">
              {work.title}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2.5 text-sm text-foreground/75 sm:text-base">
            {work.year && <span>{work.year}</span>}
            {work.year && <Dot />}
            <span>{kindLabels[work.kind]}</span>
            {work.runtimeMinutes && (
              <>
                <Dot />
                <span className="flex items-center gap-1">
                  <ClockIcon /> {work.runtimeMinutes} د
                </span>
              </>
            )}
            {audienceLabel && (
              <>
                <Dot />
                <span className="rounded border border-foreground/30 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide">
                  {audienceLabel}
                </span>
              </>
            )}
            {work.calculatedRating !== null && (
              <>
                <Dot />
                <span className="flex items-center gap-1 font-medium">
                  <StarIcon weight="fill" /> {work.calculatedRating.toFixed(1)}
                  {work.scoreCoverage && (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({work.scoreCoverage.scored} من {work.scoreCoverage.total})
                    </span>
                  )}
                </span>
              </>
            )}
            <Dot />
            <span className="flex items-center gap-1">
              <CheckCircleIcon /> {releaseLabels[work.releaseStatus]}
            </span>
          </div>

          {heroAward ? <AwardLaurel recognition={heroAward} /> : null}

          {work.summary && (
            <p className="mt-5 line-clamp-2 max-w-xl text-sm leading-7 text-foreground/70 sm:text-base">
              {work.summary}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="px-7"
              nativeButton={false}
              render={<a href="#family-progress" />}
            >
              <FilmStripIcon data-icon="inline-start" /> حدّث حالة المشاهدة
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Subsection({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start gap-3", className)}>
      <span aria-hidden className="mt-1 h-5 w-1 shrink-0 rounded-full bg-primary" />
      <div>
        <h3 className="font-heading text-lg font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

const riskRank: Record<RiskAssessment["level"], number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const riskSurfaceClasses: Record<RiskAssessment["level"], string> = {
  none: "border-border/40 bg-muted/20",
  low: "border-primary/20 bg-primary/5",
  medium: "border-amber-500/30 bg-amber-500/10",
  high: "border-destructive/30 bg-destructive/10",
};

function strongestRisk(risks: RiskAssessment[]): RiskAssessment["level"] {
  return risks.reduce<RiskAssessment["level"]>(
    (strongest, risk) => (riskRank[risk.level] > riskRank[strongest] ? risk.level : strongest),
    "none",
  );
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function OverviewSection({
  work,
  structure,
  risks,
  taxonomyLabel,
}: {
  work: Work;
  structure: WorkStructure;
  risks: RiskAssessment[];
  taxonomyLabel: (vocabulary: string, value: string) => string;
}) {
  const chips = [
    ...work.genres.map((term) => ({ key: `genre:${term}`, label: taxonomyLabel("genre", term) })),
    ...work.tone.map((term) => ({ key: `tone:${term}`, label: taxonomyLabel("tone", term) })),
    ...work.tags
      .slice(0, 10)
      .map((term) => ({ key: `tag:${term}`, label: taxonomyLabel("tag", term) })),
  ];
  const hiddenTagCount = Math.max(0, work.tags.length - 10);
  const contentRisk = strongestRisk(
    risks.filter((risk) => risk.slug === "sexuality" || risk.slug === "behavioral"),
  );
  const theologyRisk = strongestRisk(risks.filter((risk) => risk.slug === "theology"));

  return (
    <div className="flex flex-col gap-12">
      <section>
        <p className="max-w-4xl text-lg xl:text-2xl leading-10 xl:leading-11 text-foreground/80">
          {work.summary || "لم يُضف ملخص تحريري بعد."}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map(({ key, label }) => (
            <Badge key={key} variant="secondary" className="rounded-full px-3 py-2 h-9 text-sm">
              {label}
            </Badge>
          ))}
          {hiddenTagCount > 0 && (
            <Badge
              variant="outline"
              className="rounded-full px-3 py-2 h-9 text-sm text-muted-foreground"
            >
              +{hiddenTagCount}
            </Badge>
          )}
        </div>
      </section>

      {work.awards.length > 0 ? <AwardsSection awards={work.awards} /> : null}

      {(work.contentWarnings || work.analysisNotes) && (
        <section className="grid gap-4 md:grid-cols-2">
          {work.contentWarnings && (
            <Alert className={cn("p-5", riskSurfaceClasses[contentRisk])}>
              <AlertTitle className="flex items-center justify-between gap-3">
                <span>تنبيه المحتوى</span>
                <RiskBadge level={contentRisk} />
              </AlertTitle>
              <AlertDescription className="mt-2 leading-9 text-base">
                {work.contentWarnings}
              </AlertDescription>
            </Alert>
          )}
          {work.analysisNotes && (
            <Alert className={cn("p-5", riskSurfaceClasses[theologyRisk])}>
              <AlertTitle className="flex items-center justify-between gap-3">
                <span>ملاحظات التحليل</span>
                <RiskBadge level={theologyRisk} />
              </AlertTitle>
              <AlertDescription className="mt-2 leading-9 text-base">
                {work.analysisNotes}
              </AlertDescription>
            </Alert>
          )}
        </section>
      )}

      {structure.seasons.length > 0 && (
        <section>
          <Subsection
            title="الأجزاء والمواسم"
            description="كل فيلم أو موسم داخل هذا العنوان، بملصقه وترتيبه في السلسلة."
          />
          <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 sm:-mx-8 sm:px-8">
            {structure.seasons.map((installment, index) => (
              <Link
                key={installment.id}
                to="/titles/$titleId/installments/$installmentId"
                params={{ titleId: work.id, installmentId: installment.id }}
                className="group w-36 shrink-0 snap-start text-start outline-none sm:w-44"
              >
                <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-muted ring-1 ring-white/10">
                  {installment.posterPath ? (
                    <img
                      src={installment.posterPath}
                      alt={installment.title}
                      className="size-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center text-muted-foreground">
                      <FilmStripIcon className="size-8" weight="duotone" />
                      <span className="text-xs">لا يوجد ملصق</span>
                    </div>
                  )}
                  <Badge className="absolute top-2 inset-s-2" variant="secondary">
                    {installment.seasonNumber === null
                      ? "فيلم"
                      : `موسم ${installment.seasonNumber}`}
                  </Badge>
                </div>
                <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-6">
                  {installment.title || `الجزء ${index + 1}`}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {installment.units.length > 0
                    ? `${installment.units.length} حلقة`
                    : installment.runtimeMinutes
                      ? `${installment.runtimeMinutes} دقيقة`
                      : `الجزء ${index + 1}`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {work.relations.length > 0 && (
        <section>
          <Subsection
            title="مكانه في السلسلة"
            description="العلاقات التالية تأتي من السجل الفعلي، وبنوعها واتجاهها المحفوظين."
          />
          <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
            {work.relations.map((relation) => (
              <Link
                key={relation.id}
                to="/titles/$titleId"
                params={{ titleId: relation.workId }}
                className="group w-40 shrink-0 snap-start"
              >
                <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-muted ring-1 ring-border/10 transition group-hover:ring-primary/50">
                  {relation.work.imagePath && (
                    <img
                      src={relation.work.imagePath}
                      alt=""
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  )}
                  {!relation.work.imagePath && (
                    <div className="flex size-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
                      {relation.work.title}
                    </div>
                  )}
                  <Badge variant="secondary" className="absolute top-2 inset-s-2 text-[10px]">
                    {relationLabels[relation.relationType] ?? relation.relationType}
                  </Badge>
                </div>
                <h4 className="mt-2 truncate text-sm font-medium">{relation.work.title}</h4>
                <p className="truncate text-xs text-muted-foreground">
                  {relation.direction === "outgoing" ? "ينطلق من هذا العمل" : "يصل إلى هذا العمل"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AwardLaurel({ recognition }: { recognition: AwardRecognition }) {
  return (
    <div className="mt-5 inline-flex max-w-full items-center gap-3 rounded-full border bg-background/55 py-2 pe-4 ps-2.5 shadow-sm backdrop-blur-md">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <TrophyIcon weight={recognition.result === "winner" ? "fill" : "duotone"} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">
          {recognition.organizationName} · {recognition.result === "winner" ? "فائز" : "مرشّح"}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {recognition.category}
          {recognition.year ? ` · ${recognition.year}` : ""}
        </span>
      </span>
    </div>
  );
}

function AwardsSection({ awards }: { awards: AwardRecognition[] }) {
  const winners = awards.filter((recognition) => recognition.result === "winner").length;
  return (
    <section>
      <Subsection
        title="الجوائز والترشيحات"
        description={`${winners} فوز · ${awards.length - winners} ترشيح محفوظ في سجل العمل`}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {awards.map((recognition) => (
          <Card key={recognition.id} size="sm" className="overflow-hidden">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  <TrophyIcon weight={recognition.result === "winner" ? "fill" : "duotone"} />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-sm leading-6">
                    {recognition.organizationName}
                  </CardTitle>
                  <CardDescription className="mt-0.5 leading-5">
                    {recognition.category}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={recognition.result === "winner" ? "default" : "secondary"}>
                {recognition.result === "winner" ? "فائز" : "مرشّح"}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {recognition.year ? <span>{recognition.year}</span> : null}
              {recognition.installmentTitle ? (
                <Badge variant="outline">{recognition.installmentTitle}</Badge>
              ) : (
                <Badge variant="outline">العنوان كاملًا</Badge>
              )}
              {recognition.sourceUrl ? (
                <a
                  href={recognition.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  المصدر <ArrowSquareOutIcon />
                </a>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Episodes tab
// ---------------------------------------------------------------------------

type EpisodePreview = {
  id: string;
  number: number;
  title: string;
  runtimeMinutes: number | null;
  releaseAt: number | null;
  isPlaceholder: boolean;
};

function EpisodesSection({
  structure,
  work,
  selectedId,
  onSelectedIdChange,
}: {
  structure: WorkStructure;
  work: Work;
  selectedId: string;
  onSelectedIdChange: (id: string) => void;
}) {
  const seasons = structure.seasons;
  const [expandedInline, setExpandedInline] = useState(false);
  const selected = seasons.find((season) => season.id === selectedId) ?? seasons[0];
  const isMovie = selected?.installmentKind === "movie" || selected?.installmentKind === "special";
  const episodes: EpisodePreview[] = (selected?.units ?? []).map((unit, index) => ({
    id: unit.id,
    number: unit.unitNumber ?? index + 1,
    title: unit.title || `الحلقة ${unit.unitNumber ?? index + 1}`,
    runtimeMinutes: unit.runtimeMinutes,
    releaseAt: unit.releaseAt,
    isPlaceholder: false,
  }));
  const inlineLimit = expandedInline ? Math.min(episodes.length, 15) : 6;
  const visibleEpisodes = episodes.slice(0, inlineLimit);
  const hasMoreThanPreview = episodes.length > 6;
  const requiresDialog = episodes.length > 15;

  return (
    <div className="space-y-8">
      <div className="border-b border-border/40 pb-6">
        <Subsection
          title="الأجزاء والحلقات"
          className="mb-0"
          description={`اختر موسماً أو فيلماً من ${work.arabicTitle || work.title} لعرض محتواه.`}
        />
        <div className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2">
          {seasons.map((installment) => (
            <button
              key={installment.id}
              type="button"
              onClick={() => {
                onSelectedIdChange(installment.id);
                setExpandedInline(false);
              }}
              className={cn(
                "flex w-64 shrink-0 snap-start items-center gap-3 rounded-2xl border p-2 text-start transition",
                selected?.id === installment.id
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-white/8 bg-card/45 hover:border-white/20",
              )}
            >
              <span className="aspect-2/3 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                {installment.posterPath ? (
                  <img src={installment.posterPath} alt="" className="size-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0">
                <strong className="line-clamp-2 text-sm">{installment.title}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {installment.installmentKind === "season"
                    ? `${installment.units.length} حلقة`
                    : "فيلم"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <section className="overflow-hidden rounded-3xl border border-white/8 bg-card/35">
          <div className="grid gap-6 p-5 sm:grid-cols-[8rem_1fr] sm:p-7">
            <div className="aspect-2/3 overflow-hidden rounded-2xl bg-muted">
              {selected.posterPath ? (
                <img src={selected.posterPath} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <FilmStripIcon className="size-9 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="self-center">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {isMovie ? "فيلم" : `الموسم ${selected.seasonNumber ?? selected.position}`}
                </Badge>
                {selected.rating != null && (
                  <Badge variant="outline">
                    <StarIcon weight="fill" className="text-amber-300" />{" "}
                    {selected.rating.toFixed(1)}
                  </Badge>
                )}
              </div>
              <h3 className="mt-4 font-heading text-2xl font-semibold">{selected.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {selected.releaseAt
                  ? new Intl.DateTimeFormat("ar", { dateStyle: "long" }).format(selected.releaseAt)
                  : "تاريخ الإصدار غير محدد"}
                {selected.runtimeMinutes ? ` · ${selected.runtimeMinutes} دقيقة` : ""}
              </p>
              {selected.summary && (
                <p className="mt-4 line-clamp-3 leading-7 text-foreground/70">{selected.summary}</p>
              )}
              {isMovie && (
                <Button className="mt-5" disabled title="يُفعّل عند ربط ملف وسائط بهذا الفيلم">
                  <PlayIcon weight="fill" data-icon="inline-start" /> تشغيل الفيلم
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      {!isMovie && episodes.length > 0 && (
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {visibleEpisodes.map((episode) => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
            />
          ))}
        </div>
      )}

      {!isMovie && episodes.length === 0 && (
        <Empty className="min-h-64 border border-dashed border-white/10">
          <EmptyHeader>
            <EmptyTitle>لا توجد حلقات في هذا الموسم</EmptyTitle>
            <EmptyDescription>الموسم محفوظ، لكن لم تُضف إليه حلقات بعد.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!isMovie && hasMoreThanPreview && (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => setExpandedInline((value) => !value)}>
            {expandedInline
              ? "عرض أقل"
              : requiresDialog
                ? "عرض 15 حلقة"
                : `عرض جميع الحلقات (${episodes.length})`}
          </Button>

          {requiresDialog && expandedInline && (
            <Dialog>
              <DialogTrigger render={<Button variant="secondary" />}>
                عرض كل الحلقات ({episodes.length})
              </DialogTrigger>
              <DialogContent className="grid h-[min(88svh,56rem)] max-w-6xl! grid-rows-[auto_1fr] gap-5 overflow-hidden p-5 sm:p-8">
                <DialogHeader className="border-b border-border/40 pb-5">
                  <DialogTitle className="text-xl">{selected?.title ?? "الموسم الأول"}</DialogTitle>
                  <DialogDescription>
                    {episodes.length} حلقة — تصفح الحلقات دون مغادرة صفحة العمل.
                  </DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto pe-1">
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {episodes.map((episode) => (
                      <EpisodeCard key={episode.id} episode={episode} />
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}

function EpisodeCard({ episode, className }: { episode: EpisodePreview; className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "group flex min-w-0 flex-col rounded-xl text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
      aria-label={`تشغيل الحلقة ${episode.number}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted ring-1 ring-border/10 transition group-hover:ring-primary/50">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
          <TelevisionIcon className="size-8" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
          <span className="flex size-11 items-center justify-center rounded-full bg-white text-black">
            <PlayIcon weight="fill" />
          </span>
        </div>
        <span className="absolute top-2 inset-s-2 rounded-md bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white">
          {episode.number}
        </span>
        <span className="absolute bottom-2 inset-e-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
          {episode.runtimeMinutes ?? 24} د
        </span>
      </div>
      <h4 className="mt-3 truncate font-heading text-sm font-semibold">{episode.title}</h4>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {episode.isPlaceholder
          ? "ستُضاف تفاصيل الحلقة من المصدر عند الربط."
          : episode.releaseAt
            ? "تاريخ الإصدار محفوظ"
            : "تفاصيل الحلقة محفوظة في الكتالوج."}
      </p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Cast & crew tab
// ---------------------------------------------------------------------------

// type CastEntity = { id: string; name: string; imagePath: string | null };
type Credited = { entity: Entity; credit: Work["contributors"][number] };

function CastSection({ people, studios }: { people: Credited[]; studios: Credited[] }) {
  return (
    <div className="flex flex-col gap-12">
      {people.length > 0 && (
        <section>
          <Subsection
            title="الممثلون وصنّاع العمل"
            description="قائمة منتقاة من الأشخاص المرتبطين بأدوار واضحة في هذا العمل."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {people.map(({ entity, credit }) => (
              <EntityDialog key={`${entity.id}:${credit.role}`} entity={entity}>
                <button
                  type="button"
                  className="group flex min-w-0 w-full items-center gap-4 rounded-2xl border border-border/40 bg-card/45 p-4 text-start transition hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Avatar className="size-20 ring-1 ring-border/40 transition group-hover:ring-primary/60">
                    {entity.imagePath && <AvatarImage src={entity.imagePath} alt="" />}
                    <AvatarFallback>{entity.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <strong className="block truncate font-heading text-base font-semibold">
                      {entity.name}
                    </strong>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {roleLabels[credit.role] ?? credit.role}
                    </span>
                  </span>
                </button>
              </EntityDialog>
            ))}
          </div>
        </section>
      )}

      {studios.length > 0 && (
        <section>
          <Subsection
            title="جهات الإنتاج"
            description="الاستوديوهات والجهات المرتبطة بهذا العمل."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {studios.map(({ entity, credit }) => (
              <EntityDialog key={`${entity.id}:${credit.role}`} entity={entity}>
                <span className="flex min-w-0 items-center gap-4 rounded-2xl border border-border/40 bg-card/45 p-4 transition hover:border-primary/30 hover:bg-card">
                  <span className="size-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {entity.imagePath ? (
                      <img src={entity.imagePath} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center font-heading text-lg text-muted-foreground">
                        {entity.name.slice(0, 1)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate font-heading text-lg font-semibold">
                      {entity.name}
                    </strong>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {roleLabels[credit.role] ?? credit.role}
                    </span>
                  </span>
                </span>
              </EntityDialog>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Similar tab
// ---------------------------------------------------------------------------

function SimilarSection({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <section className="border-t border-border/40 pt-12">
      <Subsection
        title="قد يعجبك أيضًا"
        description="أعمال قريبة في النبرة والموضوع والطاقم، رتبت لتسهيل الاستكشاف التالي."
      />
      <div className="flex gap-4 overflow-x-auto overflow-y-visible px-5 py-4 pb-5 sm:px-8 -mx-6">
        {recommendations.map((recommendation) => (
          <div
            key={recommendation.work.id}
            className="relative w-36 shrink-0 snap-start sm:w-44 lg:w-48"
          >
            <WorkCard work={recommendation.work} />
            <Popover>
              <PopoverTrigger
                className="absolute bottom-0 left-0 flex size-7 items-center justify-center rounded-full bg-background/75 text-muted-foreground ring-1 ring-white/10 transition hover:text-foreground"
                aria-label="تفاصيل سبب الاقتراح"
              >
                <InfoIcon />
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" side="top">
                <div className="text-lg font-medium text-foreground">
                  التطابق {recommendation.score}%
                </div>
                {recommendation.reasons.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {recommendation.reasons
                      .filter((reason) => Boolean(reason.label))
                      .map((reason, index) => (
                        <p
                          key={`${index.toString()}-${reason.label}`}
                          className="line-clamp-2 text-[11px] leading-5 text-muted-foreground"
                        >
                          {reason.label}
                        </p>
                      ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Scores tab
// ---------------------------------------------------------------------------

function ScoreSection({ work }: { work: Work }) {
  const availableCriteria = scoreCriteria.filter(
    (criterion) => work.scoreComponents[criterion] !== undefined,
  );
  const isComplete = availableCriteria.length === scoreCriteria.length;

  return (
    <div>
      <Subsection
        title="بصمة التقييم"
        description="تفصيل الدرجات والأوزان التي تكوّن النتيجة النهائية على مقياس من عشرة."
      />

      {availableCriteria.length === 0 ? (
        <Empty className="border border-border/40 bg-card/30">
          <EmptyHeader>
            <EmptyTitle>لم يُقيّم هذا العمل بعد</EmptyTitle>
            <EmptyDescription>
              ستظهر هنا درجات القصة والشخصيات والحِرفة عند إضافتها إلى السجل.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="border-border/40 bg-card/35">
            <CardHeader className="border-b border-border/40">
              <CardTitle>مكوّنات التقييم</CardTitle>
              <CardDescription>يمثّل طول كل شريط الدرجة قبل تطبيق وزنها.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {scoreCriteria.map((criterion) => {
                const value = work.scoreComponents[criterion];
                const label = scoreLabel(criterion, work.kind).ar;
                const weight = Math.round(scoreWeights[criterion] * 100);
                return (
                  <Progress
                    key={criterion}
                    value={value === undefined ? null : value * 10}
                    className={cn(value === undefined && "opacity-45")}
                  >
                    <ProgressLabel>{label}</ProgressLabel>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      الوزن {weight}%
                    </Badge>
                    <ProgressValue className="font-mono font-semibold text-foreground">
                      {() => (value === undefined ? "—" : value.toFixed(1))}
                    </ProgressValue>
                  </Progress>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/45">
            <CardHeader className="border-b border-border/40">
              <CardTitle>النتيجة المحسوبة</CardTitle>
              <CardDescription>مجموع مساهمة كل معيار بعد تطبيق وزنه.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-4 border-b border-border/40 pb-5">
                <div>
                  <p className="text-xs text-muted-foreground">التقييم النهائي</p>
                  <p className="mt-1 text-sm text-muted-foreground">من 10</p>
                </div>
                <p className="font-mono text-5xl font-semibold tracking-tight tabular-nums">
                  {work.calculatedRating?.toFixed(1) ?? "—"}
                </p>
              </div>

              <dl className="mt-2 flex flex-col">
                {scoreCriteria.map((criterion) => {
                  const value = work.scoreComponents[criterion];
                  const contribution = value === undefined ? null : value * scoreWeights[criterion];
                  return (
                    <div
                      key={criterion}
                      className="flex items-center justify-between gap-3 border-b border-border/30 py-2.5 last:border-0"
                    >
                      <dt className="truncate text-xs text-muted-foreground">
                        {scoreLabel(criterion, work.kind).ar}
                      </dt>
                      <dd className="font-mono text-xs tabular-nums">
                        {contribution === null ? "—" : `+${contribution.toFixed(2)}`}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </CardContent>
          </Card>

          <Alert className="border-primary/20 bg-primary/5 xl:col-span-2">
            <AlertTitle>كيف تُحسب النتيجة؟</AlertTitle>
            <AlertDescription className="mt-2 leading-7">
              تُضرب كل درجة في وزنها، ثم تُجمع المساهمات وتُقرّب النتيجة إلى منزلة عشرية واحدة. لا يظهر
              تقييم نهائي حتى تُسجّل المعايير الستة كلها
              {isComplete ? " — وجميعها متاحة لهذا العمل." : "."}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details tab
// ---------------------------------------------------------------------------

function WorkDetails({
  work,
  structure,
  taxonomyLabel,
}: {
  work: Work;
  structure: WorkStructure;
  taxonomyLabel: (vocabulary: string, value: string) => string;
}) {
  const formatList = (values: string[], vocabulary?: string) =>
    values.map((value) => (vocabulary ? taxonomyLabel(vocabulary, value) : value)).join("، ");
  const primaryDetails: Array<readonly [string, string]> = [
    ["العنوان الأصلي", work.title],
    ...(work.aliases.length ? [["العناوين البديلة", formatList(work.aliases)] as const] : []),
    ...(work.country.length ? [["الدول", formatList(work.country, "country")] as const] : []),
    ...(work.audience ? [["الجمهور", taxonomyLabel("audience", work.audience)] as const] : []),
  ];
  const formatDetails: Array<readonly [string, string]> = [
    ...(work.runtimeMinutes ? [["المدة", `${work.runtimeMinutes} دقيقة`] as const] : []),
    ...(work.playtimeMinutes ? [["مدة اللعب", `${work.playtimeMinutes} دقيقة`] as const] : []),
    ...(work.kind === "series" || work.kind === "anime"
      ? [
          ...(structure.seasons.length
            ? [["عدد المواسم", `${structure.seasons.length} موسم`] as const]
            : []),
          ...(work.episodeCount || structure.totalUnits
            ? [["عدد الحلقات", `${work.episodeCount || structure.totalUnits} حلقة`] as const]
            : []),
        ]
      : []),
    ...(work.kind === "novel" || work.kind === "manga" || work.kind === "comic"
      ? [
          ...(work.pageCount ? [["عدد الصفحات", `${work.pageCount} صفحة`] as const] : []),
          ...(work.chapterCount ? [["عدد الفصول", `${work.chapterCount} فصل`] as const] : []),
          ...(work.volumeCount ? [["عدد المجلدات", `${work.volumeCount} مجلد`] as const] : []),
        ]
      : []),
    ...(work.routeCount && (work.kind === "game" || work.kind === "visual-novel")
      ? [["عدد المسارات", `${work.routeCount} مسار`] as const]
      : []),
  ];
  const releaseDetails: Array<readonly [string, string]> = [
    ["حالة الإصدار", releaseLabels[work.releaseStatus]],
    ...(work.releaseStart ? [["بداية العرض", work.releaseStart] as const] : []),
    ...(work.releaseEnd ? [["نهاية العرض", work.releaseEnd] as const] : []),
    ...(work.sourceMaterial
      ? [
          ["المادة الأصلية", work.sourceMaterial.type] as const,
          ...(work.sourceMaterial.publication
            ? [["النشر", work.sourceMaterial.publication] as const]
            : []),
          ...(work.sourceMaterial.serialization.length
            ? [["التسلسل", formatList(work.sourceMaterial.serialization)] as const]
            : []),
        ]
      : []),
    ...(work.publication?.format ? [["صيغة النشر", work.publication.format] as const] : []),
    ...(work.publication?.publisher ? [["الناشر", work.publication.publisher] as const] : []),
    ...(work.publication?.imprint ? [["علامة النشر", work.publication.imprint] as const] : []),
  ];
  const hasTaxonomy = work.genres.length > 0 || work.tone.length > 0 || work.tags.length > 0;

  return (
    <Card className="border-border/40 bg-card/35">
      <CardHeader className="border-b border-border/40">
        <CardTitle className="text-xl">تفاصيل العمل</CardTitle>
        <CardDescription>
          بيانات الكتالوج المتاحة، مرتبة من دون حقول فارغة أو معلومات شخصية.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid items-start gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
        <DetailGroup title="الهوية والتصنيف" items={primaryDetails} />
        {formatDetails.length > 0 && <DetailGroup title="الأرقام والصيغة" items={formatDetails} />}
        <DetailGroup title="الإصدار والمصدر" items={releaseDetails} />
        {hasTaxonomy && (
          <section className="border-t border-border/40 pt-8 md:col-span-2 xl:col-span-3">
            <h3 className="font-heading text-sm font-semibold">التصنيف والموضوعات</h3>
            <div className="mt-5 gap-8 grid  md:grid-cols-2">
              {work.tone.length > 0 && (
                <TaxonomyBadges
                  title="الطابع"
                  values={work.tone.map((value) => taxonomyLabel("tone", value))}
                />
              )}
              {work.genres.length > 0 && (
                <TaxonomyBadges
                  title="الأنواع"
                  values={work.genres.map((value) => taxonomyLabel("genre", value))}
                />
              )}
              {work.tags.length > 0 && (
                <TaxonomyBadges
                  className="col-span-2"
                  title="الوسوم"
                  values={work.tags.map((value) => taxonomyLabel("tag", value))}
                />
              )}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function TaxonomyBadges({
  title,
  values,
  className = "",
}: {
  title: string;
  values: string[];
  className?: string;
}) {
  return (
    <div className={cn("md:px-5", className)}>
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge key={value} variant="secondary" className="rounded-full px-3 h-8 py-1.5 text-sm">
            {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function DetailGroup({
  title,
  items,
  className,
}: {
  title: string;
  items: Array<readonly [string, string]>;
  className?: string;
}) {
  return (
    <section className={className}>
      <h3 className="font-heading text-sm font-semibold">{title}</h3>
      <dl className="mt-3 flex flex-col border-t border-border/40">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[7rem_1fr] gap-3 border-b border-border/30 py-3"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-sm leading-6">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function MetadataPanel({
  work,
  planetName,
  audienceLabel,
}: {
  work: Work;
  planetName: string;
  audienceLabel: string;
}) {
  const rows = [
    ["النوع", kindLabels[work.kind]],
    ["الإصدار", work.releaseStart || String(work.year ?? "—")],
    ["الحالة", releaseLabels[work.releaseStatus]],
    ["الكوكب", planetName],
    ["الجمهور", audienceLabel],
  ] as const;
  return (
    <Card size="sm" className="border-border/40 bg-card/45">
      <CardHeader className="border-b border-border/40">
        <CardTitle>بطاقة السجل</CardTitle>
        <CardDescription className="text-xs">أهم بيانات الكتالوج في لمحة واحدة.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[5rem_1fr] gap-3 border-b border-border/30 py-3 last:border-0 last:pb-0"
            >
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="min-w-0 truncate text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function RiskBadge({ level }: { level: RiskAssessment["level"] }) {
  return (
    <Badge
      variant={level === "high" ? "destructive" : level === "medium" ? "outline" : "secondary"}
    >
      {riskLabels[level]}
    </Badge>
  );
}

function ParentGuideCard({ risks }: { risks: RiskAssessment[] }) {
  const highRiskCount = risks.filter((risk) => risk.level === "high").length;

  return (
    <Card size="sm" className="border-border/40 bg-card/45">
      <CardHeader className="border-b border-border/40">
        <CardTitle>دليل الوالدين</CardTitle>
        <CardDescription className="text-xs">
          نظرة سريعة على الموضوعات الحساسة قبل المشاهدة.
        </CardDescription>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={highRiskCount ? "destructive" : "secondary"}>
            {highRiskCount ? `${highRiskCount} تنبيه مرتفع` : "لا توجد تنبيهات مرتفعة"}
          </Badge>
          <span className="text-xs text-muted-foreground">{risks.length} محاور</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {risks.length ? (
          risks.map((risk) => {
            return (
              <div
                key={risk.dimensionId}
                className="flex w-full items-center justify-between gap-3 pe-2 ps-3 py-2 text-start hover:bg-accent/75 rounded-2xl"
              >
                <h3 className="text-sm font-medium">{risk.nameAr}</h3>
                <div className="flex items-center gap-2">
                  <RiskBadge level={risk.level} />
                </div>
              </div>
            );
          })
        ) : (
          <Empty className="border p-6">
            <EmptyHeader>
              <EmptyTitle className="text-base">لا توجد تنبيهات مسجلة</EmptyTitle>
              <EmptyDescription>لم تُضف تقييمات منظمة لهذا العمل بعد.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const kindLabels: Record<Work["kind"], string> = {
  movie: "فيلم",
  series: "مسلسل",
  anime: "أنمي",
  game: "لعبة",
  novel: "رواية",
  manga: "مانغا",
  "visual-novel": "رواية مرئية",
  comic: "قصص مصوّرة",
};
const releaseLabels: Record<Work["releaseStatus"], string> = {
  upcoming: "قادم",
  airing: "يعرض الآن",
  returning: "مستمر",
  completed: "مكتمل",
  unknown: "غير معروف",
};
const riskLabels: Record<RiskAssessment["level"], string> = {
  none: "لا يوجد",
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
};
const relationLabels: Record<string, string> = {
  adaptation: "اقتباس",
  sequel: "تكملة",
  "spin-off": "عمل مشتق",
  "side-story": "قصة جانبية",
  compilation: "تجميع",
  alternative: "نسخة بديلة",
  related: "مرتبط",
};
const roleLabels: Record<string, string> = {
  creator: "مبتكر",
  original_author: "المؤلف الأصلي",
  director: "مخرج",
  writer: "كاتب",
  producer: "منتج",
  executive_producer: "منتج تنفيذي",
  creative_producer: "منتج إبداعي",
  character_designer: "مصمم شخصيات",
  art_director: "مدير فني",
  scene_design: "تصميم المشاهد",
  composer: "مؤلف موسيقي",
  animation_studio: "استوديو التحريك",
  production_company: "شركة إنتاج",
  distributor: "موزع",
  publisher: "ناشر",
};
