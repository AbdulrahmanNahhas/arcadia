import type { TitleDetail } from "@arcadia/contracts";
import {
  ArrowRightIcon,
  FilmSlateIcon,
  PlayIcon,
  StarIcon,
  WifiSlashIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { taxonomyArabicLabel, taxonomyLabels, type WorkStructure } from "@/features/library/model";
import { kindLabelsAr, valueLabelsAr } from "@/features/library/translations";
import { cn } from "@/lib/utils";
import { detailToStructure, titleToWork } from "@/server/compat";
import { getOfflineTitle } from "./offline-store";

const riskDimensionLabels = {
  sexuality: "المحتوى الجنسي",
  behavioral: "السلوك والعنف",
  theology: "الموضوعات العقدية",
} as const;

const scoreEntries = [
  ["story", "القصة"],
  ["characters", "الشخصيات"],
  ["depth", "العمق"],
  ["worldBuilding", "بناء العالم"],
  ["originality", "الأصالة"],
  ["craft", "الحِرفة"],
] as const;

const roleLabels = new Map([
  ["creator", "مبتكر"],
  ["original_author", "المؤلف الأصلي"],
  ["director", "مخرج"],
  ["writer", "كاتب"],
  ["producer", "منتج"],
  ["executive_producer", "منتج تنفيذي"],
  ["creative_producer", "منتج إبداعي"],
  ["character_designer", "مصمم الشخصيات"],
  ["art_director", "مدير فني"],
  ["scene_design", "تصميم المشاهد"],
  ["composer", "ملحن"],
  ["animation_studio", "استوديو الرسوم"],
  ["production_company", "شركة إنتاج"],
  ["distributor", "موزع"],
  ["publisher", "ناشر"],
]);

function riskSurfaceClass(level: "none" | "low" | "medium" | "high" | "unknown") {
  if (level === "high") return "border-destructive/30 bg-destructive/10";
  if (level === "medium") return "border-classification-caution/30 bg-classification-caution/10";
  if (level === "low") return "border-primary/20 bg-primary/5";
  return "border-border/50 bg-background/25";
}

/**
 * Detail view for one title saved offline (`/offline/$titleId`), reached only from
 * `OfflineLibraryPage`. Metadata, artwork and stable torrent candidates come from IndexedDB; the
 * desktop player can therefore stream through peers without Arcadia's family server being online.
 */
export function OfflineTitlePage({ titleId }: { titleId: string }) {
  // Keyed by the `titleId` it was loaded for, so a direct navigation between two saved titles
  // (no full remount) still reads as "loading" for the new id during render — rather than a
  // synchronous setState resetting it at the top of the effect below.
  const [loaded, setLoaded] = useState<{ titleId: string; detail: TitleDetail | null } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await getOfflineTitle(titleId);
      if (!cancelled) setLoaded({ titleId, detail: result });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [titleId]);

  if (loaded?.titleId !== titleId) {
    return (
      <main className="platform-surface min-h-svh px-5 py-8 sm:px-8 lg:px-10">
        <p className="py-16 text-center text-sm text-muted-foreground" aria-live="polite">
          جارٍ فتح النسخة المحفوظة…
        </p>
      </main>
    );
  }

  const detail = loaded.detail;
  if (!detail) {
    return (
      <main className="platform-surface min-h-svh px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-2xl">
          <Empty className="rounded-3xl border bg-card/60">
            <EmptyHeader>
              <EmptyTitle>هذا العمل غير محفوظ على هذا الجهاز</EmptyTitle>
              <EmptyDescription>
                لم يعد هذا العنوان ضمن المحفوظات دون اتصال، أو أُزيل من هذا الجهاز.
              </EmptyDescription>
            </EmptyHeader>
            <Link to="/offline" className="text-sm font-medium text-primary hover:underline">
              العودة إلى المحفوظات
            </Link>
          </Empty>
        </div>
      </main>
    );
  }

  const work = titleToWork(detail);
  const structure = detailToStructure(detail);
  const displayTitle = work.arabicTitle || work.title;
  const firstTarget = firstPlaybackTarget(detail);

  return (
    <main className="platform-surface min-h-svh pb-16">
      <div className="relative">
        {work.bannerPath ? (
          <div className="relative h-[38vh] min-h-64 w-full overflow-hidden">
            <img src={work.bannerPath} alt="" className="size-full object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />
          </div>
        ) : (
          <div className="h-24" />
        )}
      </div>

      <div className="mx-auto -mt-10 max-w-4xl px-5 sm:px-8 lg:px-10">
        <Link
          to="/offline"
          className="mb-4 inline-flex h-9 items-center gap-2 rounded-full border border-border/60 bg-card/70 px-4 text-sm font-medium backdrop-blur transition-colors hover:bg-accent"
        >
          <ArrowRightIcon size={15} />
          المحفوظات دون اتصال
        </Link>

        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="w-32 shrink-0 overflow-hidden rounded-2xl bg-muted shadow-lg ring-1 ring-foreground/10 sm:w-44">
            {work.imagePath ? (
              <img src={work.imagePath} alt="" className="aspect-2/3 size-full object-cover" />
            ) : (
              <div className="flex aspect-2/3 items-end bg-linear-to-br from-primary/25 via-muted to-muted p-3">
                <span className="font-heading text-sm">{displayTitle}</span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-500">
              <WifiSlashIcon size={14} weight="fill" />
              غير متصل — من المحفوظات
            </div>

            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {displayTitle}
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              {work.year ?? "—"} · {kindLabelsAr[work.kind]}
              {work.creator ? ` · ${work.creator}` : ""}
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {work.audience && (
                <Badge variant="outline">{taxonomyLabels.audiences[work.audience]}</Badge>
              )}
              {work.age && <Badge variant="outline">{taxonomyLabels.ages[work.age]}</Badge>}
              {work.genres.map((genre) => (
                <Badge key={genre} variant="secondary">
                  {taxonomyArabicLabel("genres", genre)}
                </Badge>
              ))}
            </div>

            {work.summary && (
              <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground">
                {work.summary}
              </p>
            )}

            {firstTarget && (
              <OfflinePlayLink
                installmentId={firstTarget.installmentId}
                episodeId={firstTarget.episodeId}
                titleId={detail.id}
                className="mt-5"
              >
                <PlayIcon weight="fill" />
                مشاهدة الآن
              </OfflinePlayLink>
            )}
          </div>
        </div>

        <InfoSection
          title="دليل الوالدين"
          description="التقييمات العائلية المحفوظة مع العمل، حتى تبقى متاحة دون اتصال."
          className="mt-8"
        >
          {work.riskProfile ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {(["sexuality", "behavioral", "theology"] as const).map((dimension) => {
                const level = work.riskProfile?.[dimension] ?? "unknown";
                return (
                  <div
                    key={dimension}
                    className={cn("rounded-xl border p-4", riskSurfaceClass(level))}
                  >
                    <p className="text-xs text-muted-foreground">
                      {riskDimensionLabels[dimension]}
                    </p>
                    <p className="mt-2 font-heading text-lg font-semibold">
                      {valueLabelsAr.get(level) ?? "غير معروف"}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">لم تُسجل تقييمات عائلية لهذا العمل.</p>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {work.contentWarnings && (
              <div className="rounded-xl border border-classification-caution/30 bg-classification-caution/10 p-4">
                <h3 className="text-sm font-semibold">تنبيه المحتوى</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {work.contentWarnings}
                </p>
              </div>
            )}
            {work.analysisNotes && (
              <div className="rounded-xl border border-border/60 bg-background/30 p-4">
                <h3 className="text-sm font-semibold">ملاحظات التحليل العقدي</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{work.analysisNotes}</p>
              </div>
            )}
          </div>
        </InfoSection>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <InfoSection
            title="التصنيف والموضوعات"
            description="النوع والطابع والموضوعات المسجلة في الأرشيف."
          >
            <TaxonomyGroup
              title="الأنواع"
              values={work.genres.map((value) => taxonomyArabicLabel("genres", value))}
            />
            <TaxonomyGroup
              title="الطابع"
              values={work.tone.map((value) => taxonomyArabicLabel("tones", value))}
            />
            <TaxonomyGroup
              title="الوسوم"
              values={work.tags.map((value) => taxonomyArabicLabel("tags", value))}
            />
          </InfoSection>

          <InfoSection title="حقائق العمل" description="الهوية والحجم والإنتاج في نظرة سريعة.">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {work.calculatedRating !== null && (
                <>
                  <dt className="text-muted-foreground">التقييم</dt>
                  <dd className="flex items-center gap-1 font-medium">
                    <StarIcon className="text-amber-500" weight="fill" />
                    {work.calculatedRating.toFixed(1)}
                  </dd>
                </>
              )}
              {work.country.length > 0 && (
                <>
                  <dt className="text-muted-foreground">البلد</dt>
                  <dd>
                    {work.country
                      .map((country) => taxonomyLabels.countries[country] ?? country)
                      .join("، ")}
                  </dd>
                </>
              )}
              {work.runtimeMinutes && (
                <>
                  <dt className="text-muted-foreground">المدة</dt>
                  <dd>{work.runtimeMinutes} دقيقة</dd>
                </>
              )}
              {structure.seasons.length > 0 && (
                <>
                  <dt className="text-muted-foreground">الأجزاء والمواسم</dt>
                  <dd>{structure.seasons.length}</dd>
                </>
              )}
              {structure.totalUnits > 0 && (
                <>
                  <dt className="text-muted-foreground">الحلقات</dt>
                  <dd>{structure.totalUnits}</dd>
                </>
              )}
              {detail.planet && (
                <>
                  <dt className="text-muted-foreground">الكوكب</dt>
                  <dd>
                    {detail.planet.icon} {detail.planet.nameAr}
                  </dd>
                </>
              )}
              {work.studios.length > 0 && (
                <>
                  <dt className="text-muted-foreground">الاستوديو</dt>
                  <dd>{work.studios.join("، ")}</dd>
                </>
              )}
              {work.aliases.length > 0 && (
                <>
                  <dt className="text-muted-foreground">أسماء أخرى</dt>
                  <dd>{work.aliases.join("، ")}</dd>
                </>
              )}
            </dl>
          </InfoSection>
        </div>

        {Object.keys(work.scoreComponents).length > 0 && (
          <InfoSection
            title="بصمة التقييم"
            description="تفصيل الدرجة التحريرية بحسب عناصر التقييم الستة."
            className="mt-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {scoreEntries.map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-background/25 px-4 py-3"
                >
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {work.scoreComponents[key]?.toFixed(1) ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </InfoSection>
        )}

        {detail.credits.length > 0 && (
          <InfoSection
            title="صُنّاع العمل"
            description="الأشخاص والاستوديوهات المرتبطة بهذا العنوان."
            className="mt-4"
          >
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {detail.credits.map((credit) => (
                <div
                  key={`${credit.id}:${credit.role}`}
                  className="rounded-xl border border-border/50 bg-background/25 px-3 py-2"
                >
                  <p className="text-sm font-medium">{credit.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {roleLabels.get(credit.role) ?? credit.role}
                  </p>
                </div>
              ))}
            </div>
          </InfoSection>
        )}

        {detail.awards.length > 0 && (
          <InfoSection title="الجوائز والترشيحات" className="mt-4">
            <ul className="space-y-2">
              {detail.awards.map((award) => (
                <li
                  key={award.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-4 py-3 text-sm"
                >
                  <span>
                    {award.organizationName} · {award.category}
                  </span>
                  <Badge variant={award.result === "winner" ? "default" : "secondary"}>
                    {award.result === "winner" ? "فوز" : "ترشيح"}
                    {award.year ? ` · ${award.year}` : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          </InfoSection>
        )}

        <StructureList detail={detail} structure={structure} />
      </div>
    </main>
  );
}

function firstPlaybackTarget(detail: TitleDetail) {
  for (const installment of detail.installments) {
    if (!installment.isPlayable) continue;
    if (installment.kind !== "season") {
      return { installmentId: installment.id, episodeId: null };
    }
    const episode = installment.episodes?.[0];
    if (episode) return { installmentId: installment.id, episodeId: episode.id };
  }
  return null;
}

function OfflinePlayLink({
  installmentId,
  episodeId,
  titleId,
  className,
  children,
}: {
  installmentId: string;
  episodeId: string | null;
  titleId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to="/player/$installmentId"
      params={{ installmentId }}
      search={{
        titleId,
        episodeId,
        origin: `/offline/${titleId}`,
      }}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function InfoSection({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-border/60 bg-card/40 p-5", className)}>
      <h2 className="mb-3 font-heading text-base font-semibold">{title}</h2>
      {description && (
        <p className="-mt-1 mb-4 text-xs leading-5 text-muted-foreground">{description}</p>
      )}
      {children}
    </section>
  );
}

function TaxonomyGroup({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Badge key={value} variant="secondary">
            {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function StructureList({ detail, structure }: { detail: TitleDetail; structure: WorkStructure }) {
  if (structure.seasons.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold">
        <FilmSlateIcon size={18} />
        محتويات العمل
      </h2>

      <p className="mb-4 text-xs leading-5 text-muted-foreground">
        يشغّل تطبيق سطح المكتب مصادر التورنت المحفوظة مباشرة. يلزم اتصال بالإنترنت للأقران، ولا يلزم
        اتصال بخادم Arcadia.
      </p>

      <div className="flex flex-col gap-2">
        {structure.seasons.map((season) => {
          const installment = detail.installments.find((item) => item.id === season.id);
          return (
            <div
              key={season.id}
              className="rounded-xl border border-border/60 bg-card/40 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{season.title}</span>
                <div className="flex shrink-0 items-center gap-3">
                  {season.unitCount ? (
                    <span className="text-xs text-muted-foreground">{season.unitCount} حلقة</span>
                  ) : null}
                  {installment?.isPlayable && season.units.length === 0 && (
                    <OfflinePlayLink installmentId={season.id} episodeId={null} titleId={detail.id}>
                      <PlayIcon weight="fill" />
                      تشغيل
                    </OfflinePlayLink>
                  )}
                </div>
              </div>

              {season.units.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 border-t border-border/40 pt-2">
                  {season.units.map((unit, index) => (
                    <li
                      key={unit.id}
                      className="flex min-h-10 items-center justify-between gap-3 text-xs text-muted-foreground"
                    >
                      <span className="truncate">
                        {unit.title || `الحلقة ${unit.unitNumber ?? index + 1}`}
                      </span>
                      <div className="flex shrink-0 items-center gap-3">
                        {unit.runtimeMinutes ? <span>{unit.runtimeMinutes} د</span> : null}
                        {installment?.isPlayable && (
                          <OfflinePlayLink
                            installmentId={season.id}
                            episodeId={unit.id}
                            titleId={detail.id}
                          >
                            <PlayIcon weight="fill" />
                            تشغيل
                          </OfflinePlayLink>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
