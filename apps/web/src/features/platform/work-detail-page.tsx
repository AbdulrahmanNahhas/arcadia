import type { AwardRecognition } from "@arcadia/contracts";
import {
  ArrowSquareOutIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  DatabaseIcon,
  FilmSlateIcon,
  FilmStripIcon,
  HeartIcon,
  InfoIcon,
  PlayIcon,
  RowsIcon,
  SparkleIcon,
  StarIcon,
  TelevisionIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { recordHistory } from "@/features/archive/api";
import { WorkFamilyActions } from "@/features/archive/work-family-actions";
import type { Entity, Work, WorkStructure } from "@/features/library/model";
import { PlayFilmButton } from "@/features/library/play-button";
import { scoreCriteria, scoreLabel, scoreWeights } from "@/features/library/scoring";
import { useArabicTranslations } from "@/features/library/translations";
import type { Recommendation, RiskAssessment } from "@/features/platform/model";
import { getTitleSocial, socialKeys, updateTitleState } from "@/features/social/api";
import { TitleSocialSection } from "@/features/social/title-social-section";
import { cn } from "@/lib/utils";
import { getEntities } from "@/server/library.functions";
import { getPlatformWorkDetail } from "@/server/platform.functions";
import { EntityDialog } from "./components/entity-dialog";
import { PlatformShell } from "./components/platform-shell";
import { WorkCard } from "./components/work-card";

type PlanetInfo = { slug: string; icon: string; nameAr: string; primaryColor: string } | null;
type TitleTabId = "overview" | "episodes" | "cast" | "scores" | "reviews" | "details";
type TitleTab = {
  id: TitleTabId;
  label: string;
  title: string;
  description: string;
  summary: string;
  icon: typeof RowsIcon;
};

export function WorkDetailPage({
  workId,
  initialInstallmentId,
}: {
  workId: string;
  initialInstallmentId?: string;
}) {
  const { data } = useSuspenseQuery({
    queryKey: ["platform-work", workId],
    queryFn: () => getPlatformWorkDetail({ data: { workId } }),
  });
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  const { taxonomyLabel } = useArabicTranslations();
  const [selectedInstallmentId, setSelectedInstallmentId] = useState(initialInstallmentId ?? "");
  const [activeTab, setActiveTab] = useState<TitleTabId>(
    initialInstallmentId ? "episodes" : "overview",
  );
  useEffect(() => {
    recordHistory(workId).catch(() => undefined);
  }, [workId]);
  useEffect(() => {
    if (!initialInstallmentId) return;
    setSelectedInstallmentId(initialInstallmentId);
    setActiveTab("episodes");
  }, [initialInstallmentId]);
  if (!data)
    return (
      <PlatformShell immersive>
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
    {
      id: "overview",
      label: "الملف",
      title: "ملف العمل",
      description: "الملخص التحريري وموقع العنوان داخل سلسلته، مع مساحة للنقاش.",
      summary: `${structure.seasons.length} أجزاء · ${work.relations.length} روابط`,
      icon: RowsIcon,
    },
    hasMedia && {
      id: "episodes",
      label: "الأجزاء",
      title: "الأجزاء والحلقات",
      description: "تنقّل بين المواسم والأفلام، ثم افتح محتوى كل جزء من سجل واحد.",
      summary: `${structure.seasons.length} أجزاء · ${structure.totalUnits} حلقات`,
      icon: FilmStripIcon,
    },
    hasCast && {
      id: "cast",
      label: "الصنّاع",
      title: "صنّاع العمل",
      description: "الأشخاص والاستوديوهات المثبتة أدوارهم في سجل هذا العنوان.",
      summary: `${people.length} أشخاص · ${studios.length} جهات`,
      icon: UsersThreeIcon,
    },
    {
      id: "scores",
      label: "التقييم",
      title: "بصمة التقييم",
      description: "الدرجات التحريرية وأوزانها، مع شرح واضح لكيفية تكوين النتيجة.",
      summary: work.scoreCoverage
        ? `${work.scoreCoverage.scored} من ${work.scoreCoverage.total} أجزاء مقيّمة`
        : "لم يكتمل التقييم بعد",
      icon: ChartBarIcon,
    },
    {
      id: "reviews",
      label: "العائلة",
      title: "مراجعات العائلة",
      description: "انطباعات شخصية ونقاشات منفصلة عن التقييم التحريري لأركاديا.",
      summary: "مساحة العائلة",
      icon: UsersThreeIcon,
    },
    {
      id: "details",
      label: "البيانات",
      title: "بيانات الكتالوج",
      description: "العناوين الموسّعة، بنية العمل، مصدره، تصنيفاته، وسجل الجوائز.",
      summary: `${work.aliases.length} عناوين بديلة · ${work.awards.length} تكريمات`,
      icon: DatabaseIcon,
    },
  ].filter(Boolean) as TitleTab[];
  const activeTabDetails = tabs.find((tab) => tab.id === activeTab) ?? tabs.at(0);
  if (!activeTabDetails) return null;

  return (
    <PlatformShell>
      <WorkHero
        work={work}
        planet={planet?.planet ?? null}
        audienceLabel={audienceLabel}
        playableInstallmentId={soleFilmInstallmentId(structure)}
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TitleTabId)}
        className="mx-auto max-w-400 gap-0 px-5 pt-10 sm:px-8"
      >
        <div
          id="title-sections"
          className="scroll-fade-x sticky top-14 z-30 -mx-5 overflow-x-auto border-y bg-background/90 px-5 overflow-y-clip! backdrop-blur-xl sm:-mx-8 sm:px-8"
        >
          <TabsList variant="line" className="h-12! min-w-max justify-start gap-0 p-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                aria-label={tab.title}
                className="h-9 flex-none rounded-full! px-4! text-sm hover:bg-accent!"
              >
                <tab.icon data-icon="inline-start" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <header className="grid gap-5 border-b py-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="flex min-w-0 items gap-4 items-center">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <activeTabDetails.icon weight="duotone" className="size-8" />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-xl font-bold sm:text-2xl">
                {activeTabDetails.title}
              </h2>
              <p className="mt-1 max-w-2xl leading-6 text-muted-foreground">
                {activeTabDetails.description}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="h-8 w-fit px-3 flex gap-4">
            {activeTabDetails.summary}
          </Badge>
        </header>

        <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
          <main className="min-w-0">
            <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
              <OverviewSection
                work={work}
                structure={structure}
                risks={risks}
                taxonomyLabel={taxonomyLabel}
              />
            </TabsContent>

            {hasMedia && (
              <TabsContent value="episodes" className="mt-0 focus-visible:outline-none">
                <EpisodesSection
                  workId={work.id}
                  structure={structure}
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
              <ScoreSection work={work} structure={structure} />
            </TabsContent>

            {!work.isPrivate && (
              <TabsContent value="reviews" className="mt-0 focus-visible:outline-none">
                <TitleSocialSection titleId={work.id} mode="reviews" />
              </TabsContent>
            )}

            <TabsContent value="details" className="mt-0 focus-visible:outline-none">
              <WorkDetails work={work} structure={structure} taxonomyLabel={taxonomyLabel} />
            </TabsContent>
          </main>

          <aside className="flex flex-col gap-5 p-1 lg:sticky lg:top-32 lg:max-h-[calc(100svh-9rem)] lg:pe-2">
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
        <div className="mx-auto max-w-400 pb-12">
          <SimilarSection recommendations={recommendations} />
        </div>
      )}

      {!work.isPrivate && (
        <section id="family-discussion" className="border-t bg-muted/15">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-18">
            <TitleSocialSection titleId={work.id} mode="discussion" />
          </div>
        </section>
      )}
    </PlatformShell>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

/** Resolves a YouTube URL (watch/short/embed) to an embeddable URL, or null if it isn't one. */
function youtubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return `https://www.youtube.com/embed${parsed.pathname}`;
    if (!parsed.hostname.endsWith("youtube.com")) return null;
    if (parsed.pathname.startsWith("/embed/")) return url;
    const id = parsed.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

/**
 * The hero's play button only means something when there is exactly one film to play. A franchise
 * or a series has no single "start here", so those keep jumping to the episodes list instead of
 * guessing which installment the family meant.
 */
function soleFilmInstallmentId(structure: WorkStructure) {
  const films = structure.seasons.filter(
    (season) => season.installmentKind === "movie" || season.installmentKind === "special",
  );
  return films.length === 1 ? (films[0]?.id ?? null) : null;
}

function WorkHero({
  work,
  planet,
  audienceLabel,
  playableInstallmentId,
}: {
  work: Work;
  planet: PlanetInfo;
  audienceLabel: string | null;
  playableInstallmentId: string | null;
}) {
  const glow = planet?.primaryColor ?? "#7c8cf8";
  const heroAward =
    work.awards.find((recognition) => recognition.isFeatured) ??
    work.awards.find((recognition) => recognition.result === "winner") ??
    work.awards[0];

  const queryClient = useQueryClient();
  const social = useQuery({
    queryKey: socialKeys.title(work.id),
    queryFn: () => getTitleSocial(work.id),
  });
  const isFavorite = social.data?.state?.isFavorite ?? false;
  const favoriteMutation = useMutation({
    mutationFn: (next: boolean) => updateTitleState(work.id, { isFavorite: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: socialKeys.title(work.id) }),
  });

  // "trailer" is a reserved provider slug (see the editor form's external links field), not a
  // fuzzy match over provider/label text — that used to misfire on any link whose label happened
  // to mention a trailer-ish word for an unrelated reason.
  const trailerLink = work.externalLinks.find(
    (link) => link.provider.trim().toLowerCase() === "trailer",
  );
  const trailerEmbedUrl = trailerLink ? youtubeEmbedUrl(trailerLink.url) : null;

  return (
    <>
      <section className="relative isolate min-h-[92svh] overflow-hidden border-b bg-background">
        {work.bannerPath || work.imagePath ? (
          <img
            src={work.bannerPath || work.imagePath || undefined}
            alt=""
            width={1600}
            height={900}
            className="absolute inset-0 -z-30 size-full object-cover"
          />
        ) : null}

        {/* ambient color wash from the planet's identity — kept faint, it should read as light, not decoration */}
        <div
          aria-hidden
          className="absolute inset-0 -z-20"
          style={{
            background: `radial-gradient(65% 60% at 82% 8%, ${glow}2e, transparent 65%)`,
          }}
        />

        {/* layered scrim: this is the actual Netflix/Prime/Apple TV trick — three gradients doing
            three different jobs, instead of one flat wash trying to do all of them */}
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/70 via-45% to-transparent" />
        <div className="absolute inset-0 -z-10 bg-linear-to-l from-background/90 via-background/10 to-transparent lg:from-background/80" />
        <div className="absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-background/60 to-transparent" />

        <div className="mx-auto grid min-h-[88svh] max-w-400 items-end gap-10 px-5 pb-10 pt-32 sm:px-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:pb-14">
          <div className="max-w-3xl">
            {planet && (
              <Link
                to="/planets/$planetSlug"
                params={{ planetSlug: planet.slug }}
                className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition hover:brightness-110"
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

            <h1 className="text-balance font-heading text-4xl leading-[1.15] font-semibold drop-shadow-[0_2px_24px_rgb(0_0_0/0.35)] sm:text-6xl lg:text-7xl">
              {work.logoPath ? (
                <img
                  src={work.logoPath}
                  alt={work.arabicTitle || work.title}
                  className="h-24! max-w-full object-contain drop-shadow-[0_4px_30px_rgb(0_0_0/0.4)] sm:h-32! md:h-36! xl:h-48!"
                />
              ) : (
                work.arabicTitle || work.title
              )}
            </h1>
            <p className="mt-3 font-mono text-base text-muted-foreground sm:text-lg" dir="ltr">
              {work.logoPath ? work.arabicTitle : work.arabicTitle && work.title}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-foreground/80 sm:text-base">
              {work.calculatedRating !== null && (
                <span
                  className="flex items-center gap-1.5 rounded-md border px-2 py-1 font-semibold text-foreground"
                  style={{ borderColor: `${glow}55`, backgroundColor: `${glow}12` }}
                >
                  <StarIcon weight="fill" style={{ color: glow }} />
                  {work.calculatedRating.toFixed(1)}
                  {work.scoreCoverage && (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({work.scoreCoverage.scored} من {work.scoreCoverage.total})
                    </span>
                  )}
                </span>
              )}
              {work.year && <span>{work.year}</span>}
              <span>{kindLabels[work.kind]}</span>
              {work.runtimeMinutes && (
                <span className="flex items-center gap-1">
                  <ClockIcon /> {work.runtimeMinutes} د
                </span>
              )}
              {audienceLabel && <Badge variant="outline">{audienceLabel}</Badge>}
              <span className="flex items-center gap-1 text-foreground/70">
                <CheckCircleIcon /> {releaseLabels[work.releaseStatus]}
              </span>
            </div>

            {work.summary && (
              <p className="mt-6 line-clamp-3 max-w-2xl text-sm leading-8 text-foreground/80 sm:text-base">
                {work.summary}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {playableInstallmentId ? (
                <PlayFilmButton
                  size="lg"
                  className="px-4 font-semibold"
                  installmentId={playableInstallmentId}
                  titleId={work.id}
                  label="ابدأ بالمشاهدة"
                />
              ) : (
                <Button
                  size="lg"
                  className="px-4 font-semibold"
                  nativeButton={false}
                  render={<a href="#family-progress" />}
                >
                  <PlayIcon weight="fill" data-icon="inline-start rotate-90" /> ابدأ بالمشاهدة
                </Button>
              )}

              {trailerLink ? (
                trailerEmbedUrl ? (
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button
                          size="lg"
                          variant="outline"
                          className="border-white/25 bg-white/10 font-semibold backdrop-blur-md hover:bg-white/20"
                        />
                      }
                    >
                      <FilmSlateIcon weight="fill" data-icon="inline-start" /> شاهد الإعلان
                    </DialogTrigger>
                    <DialogContent
                      showCloseButton={false}
                      className="max-w-3xl! gap-0 overflow-hidden rounded-2xl p-0"
                    >
                      <div className="aspect-video bg-black">
                        <iframe
                          src={trailerEmbedUrl}
                          title="الإعلان الرسمي"
                          allow="autoplay; encrypted-media; picture-in-picture"
                          allowFullScreen
                          sandbox="allow-scripts allow-presentation allow-popups"
                          className="size-full"
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/25 bg-white/10 font-semibold backdrop-blur-md hover:bg-white/20"
                    nativeButton={false}
                    render={<a href={trailerLink.url} target="_blank" rel="noreferrer" />}
                  >
                    <FilmSlateIcon weight="fill" data-icon="inline-start" /> شاهد الإعلان
                  </Button>
                )
              ) : null}

              <Button
                size="icon-lg"
                variant="outline"
                aria-label={isFavorite ? "إزالة من المفضلة" : "أضف إلى المفضلة"}
                aria-pressed={isFavorite}
                disabled={favoriteMutation.isPending}
                onClick={() => favoriteMutation.mutate(!isFavorite)}
                className={cn(
                  "border-white/25 bg-white/10 backdrop-blur-md hover:bg-white/20",
                  isFavorite && "border-primary/60 bg-primary/25 text-primary hover:bg-primary/35",
                )}
              >
                <HeartIcon weight={isFavorite ? "fill" : "regular"} />
              </Button>
            </div>
          </div>

          {heroAward ? <AwardLaurel recognition={heroAward} /> : null}
        </div>
      </section>

      {/* floating glass action row, overlapping the hero like Apple TV+'s "My List" bar —
          replaces the settings-card look with something that reads as part of the same scene */}
      <section
        id="family-progress"
        className={cn(
          "relative z-10 mx-auto -mt-14 max-w-400 px-5 sm:px-8",
          work.isPrivate && "max-w-200",
        )}
      >
        <div className="overflow-hidden rounded-3xl border bg-background/85 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <SparkleIcon weight="duotone" className="size-5" />
              </span>
              <div>
                <p className="font-heading text-base font-semibold sm:text-lg">مساحتك مع العمل</p>
                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                  قيّم، احفظ، أو شارك العنوان مع العائلة.
                </p>
              </div>
            </div>
            <WorkFamilyActions titleId={work.id} title={work.arabicTitle || work.title} />
          </div>
          {!work.isPrivate && (
            <div className="border-t bg-muted/10 p-5 sm:p-6">
              <TitleSocialSection titleId={work.id} mode="quick" />
            </div>
          )}
        </div>
      </section>
    </>
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
  medium: "border-classification-caution/30 bg-classification-caution/10",
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
          <div className="scroll-fade-x -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 sm:-mx-8 sm:px-8">
            {structure.seasons.map((installment, index) => {
              const isSeason =
                (installment.installmentKind ?? installment.installmentKind) === "season";
              const seasonNumber = isSeason
                ? structure.seasons
                    .slice(0, index + 1)
                    .filter((item) => (item.installmentKind ?? item.installmentKind) === "season")
                    .length
                : null;

              return (
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
                      {seasonNumber === null ? "فيلم" : `موسم ${seasonNumber}`}
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
              );
            })}
          </div>
        </section>
      )}

      {work.relations.length > 0 && (
        <section>
          <Subsection
            title="مكانه في السلسلة"
            description="العلاقات التالية تأتي من السجل الفعلي، وبنوعها واتجاهها المحفوظين."
          />
          <div className="scroll-fade-x -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
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
    <Card
      size="sm"
      className="w-full max-w-72 justify-self-end bg-background/55 shadow-2xl shadow-background/25 ring-foreground/15 backdrop-blur-xl lg:justify-self-end"
    >
      <CardContent className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <TrophyIcon size={19} weight={recognition.result === "winner" ? "fill" : "duotone"} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{recognition.result === "winner" ? "فوز بارز" : "ترشيح بارز"}</span>
            {recognition.year ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">{recognition.year}</span>
              </>
            ) : null}
          </div>
          <p className="mt-1 truncate font-heading text-sm font-semibold">{recognition.category}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {recognition.organizationName}
          </p>
        </div>
        {recognition.sourceUrl ? (
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<a href={recognition.sourceUrl} target="_blank" rel="noreferrer" />}
            aria-label="المصدر الرسمي للتكريم"
          >
            <ArrowSquareOutIcon />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AwardsSection({ awards, className }: { awards: AwardRecognition[]; className?: string }) {
  const winners = awards.filter((recognition) => recognition.result === "winner").length;
  return (
    <Card className={className}>
      <CardHeader className="border-b sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>سجل الجوائز</CardTitle>
          <CardDescription className="mt-1">
            التكريمات الموثقة للعنوان أو لأحد أجزائه.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{winners} فوز</Badge>
          <Badge variant="outline">{awards.length - winners} ترشيح</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col px-0">
        {awards.map((recognition) => (
          <article
            key={recognition.id}
            className="grid gap-3 border-b border-border/40 px-(--card-spacing) py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                <TrophyIcon
                  size={19}
                  weight={recognition.result === "winner" ? "fill" : "duotone"}
                />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-sm font-semibold leading-6">
                    {recognition.category}
                  </h3>
                  <Badge variant={recognition.result === "winner" ? "default" : "secondary"}>
                    {recognition.result === "winner" ? "فائز" : "مرشّح"}
                  </Badge>
                  {recognition.isFeatured ? <Badge variant="outline">بارز</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {recognition.organizationName}
                  {recognition.year ? ` · ${recognition.year}` : ""}
                  {recognition.installmentTitle ? ` · ${recognition.installmentTitle}` : ""}
                </p>
              </div>
            </div>
            {recognition.sourceUrl ? (
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<a href={recognition.sourceUrl} target="_blank" rel="noreferrer" />}
                className="w-fit"
              >
                المصدر
                <ArrowSquareOutIcon data-icon="inline-end" />
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">مسجّل للعنوان</span>
            )}
          </article>
        ))}
      </CardContent>
    </Card>
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
  workId,
  structure,
  selectedId,
  onSelectedIdChange,
}: {
  workId: string;
  structure: WorkStructure;
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
    <div className="flex flex-col gap-4">
      <section aria-label="اختيار الجزء" className="pb-0!">
        <div className="scroll-fade-x flex  gap-3 overflow-x-auto px-2  pb-2">
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
                  : "border-border bg-card/45 hover:border-primary/30 hover:bg-card",
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
      </section>

      {selected && (
        <section className="overflow-hidden rounded-3xl border bg-card/35">
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
                    <StarIcon weight="fill" /> {selected.rating.toFixed(1)}
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
                <PlayFilmButton className="mt-5" installmentId={selected.id} titleId={workId} />
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
        <Empty className="min-h-64 border border-dashed">
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
                <div className="scroll-fade-y overflow-y-auto pe-1">
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
      disabled
      title="يُفعّل عند ربط ملف وسائط بهذه الحلقة"
      className={cn(
        "group flex min-w-0 flex-col rounded-xl text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed",
        className,
      )}
      aria-label={`تشغيل الحلقة ${episode.number} — يُفعّل عند ربط ملف وسائط بهذه الحلقة`}
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted ring-1 ring-border/10 transition group-hover:ring-primary/50">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
          <TelevisionIcon className="size-8" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition group-hover:bg-background/65 group-hover:opacity-100">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/60 text-primary-foreground">
            <PlayIcon weight="fill" />
          </span>
        </div>
        <span className="absolute top-2 inset-s-2 rounded-md bg-background/85 px-2 py-0.5 text-[11px] font-medium text-foreground">
          {episode.number}
        </span>
        <span className="absolute bottom-2 inset-e-2 rounded bg-background/85 px-1.5 py-0.5 text-[10px] text-foreground">
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
        <section aria-label="الأشخاص المرتبطون بالعمل">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {people.map(({ entity, credit }) => (
              <EntityDialog key={`${entity.id}:${credit.role}`} entity={entity}>
                <span className="group flex min-w-0 w-full items-center gap-4 rounded-2xl border border-border/40 bg-card/45 p-4 text-start transition hover:border-primary/30 hover:bg-card">
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
                </span>
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
        className="px-5 md:px-8"
        title="قد يعجبك أيضًا"
        description="أعمال قريبة في النبرة والموضوع والطاقم، رتبت لتسهيل الاستكشاف التالي."
      />
      <div className="scroll-fade-x flex gap-4 overflow-x-auto overflow-y-visible px-5 md:px-8 py-4 pb-5">
        {recommendations.map((recommendation) => (
          <div key={recommendation.work.id} className="relative w-36 shrink-0 sm:w-44 lg:w-48">
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

/** One `--chart-N` token per criterion, in the same fixed order as `scoreCriteria`. */
const criterionColor = {
  story: "var(--chart-1)",
  characters: "var(--chart-2)",
  depth: "var(--chart-3)",
  worldBuilding: "var(--chart-4)",
  originality: "var(--chart-5)",
  craft: "var(--chart-6)",
} satisfies Record<(typeof scoreCriteria)[number], string>;

function RadarScoreCard({ work }: { work: Work }) {
  const config = Object.fromEntries(
    scoreCriteria.map((criterion) => [
      criterion,
      { label: scoreLabel(criterion, work.kind).ar, color: criterionColor[criterion] },
    ]),
  ) satisfies ChartConfig;
  const data = scoreCriteria.map((criterion) => ({
    criterion,
    label: scoreLabel(criterion, work.kind).ar,
    value: work.scoreComponents[criterion] ?? 0,
    weight: Math.round(scoreWeights[criterion] * 100),
  }));

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>بصمة التقييم</CardTitle>
        <CardDescription>شكل توزّع الدرجات على المعايير الستّة قبل تطبيق أوزانها.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-center">
        <ChartContainer config={config} className="mx-auto aspect-square max-h-80 w-full">
          <RadarChart data={data}>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Radar
              dataKey="value"
              fill="var(--primary)"
              fillOpacity={0.35}
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--primary)" }}
            />
          </RadarChart>
        </ChartContainer>
        <dl className="flex flex-col gap-2.5">
          {data.map((item) => (
            <div key={item.criterion} className="flex items-center justify-between gap-3 text-sm">
              <dt className="flex min-w-0 items-center gap-2 truncate text-muted-foreground">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: criterionColor[item.criterion] }}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </dt>
              <dd className="font-mono font-semibold tabular-nums">{item.value.toFixed(1)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function InstallmentScoreTrendCard({
  work,
  data,
}: {
  work: Work;
  data: Array<
    Record<(typeof scoreCriteria)[number] | "label" | "fullLabel", string | number | null>
  >;
}) {
  const config = Object.fromEntries(
    scoreCriteria.map((criterion) => [
      criterion,
      { label: scoreLabel(criterion, work.kind).ar, color: criterionColor[criterion] },
    ]),
  ) satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>تطوّر كل معيار عبر الأجزاء</CardTitle>
        <CardDescription>درجة كل معيار في كل جزء على حدة، بترتيب صدورها.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="max-h-80 w-full">
          <LineChart data={data} margin={{ right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis domain={[4, 10]} tickLine={false} axisLine={false} width={28} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {scoreCriteria.map((criterion) => (
              <Line
                key={criterion}
                dataKey={criterion}
                type="monotone"
                stroke={criterionColor[criterion]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function ScoreSection({ work, structure }: { work: Work; structure: WorkStructure }) {
  const availableCriteria = scoreCriteria.filter(
    (criterion) => work.scoreComponents[criterion] !== undefined,
  );
  const trendData = structure.seasons
    .filter((season) => season.score && scoreCriteria.some((c) => season.score?.[c] != null))
    .toSorted((a, b) => a.position - b.position)
    .map((season, index) => ({
      label:
        season.installmentKind === "season"
          ? `م${season.seasonNumber ?? index + 1}`
          : `#${index + 1}`,
      fullLabel: season.title,
      story: season.score?.story ?? null,
      characters: season.score?.characters ?? null,
      depth: season.score?.depth ?? null,
      worldBuilding: season.score?.worldBuilding ?? null,
      originality: season.score?.originality ?? null,
      craft: season.score?.craft ?? null,
    }));

  return (
    <div className="flex flex-col gap-4">
      {trendData.length >= 2 ? <InstallmentScoreTrendCard work={work} data={trendData} /> : null}

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
          <RadarScoreCard work={work} />

          <Card>
            <CardHeader className="border-b">
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
    <div className="grid items-start gap-4 md:grid-cols-2">
      <DetailGroup
        title="الهوية والعناوين"
        description="العنوان الأصلي، البدائل، وبلدان الإنتاج."
        items={primaryDetails}
      />
      <div className="flex flex-col gap-4">
        {formatDetails.length > 0 && (
          <DetailGroup
            title="الحجم والصيغة"
            description="مدة العمل وحجمه وفق نوعه."
            items={formatDetails}
          />
        )}
        {releaseDetails.length > 0 && (
          <DetailGroup
            title="المصدر والنشر"
            description="أصل المادة وبيانات النشر الممتدة."
            items={releaseDetails}
          />
        )}
      </div>
      {hasTaxonomy && (
        <Card className="md:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>التصنيف والموضوعات</CardTitle>
            <CardDescription>المفردات التي تصف النوع والنبرة والموضوع.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-8 md:grid-cols-2">
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
                className="md:col-span-2"
                title="الوسوم"
                values={work.tags.map((value) => taxonomyLabel("tag", value))}
              />
            )}
          </CardContent>
        </Card>
      )}
      {work.awards.length > 0 ? (
        <AwardsSection awards={work.awards} className="md:col-span-2" />
      ) : null}
    </div>
  );
}

function TaxonomyBadges({
  title,
  values,
  className,
}: {
  title: string;
  values: string[];
  className?: string;
}) {
  return (
    <div className={className}>
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
  description,
  items,
  className,
}: {
  title: string;
  description: string;
  items: Array<readonly [string, string]>;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col">
          {items.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[7rem_1fr] gap-3 border-b py-3 first:pt-0 last:border-0 last:pb-0"
            >
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="min-w-0 text-sm leading-6">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
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
    ...(work.curation?.reviewedAt ? [["آخر تحقق", work.curation.reviewedAt] as const] : []),
  ] as const;
  return (
    <Card size="sm" className="border-border/40 bg-card/45 py-0! gap-2!">
      <CardHeader className="border-b border-border/40 bg-card pt-4!">
        <CardTitle>بطاقة السجل</CardTitle>
        <CardDescription className="text-xs">أهم بيانات الكتالوج في لمحة واحدة.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col overflow-y-scroll! pb-4! pt-0!">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[5rem_1fr] gap-3 border-b border-border/30 py-3 last:border-0 last:pb-0"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="min-w-0 truncate text-sm">{value}</dd>
          </div>
        ))}
        {work.externalLinks.length > 0 ? (
          <div className="pt-2">
            <p className="text-xs font-medium text-muted-foreground pb-2">روابط مرجعية</p>
            <div className="flex flex-wrap gap-1">
              {work.externalLinks.map((link) => (
                <Button
                  key={`${link.provider}:${link.url}`}
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={link.url} target="_blank" rel="noreferrer" />}
                  className="justify-between"
                >
                  <span className="truncate">{link.provider}</span>
                  <ArrowSquareOutIcon data-icon="inline-end" />
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RiskBadge({ level }: { level: RiskAssessment["level"] }) {
  return (
    <Badge
      variant={level === "high" ? "destructive" : level === "medium" ? "destructive" : "secondary"}
      className={level === "medium" ? "bg-yellow-600/40! text-yellow-500!" : ""}
    >
      {riskLabels[level]}
    </Badge>
  );
}

function ParentGuideCard({ risks }: { risks: RiskAssessment[] }) {
  const highRiskCount = risks.filter((risk) => risk.level === "high").length;

  return (
    <Card size="sm" className="border-border/40 bg-card/45 py-0! gap-2! relative">
      <CardHeader className="border-b border-border/40 bg-card pt-4!">
        <CardTitle>دليل الوالدين</CardTitle>
        <CardDescription className="text-xs">
          نظرة سريعة على الموضوعات الحساسة قبل المشاهدة.
        </CardDescription>
        <div className="mt-2 flex items-center gap-2 absolute left-2 top-1">
          <Badge
            className="text-xs px-1! rounded-sm!"
            variant={highRiskCount ? "destructive" : "secondary"}
          >
            {highRiskCount ? `${highRiskCount} تنبيه مرتفع` : "لا توجد تنبيهات مرتفعة"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col overflow-y-scroll! pb-2! pt-0! px-2!">
        {risks.length ? (
          risks.map((risk) => {
            return (
              <div
                key={risk.dimensionId}
                className={cn(
                  "flex w-full items-center justify-between gap-3 pe-2 ps-3 py-2 text-start rounded-2xl",
                  risk.level === "high"
                    ? "hover:bg-destructive/15"
                    : risk.level === "medium"
                      ? "hover:bg-yellow-500/25"
                      : " hover:bg-accent/75",
                )}
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
