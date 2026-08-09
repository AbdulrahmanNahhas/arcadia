import {
  ArrowRightIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  CheckCircleIcon,
  ClockIcon,
  FilmSlateIcon,
  HeartIcon,
  InfoIcon,
  ShieldCheckIcon,
  StarIcon,
  TelevisionIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { Work, WorkStructure } from "@/features/library/model";
import { useArabicTranslations } from "@/features/library/translations";
import type { Recommendation, RiskAssessment } from "@/features/platform/model";
import { cn } from "@/lib/utils";
import { getEntities } from "@/server/library.functions";
import { getPlatformWorkDetail } from "@/server/platform.functions";
import { EntityDialog } from "./components/entity-dialog";
import { PlatformShell } from "./components/platform-shell";
import { WorkCard } from "./components/work-card";

export function WorkDetailPage({ workId }: { workId: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ["platform-work", workId],
    queryFn: () => getPlatformWorkDetail({ data: { workId } }),
  });
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  const { taxonomyLabel } = useArabicTranslations();
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

  return (
    <PlatformShell immersive>
      <WorkHero work={work} planet={planet?.planet ?? null} risks={risks} />
      <div className="mx-auto grid max-w-400 gap-12 px-5 pb-28 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
        <div className="min-w-0 space-y-14">
          <section aria-labelledby="story-title">
            <SectionEyebrow>عن العمل</SectionEyebrow>
            <h2 id="story-title" className="mt-2 font-heading text-2xl font-semibold">
              الحكاية، دون جدار من الحقول
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-9 text-foreground/76">
              {work.summary || "لم يُضف ملخص تحريري بعد."}
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {[
                ...work.genres.map((term) => ({
                  key: `genre:${term}`,
                  label: taxonomyLabel("genre", term),
                })),
                ...work.tags.slice(0, 8).map((term) => ({
                  key: `tag:${term}`,
                  label: taxonomyLabel("tag", term),
                })),
                ...work.tone.map((term) => ({
                  key: `tone:${term}`,
                  label: taxonomyLabel("tone", term),
                })),
              ].map(({ key, label }) => (
                <Badge key={key} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          </section>

          {(people.length > 0 || studios.length > 0) && (
            <section aria-labelledby="credits-title">
              <SectionHeading
                id="credits-title"
                title="صُنّاع وعلاقات مختارة"
                description="لا تعرض نحّاسينما كل طاقم العمل؛ هذه كيانات منتقاة ومرتبطة بأدوار مطبّعة."
              />
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[...people, ...studios].map(({ entity, credit }) => (
                  <EntityDialog key={`${entity.id}:${credit.role}`} entity={entity}>
                    <span className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-card/45 p-3 transition hover:bg-card">
                      <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {entity.imagePath ? (
                          <img src={entity.imagePath} alt="" className="size-full object-cover" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <strong className="block truncate text-sm font-medium">
                          {entity.name}
                        </strong>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {roleLabels[credit.role] ?? credit.role}
                        </span>
                      </span>
                    </span>
                  </EntityDialog>
                ))}
              </div>
            </section>
          )}

          {work.relations.length > 0 && (
            <section aria-labelledby="relations-title">
              <SectionHeading
                id="relations-title"
                title="مكانه في السلسلة"
                description="العلاقات التالية تأتي من السجل الفعلي، وبنوعها واتجاهها المحفوظين."
              />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {work.relations.map((relation) => (
                  <Link
                    key={relation.id}
                    to="/works/$workId"
                    params={{ workId: relation.workId }}
                    className="group grid grid-cols-[4.5rem_1fr_auto] items-center gap-4 rounded-xl border border-white/8 bg-card/45 p-3 transition hover:bg-card"
                  >
                    <div className="aspect-2/3 overflow-hidden rounded-lg bg-muted">
                      {relation.work.imagePath && (
                        <img
                          src={relation.work.imagePath}
                          alt=""
                          className="size-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Badge variant="outline" className="mb-2">
                        {relationLabels[relation.relationType] ?? relation.relationType}
                      </Badge>
                      <h3 className="truncate font-heading text-sm font-medium">
                        {relation.work.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {relation.direction === "outgoing"
                          ? "ينطلق من هذا العمل"
                          : "يصل إلى هذا العمل"}
                      </p>
                    </div>
                    <ArrowRightIcon className="rotate-180 text-muted-foreground transition group-hover:-translate-x-1" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {(["series", "anime"] as Work["kind"][]).includes(work.kind) && (
            <EpisodesSection structure={structure} />
          )}

          <SimilarWorks recommendations={recommendations} />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <MetadataPanel work={work} planetName={planet?.planet.nameAr ?? "غير معيّن"} />
          <div className="rounded-xl border border-white/8 bg-card/45 p-5">
            <h2 className="font-heading text-sm font-semibold">حالتك المحلية</h2>
            <p className="mt-3 text-2xl font-semibold">{statusLabels[work.status]}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>{work.progressUnit}</span>
              <span>
                {work.progress}
                {work.progressTotal ? ` / ${work.progressTotal}` : ""}
              </span>
            </div>
            {work.progressTotal ? (
              <Progress value={(work.progress / work.progressTotal) * 100} className="mt-2" />
            ) : null}
            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              هذه حالة المتعقّب المحلي. لا توجد مزامنة تشغيل أو Jellyfin في الإصدار 1.0.
            </p>
          </div>
        </aside>
      </div>
    </PlatformShell>
  );
}

function WorkHero({
  work,
  planet,
  risks,
}: {
  work: Work;
  planet: { slug: string; icon: string; nameAr: string; primaryColor: string } | null;
  risks: RiskAssessment[];
}) {
  return (
    <section className="relative isolate min-h-[72svh] overflow-hidden border-b border-white/8">
      {work.bannerPath || work.imagePath ? (
        <img
          src={work.bannerPath || work.imagePath || undefined}
          alt=""
          className="absolute inset-0 -z-20 size-full object-cover"
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-linear-to-l from-background via-background/85 to-background/25" />
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-background via-transparent to-black/30" />
      <div className="mx-auto flex min-h-[72svh] max-w-400 items-end px-5 pb-14 pt-32 sm:px-8 lg:items-center lg:pb-8">
        <div className="max-w-3xl">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRightIcon /> الرئيسية
          </Link>
          {planet && (
            <Link
              to="/planets/$planetSlug"
              params={{ planetSlug: planet.slug }}
              className="mb-4 flex w-fit items-center gap-2 text-sm font-medium"
              style={{ color: planet.primaryColor }}
            >
              <span>{planet.icon}</span>
              {planet.nameAr}
            </Link>
          )}
          <h1 className="text-balance font-heading text-4xl leading-[1.15] font-semibold sm:text-6xl">
            {work.arabicTitle || work.title}
          </h1>
          {work.arabicTitle && (
            <p className="mt-3 font-mono text-lg text-muted-foreground" dir="ltr">
              {work.title}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground/78">
            <span>{work.year ?? "—"}</span>
            <span>{kindLabels[work.kind]}</span>
            {work.runtimeMinutes && (
              <span className="flex items-center gap-1">
                <ClockIcon /> {work.runtimeMinutes} دقيقة
              </span>
            )}
            {work.calculatedRating !== null && (
              <span className="flex items-center gap-1">
                <StarIcon weight="fill" className="text-amber-300" />{" "}
                {work.calculatedRating.toFixed(1)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <CheckCircleIcon className="text-primary" /> {releaseLabels[work.releaseStatus]}
            </span>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <ParentGuideDialog risks={risks} work={work} />
            <span
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "cursor-default bg-white/10",
              )}
            >
              <HeartIcon weight={work.favorite ? "fill" : "regular"} /> {statusLabels[work.status]}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

const RISK_STYLES: Record<string, { badge: string; accent: string }> = {
  high: {
    badge: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
    accent: "border-s-red-500/70",
  },
  medium: {
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    accent: "border-s-amber-500/70",
  },
  low: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    accent: "border-s-emerald-500/70",
  },
};

function RiskBadge({ level }: { level: RiskAssessment["level"] }) {
  const style = RISK_STYLES[level] ?? RISK_STYLES.low;
  return (
    <Badge variant="outline" className={`gap-1 font-normal ${style.badge}`}>
      {level === "high" ? (
        <WarningCircleIcon weight="fill" className="size-3" />
      ) : (
        <ShieldCheckIcon weight="fill" className="size-3" />
      )}
      {riskLabels[level]}
    </Badge>
  );
}

function ParentGuideDialog({ risks, work }: { risks: RiskAssessment[]; work: Work }) {
  const [openId, setOpenId] = useState<string | null>(risks[0]?.dimensionId ?? null);
  const notes = [work.contentWarnings, work.analysisNotes].filter(Boolean).join("\n\n");

  return (
    <Dialog>
      <DialogTrigger render={<Button size="lg" className="gap-2" />}>
        <ShieldCheckIcon className="size-4" />
        دليل المحتوى
      </DialogTrigger>

      <DialogContent className="platform-surface max-h-[90svh] overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="font-heading text-xl">دليل المحتوى والتحليل</DialogTitle>
          <DialogDescription>
            قراءة منظّمة للمخاطر المحفوظة في قاعدة البيانات، وليست تصنيفاً عمرياً خارجياً.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 p-6 pt-0">
          {risks.length ? (
            risks.map((risk) => {
              const isOpen = openId === risk.dimensionId;
              const style = RISK_STYLES[risk.level] ?? RISK_STYLES.low;
              return (
                <div
                  key={risk.dimensionId}
                  className={`overflow-hidden rounded-lg border border-s-2 ${style.accent}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : risk.dimensionId)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
                  >
                    <div>
                      <h3 className="text-sm font-medium">{risk.nameAr}</h3>
                      {risk.nameEn && (
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground" dir="ltr">
                          {risk.nameEn}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={risk.level} />
                      <CaretDownIcon
                        className={`size-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>
                  <div
                    className="grid transition-all duration-200"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <p className="overflow-hidden px-4 pb-3.5 text-sm leading-7 text-muted-foreground">
                      {risk.explanation || risk.notes || risk.description}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              لا توجد تقييمات مخاطر منظّمة لهذا العمل.
            </p>
          )}

          {notes && (
            <div className="mt-4 rounded-lg border-s-2 border-s-primary bg-primary/5 px-4 py-3.5">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-primary">
                <InfoIcon weight="fill" className="size-3.5" /> ملاحظات التحليل
              </h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {notes}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EpisodesSection({ structure }: { structure: WorkStructure }) {
  const seasons = structure.seasons;
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "preview");
  const selected = seasons.find((season) => season.id === seasonId);
  const episodes = selected?.units.length ? selected.units : mockEpisodes;
  return (
    <section aria-labelledby="episodes-title">
      <SectionHeading
        id="episodes-title"
        title="المواسم والحلقات"
        description={
          seasons.length
            ? "بنية حلقات محفوظة في الكتالوج."
            : "معاينة واجهة الإصدار 2.0؛ بيانات الحلقات التالية نموذجية وليست سجلاً فعلياً."
        }
      />
      <div className="mt-6 rounded-2xl border border-white/8 bg-card/40 p-4 sm:p-6">
        {!seasons.length && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <InfoIcon className="shrink-0 text-primary" /> حالة نموذجية فقط — لا يوجد تشغيل أو تقدم
            حلقات متزامن.
          </div>
        )}
        <Tabs value={seasonId} onValueChange={setSeasonId}>
          <TabsList>
            {seasons.length ? (
              seasons.map((season) => (
                <TabsTrigger key={season.id} value={season.id}>
                  {season.title}
                </TabsTrigger>
              ))
            ) : (
              <TabsTrigger value="preview">الموسم 1 · نموذج</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value={seasonId} className="mt-5 space-y-3">
            {episodes.slice(0, 6).map((episode, index) => (
              <article
                key={"id" in episode ? episode.id : index}
                className="grid gap-4 rounded-xl border border-white/7 bg-background/30 p-3 sm:grid-cols-[9rem_1fr_auto] sm:items-center"
              >
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <TelevisionIcon size={28} />
                  </div>
                  <span className="absolute bottom-2 inset-e-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
                    {("runtimeMinutes" in episode && episode.runtimeMinutes) || 24} د
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    الحلقة {("unitNumber" in episode && episode.unitNumber) || index + 1}
                  </p>
                  <h3 className="mt-1 font-heading text-sm font-semibold">
                    {("title" in episode && episode.title) || mockEpisodes[index]?.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">
                    {!seasons.length
                      ? mockEpisodes[index]?.description
                      : "أضف وصف الحلقة من إدارة البنية عند توفره."}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {"progress" in episode && episode.progress ? (
                    <>
                      <CheckCircleIcon className="text-primary" /> شوهدت
                    </>
                  ) : (
                    "غير مشاهد"
                  )}
                </span>
              </article>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

function SimilarWorks({ recommendations }: { recommendations: Recommendation[] }) {
  if (!recommendations.length) return null;
  return (
    <section aria-labelledby="similar-title">
      <SectionHeading
        id="similar-title"
        title="المزيد مثل هذا"
        description="تشابه حتمي متعدد الإشارات؛ لا يكفي اشتراك نوع عام واحد لإظهار العمل."
      />
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {recommendations.map((recommendation) => (
          <div key={recommendation.work.id} className="relative">
            <WorkCard work={recommendation.work} />
            <Popover>
              <PopoverTrigger
                className="absolute bottom-0 left-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Recommendation details"
              >
                <InfoIcon className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" side="top">
                <div className="font-medium text-foreground text-lg">
                  التطابق {recommendation.score}%
                </div>

                {recommendation.reasons && recommendation.reasons.length > 0 && (
                  <div className="mt-0 space-y-1">
                    {recommendation.reasons
                      .filter((reason) => Boolean(reason?.label))
                      .map((reason, index) => (
                        <p
                          key={`${index.toString()}-${reason.label}`}
                          className="line-clamp-2 text-[11px] leading-5 text-base! text-muted-foreground"
                        >
                          - {reason.label}
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

function MetadataPanel({ work, planetName }: { work: Work; planetName: string }) {
  const rows = [
    ["النوع", kindLabels[work.kind], <FilmSlateIcon key="kind" />],
    ["الإصدار", work.releaseStart || String(work.year ?? "—"), <CalendarBlankIcon key="date" />],
    ["الحالة", releaseLabels[work.releaseStatus], <CheckCircleIcon key="state" />],
    ["الكوكب", planetName, <span key="planet">◉</span>],
    ["الجمهور", work.audience || "غير محدد", <InfoIcon key="audience" />],
  ] as const;
  return (
    <div className="rounded-xl border border-white/8 bg-card/45 p-5">
      <h2 className="mb-4 font-heading text-sm font-semibold">بطاقة السجل</h2>
      <dl>
        {rows.map(([label, value, icon]) => (
          <div
            key={label}
            className="flex items-start gap-3 border-t border-white/7 py-3 first:border-0"
          >
            <dt className="mt-0.5 text-muted-foreground">{icon}</dt>
            <div className="min-w-0">
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 truncate text-sm">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SectionEyebrow({ children }: { children: string }) {
  return <p className="text-xs font-semibold tracking-[0.16em] text-primary">{children}</p>;
}
function SectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <header>
      <SectionEyebrow>من سجل نحّاسينما</SectionEyebrow>
      <h2 id={id} className="mt-2 font-heading text-2xl font-semibold">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p>
    </header>
  );
}

const mockEpisodes = [
  {
    title: "مدخل إلى العالم",
    description: "صورة مصغّرة ووصف وتاريخ إصدار ستأتي من مصدر الحلقة المستقبلي.",
  },
  {
    title: "الخيط الأول",
    description: "مساحة تقدم قابلة للربط لاحقاً بمعرّف خارجي دون تغيير هوية العمل.",
  },
  { title: "نقطة التحول", description: "حالة مشاهدة نموذجية مع مكان واضح للمدة وتاريخ العرض." },
];
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
const statusLabels: Record<Work["status"], string> = {
  saved: "محفوظ",
  planned: "في الخطة",
  "in-progress": "قيد المتابعة",
  completed: "مكتمل",
  paused: "متوقف مؤقتاً",
  dropped: "متروك",
};
const releaseLabels: Record<Work["releaseStatus"], string> = {
  announced: "معلن",
  releasing: "يعرض الآن",
  released: "صدر",
  ended: "منتهٍ",
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
  author: "مؤلف",
  "original-author": "المؤلف الأصلي",
  writer: "كاتب",
  screenwriter: "سيناريو",
  director: "مخرج",
  illustrator: "رسام",
  artist: "فنان",
  "animation-studio": "استوديو التحريك",
  "production-company": "شركة إنتاج",
  producer: "منتج",
  developer: "مطوّر",
  publisher: "ناشر",
  composer: "مؤلف موسيقي",
  editor: "محرر",
  translator: "مترجم",
  creator: "مبتكر",
};
