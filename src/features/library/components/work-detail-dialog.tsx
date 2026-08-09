import {
  ArrowSquareOutIcon,
  ArrowsInIcon,
  ArrowsOutIcon,
  CaretDownIcon,
  CheckIcon,
  CopyIcon,
  HeartIcon,
  MarkdownLogoIcon,
  StackIcon,
  TelegramLogoIcon,
  WhatsappLogoIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode, UIEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { activityAmount, isMovieStatusEvent, seasonCapacity } from "@/features/library/tracking";
import { cn } from "@/lib/utils";
import { getWorkStructure, getWorkTrackingEntries } from "@/server/library.functions";

import type { TrackingEntry, Work, WorkStructure } from "../model";
import { scoreCriteria, scoreLabel } from "../scoring";
import { useArabicTranslations } from "../translations";
import { statusLabel, TrackingForm } from "./tracking-form";
import { WorkArtwork } from "./work-artwork";

type WorkDetailDialogProps = {
  work: Work | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toggleFavorite: (work: Work) => void;
  favoritePending: boolean;
  openRelated: (id: string) => void;
  comparisonIds: string[];
  toggleComparison: (workId: string) => void;
};

export function WorkDetailDialog({
  work,
  open,
  onOpenChange,
  toggleFavorite,
  favoritePending,
  openRelated,
  comparisonIds,
  toggleComparison,
}: WorkDetailDialogProps) {
  const [fullScreen, setFullScreen] = useState(false);
  const [hasScrolledPastHero, setHasScrolledPastHero] = useState(false);
  const { taxonomyLabel } = useArabicTranslations();

  const structureQuery = useQuery({
    queryKey: ["work-structure", work?.id],
    queryFn: () => {
      if (!work) throw new Error("A work is required to load its structure.");
      return getWorkStructure({ data: { workId: work.id } });
    },
    enabled: open && Boolean(work),
  });

  const activityQuery = useQuery({
    queryKey: ["work-tracking", work?.id],
    queryFn: () => {
      if (!work) throw new Error("A work is required to load its activity.");
      return getWorkTrackingEntries({
        data: {
          workId: work.id,
          limit: 1_000,
        },
      });
    },
    enabled: open && Boolean(work),
  });

  useEffect(() => {
    if (!open) {
      setFullScreen(false);
      setHasScrolledPastHero(false);
    }
  }, [open]);

  if (!work) return null;

  const structure = structureQuery.data;

  const releaseSpan =
    work.releaseStart && work.releaseEnd && work.releaseStart !== work.releaseEnd
      ? `${formatDateString(work.releaseStart)} — ${formatDateString(work.releaseEnd)}`
      : formatDateString(work.releaseStart ?? work.releaseEnd);

  const hasContributors = work.contributors.length > 0;
  const hasSummary = Boolean(work.summary?.trim());

  const hasClassification = work.genres.length > 0 || work.tags.length > 0 || work.tone.length > 0;

  const hasPublication = Boolean(
    work.publication?.format ||
      work.publication?.publisher ||
      work.publication?.imprint ||
      work.publication?.serialization.length ||
      work.sourceMaterial,
  );

  const hasContentDossier = Boolean(work.contentWarnings || work.analysisNotes || work.riskProfile);

  const hasActivity = Boolean(activityQuery.data?.length);
  const hasRelations = work.relations.length > 0;
  const hasExternalLinks = work.externalLinks.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "isolate grid h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] overflow-x-hidden!",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)]",
          "grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden p-0",
          "rounded-3xl border bg-background shadow-2xl",
          "sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)]",
          "sm:w-[calc(100vw-2rem)] sm:max-w-370",
          fullScreen &&
            "h-screen! max-h-screen! w-screen max-w-none rounded-none border-0 sm:w-screen sm:max-w-none",
        )}
      >
        <DialogTitle className="sr-only">{work.title}</DialogTitle>

        <DialogBackdrop bannerPath={work.bannerPath} visible={hasScrolledPastHero} />

        <DialogFloatingActions
          work={work}
          taxonomyLabel={taxonomyLabel}
          fullScreen={fullScreen}
          onToggleFullScreen={() => setFullScreen((value) => !value)}
          onClose={() => onOpenChange(false)}
          comparisonIds={comparisonIds}
          onToggleComparison={() => toggleComparison(work.id)}
        />

        <div
          className="relative min-h-0 overflow-y-auto overscroll-contain"
          onScroll={(event) => handleDialogScroll(event, setHasScrolledPastHero)}
        >
          <WorkHero work={work} favoritePending={favoritePending} toggleFavorite={toggleFavorite} />
          <div
            className={cn(
              "relative mx-auto grid w-full max-w-370 gap-5 overflow-x-clip px-4 py-5",
              "bg-background/40 backdrop-blur-xl",
              "sm:px-6 sm:py-7",
              "lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start",
              "xl:gap-7 xl:px-8",
            )}
          >
            <aside className="order-2 flex min-w-0 flex-col gap-5 lg:sticky lg:top-5 lg:order-2">
              <Panel title="معلومات العمل">
                <dl>
                  <Property label="صنّاع العمل">{work.creator || "—"}</Property>

                  <Property label="الإصدار">
                    {releaseSpan || (work.year ? formatYear(work.year) : "—")}
                  </Property>

                  <Property label="البلد">
                    {work.country.length > 0
                      ? work.country.map((country) => taxonomyLabel("country", country)).join("، ")
                      : "—"}
                  </Property>

                  {work.runtimeMinutes !== null && (
                    <Property label="المدة">{formatMinutes(work.runtimeMinutes)}</Property>
                  )}

                  {work.pageCount !== null && (
                    <Property label="الصفحات">{formatNumber(work.pageCount)}</Property>
                  )}

                  {work.episodeCount !== null && (
                    <Property label="الحلقات">{formatNumber(work.episodeCount)}</Property>
                  )}

                  {work.chapterCount !== null && (
                    <Property label="الفصول">{formatNumber(work.chapterCount)}</Property>
                  )}

                  {work.aliases.length > 0 && (
                    <Property label="أسماء أخرى">
                      <span>{work.aliases.join(" · ")}</span>
                    </Property>
                  )}
                </dl>
              </Panel>

              <Panel title="السجل الشخصي">
                <dl>
                  <Property label="الحالة">{translatedStatus(statusLabel(work.status))}</Property>

                  <Property label="التقدّم">{localizedProgressText(work)}</Property>

                  <Property label="تاريخ الإضافة">
                    {work.trackedOn ? formatDateString(work.trackedOn) : "لم يُسجّل بعد"}
                  </Property>
                </dl>
              </Panel>

              <Panel
                title="معلومات المراجعة"
                empty={!work.curation}
                emptyText="لم تتم مراجعة هذا السجل بعد."
              >
                {work.curation && (
                  <dl>
                    <Property label="الحالة">{curationStatusLabel(work.curation.status)}</Property>

                    <Property label="تاريخ المراجعة">
                      {formatDateString(work.curation.reviewedAt)}
                    </Property>
                  </dl>
                )}
              </Panel>
            </aside>

            <main className="order-1 flex min-w-0 flex-col gap-5 lg:order-1">
              <TrackerLedger work={work} structure={structure} />
              <ScorePreview work={work} />

              <div
                className={cn(
                  "grid min-w-0 gap-5",
                  "xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]",
                  "xl:items-start",
                )}
              >
                {/* Right Column: Summary, Classification, Content Dossier, Relations */}
                <div className="order-1 flex min-w-0 flex-col gap-5 xl:order-1">
                  <Panel
                    title="النبذة"
                    size="large"
                    empty={!hasSummary}
                    emptyText="لم تُكتب نبذة لهذا العمل بعد."
                  >
                    {hasSummary && (
                      <p className="text-sm leading-7 text-foreground/85 sm:text-[15px]">
                        {work.summary}
                      </p>
                    )}
                  </Panel>

                  <Panel
                    title="التصنيف"
                    empty={!hasClassification}
                    emptyText="لم تُضف تصنيفات أو موضوعات بعد."
                  >
                    {hasClassification && (
                      <>
                        <TaxonomyRow
                          label="التصنيفات"
                          items={work.genres}
                          itemLabel={(value) => taxonomyLabel("genre", value)}
                          emphasized
                        />

                        <TaxonomyRow
                          label="الطابع"
                          items={work.tone}
                          itemLabel={(value) => taxonomyLabel("tone", value)}
                        />

                        <TaxonomyRow
                          label="الموضوعات"
                          items={work.tags}
                          itemLabel={(value) => taxonomyLabel("tag", value)}
                        />
                      </>
                    )}
                  </Panel>

                  <Panel
                    title="ملف المحتوى"
                    size="large"
                    empty={!hasContentDossier}
                    emptyText="لا توجد ملاحظات أو تقييمات للمحتوى."
                  >
                    {hasContentDossier && (
                      <>
                        {work.contentWarnings && (
                          <ContentSection title="ملاحظات المحتوى">
                            <p className="text-sm leading-7">{work.contentWarnings}</p>
                          </ContentSection>
                        )}

                        {work.analysisNotes && (
                          <ContentSection
                            title="التحليل العقدي"
                            className={cn(
                              work.contentWarnings && "mt-5",
                              "border-r-2 border-amber-500/70 pr-4",
                            )}
                          >
                            <p className="text-sm leading-7 text-muted-foreground">
                              {work.analysisNotes}
                            </p>
                          </ContentSection>
                        )}

                        {work.riskProfile && (
                          <div
                            className={cn(
                              (work.contentWarnings || work.analysisNotes) && "mt-5 border-t pt-5",
                              "grid gap-2.5 sm:grid-cols-2",
                            )}
                          >
                            <Risk label="المحتوى الجنسي" level={work.riskProfile.sexuality} />

                            <Risk label="السلوكيات" level={work.riskProfile.behavioral} />

                            <Risk label="المحتوى العقدي" level={work.riskProfile.theology} />
                          </div>
                        )}
                      </>
                    )}
                  </Panel>

                  <Panel
                    title="الأعمال المرتبطة"
                    empty={!hasRelations}
                    emptyText="لا توجد أعمال مرتبطة بهذا العمل."
                  >
                    {hasRelations && (
                      <div className="grid gap-3 2xl:grid-cols-2">
                        {work.relations.map((relation) => (
                          <button
                            key={relation.id}
                            type="button"
                            onClick={() => openRelated(relation.workId)}
                            className={cn(
                              "group relative grid w-full grid-cols-[76px_minmax(0,1fr)] gap-3",
                              "overflow-hidden rounded-2xl border bg-background p-2 text-right",
                              "shadow-xs transition-[border-color,box-shadow,transform]",
                              "hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md",
                              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                            )}
                          >
                            <span
                              className={cn(
                                "relative aspect-2/3 overflow-hidden rounded-xl",
                                "border bg-muted/50",
                              )}
                            >
                              {relation.work.imagePath ? (
                                <img
                                  src={relation.work.imagePath}
                                  alt={`ملصق ${relation.work.title}`}
                                  className="size-full object-contain"
                                />
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "flex size-full items-end bg-linear-to-br",
                                    "from-muted via-muted/60 to-primary/20 p-2",
                                  )}
                                >
                                  <span className="line-clamp-3 text-[10px] leading-4 font-semibold text-foreground/70">
                                    {relation.work.title}
                                  </span>
                                </span>
                              )}
                            </span>

                            <span className="flex min-w-0 flex-col items-start py-1 ps-1">
                              <Badge variant="secondary" className="mb-2 max-w-full font-normal">
                                <span className="truncate">{relationContextLabel(relation)}</span>
                              </Badge>

                              <strong className="line-clamp-2 text-sm leading-6 font-semibold">
                                {relation.work.title}
                              </strong>

                              {relation.notes && (
                                <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {relation.notes}
                                </span>
                              )}

                              <small className="mt-auto pt-2 text-xs text-muted-foreground">
                                {translatedKind(relation.work.kind)}
                                {relation.work.year ? ` · ${formatYear(relation.work.year)}` : ""}
                              </small>
                            </span>

                            <ArrowSquareOutIcon className="absolute bottom-3 left-3 size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                  </Panel>
                </div>

                {/* Left Column: Publication, Contributors, Activity, Links */}
                <div className="order-2 flex min-w-0 flex-col gap-5 xl:order-2">
                  <Panel
                    title="النشر والمصدر"
                    empty={!hasPublication}
                    emptyText="لا توجد معلومات نشر أو مصدر مسجلة."
                  >
                    {hasPublication && (
                      <dl>
                        {work.publication?.format && (
                          <Property label="الصيغة">{work.publication.format}</Property>
                        )}

                        {work.publication?.publisher && (
                          <Property label="الناشر">{work.publication.publisher}</Property>
                        )}

                        {work.publication?.imprint && (
                          <Property label="العلامة">{work.publication.imprint}</Property>
                        )}

                        {work.publication?.serialization.length ? (
                          <Property label="التسلسل">
                            {work.publication.serialization.join("، ")}
                          </Property>
                        ) : null}

                        {work.sourceMaterial && (
                          <Property label="المادة الأصلية">
                            <span>
                              {sourceTypeLabel(work.sourceMaterial.type)}

                              {work.sourceMaterial.publication
                                ? ` · ${work.sourceMaterial.publication}`
                                : ""}
                            </span>
                          </Property>
                        )}
                      </dl>
                    )}
                  </Panel>

                  <Panel
                    title="طاقم العمل الأساسي"
                    empty={!hasContributors}
                    emptyText="لم يُضف طاقم العمل بعد."
                  >
                    {hasContributors && (
                      <div className="divide-y divide-border/70">
                        {work.contributors.map((contributor) => (
                          <div
                            key={`${contributor.entityId}-${contributor.role}`}
                            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                          >
                            <span className="min-w-0 truncate text-sm font-medium">
                              <Link
                                to="/entities/$entityId"
                                params={{ entityId: contributor.entityId }}
                                className="hover:underline"
                              >
                                {contributor.name}
                              </Link>
                            </span>

                            <Badge variant="secondary" className="shrink-0 font-normal">
                              {contributorRoleLabel(contributor.role)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>

                  <Panel
                    title="سجل النشاط"
                    empty={!hasActivity}
                    emptyText="لم تُسجّل أي تحديثات للتقدّم بعد."
                  >
                    {hasActivity && activityQuery.data && (
                      <WorkActivityLedger work={work} entries={activityQuery.data} />
                    )}
                  </Panel>

                  <Panel
                    title="الروابط الخارجية"
                    empty={!hasExternalLinks}
                    emptyText="لا توجد روابط خارجية مسجلة."
                  >
                    {hasExternalLinks && (
                      <div className="flex flex-col gap-2">
                        {work.externalLinks.map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "group flex items-center justify-between gap-3",
                              "rounded-xl border bg-background px-3.5 py-3",
                              "text-sm font-medium transition-colors",
                              "hover:border-primary/30 hover:bg-accent/50",
                              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            )}
                          >
                            <span className="min-w-0 truncate">{link.label}</span>

                            <ArrowSquareOutIcon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                          </a>
                        ))}
                      </div>
                    )}
                  </Panel>
                </div>
              </div>
            </main>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkActivityLedger({ work, entries }: { work: Work; entries: TrackingEntry[] }) {
  const days = useMemo(() => {
    const grouped = new Map<string, TrackingEntry[]>();

    const sortedEntries = [...entries].sort(
      (left, right) =>
        right.occurredOn.localeCompare(left.occurredOn) ||
        left.daySequence - right.daySequence ||
        left.id.localeCompare(right.id),
    );

    for (const entry of sortedEntries) {
      grouped.set(entry.occurredOn, [...(grouped.get(entry.occurredOn) ?? []), entry]);
    }

    return [...grouped.entries()];
  }, [entries]);

  return (
    <div className="flex flex-col">
      {days.map(([date, dayEntries]) => {
        const orderedEntries = [...dayEntries].sort(
          (left, right) => left.daySequence - right.daySequence || left.id.localeCompare(right.id),
        );

        const watchEntries = orderedEntries.filter((entry) => {
          if (isMovieStatusEvent(entry, work)) return true;
          return entry.progress > entry.progressBefore;
        });

        const statusEntries = orderedEntries.filter(
          (entry) =>
            entry.statusBefore !== entry.status &&
            !isMovieStatusEvent(entry, work) &&
            entry.progress === entry.progressBefore,
        );

        const watchedAmount = watchEntries.reduce(
          (total, entry) => total + activityAmount(entry),
          0,
        );

        const unitLabel = work.kind === "movie" ? "فيلم" : progressUnitLabel(work.progressUnit);

        const latestWatch = watchEntries.at(-1);
        const latestStatus = statusEntries.at(-1);

        const daySummary =
          watchEntries.length > 0
            ? `${formatNumber(watchedAmount)} ${unitLabel}`
            : statusEntries.length > 0
              ? "تحديث حالة"
              : "سجل";

        return (
          <section
            key={date}
            className="border-t border-border/50 py-2 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-col gap-4 sm:flex-row-reverse sm:items-start sm:gap-6">
              <aside className="shrink-0 sm:w-36">
                <time
                  className="block text-sm font-medium tracking-tight text-foreground"
                  dateTime={date}
                >
                  {formatDateString(date)}
                </time>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{daySummary}</p>
              </aside>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 border-l border-border/60 pr-4">
                  {watchEntries.length > 0 ? (
                    <LedgerEvent
                      tone="primary"
                      title={
                        latestWatch && isMovieStatusEvent(latestWatch, work)
                          ? "اكتملت مشاهدة الفيلم"
                          : "سجل مشاهدة"
                      }
                      description={
                        latestWatch && isMovieStatusEvent(latestWatch, work)
                          ? "سُجّل كاكتمل."
                          : latestWatch && watchEntries.length > 0
                            ? `من ${formatNumber(
                                watchEntries[0].progressBefore,
                              )} إلى ${formatNumber(latestWatch.progress)}`
                            : ""
                      }
                    />
                  ) : null}

                  {latestStatus ? (
                    <LedgerEvent
                      title="تحديث الحالة"
                      description={`${statusLabel(
                        latestStatus.statusBefore,
                      )} ← ${statusLabel(latestStatus.status)}`}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LedgerEvent({
  title,
  description,
  tone = "muted",
}: {
  title: string;
  description: string;
  tone?: "muted" | "primary";
}) {
  return (
    <div className="relative pr-4">
      <span
        className={[
          "absolute top-2 -right-2.25 size-2 rounded-full",
          tone === "primary" ? "bg-primary" : "bg-border",
        ].join(" ")}
      />
      <p className="text-sm leading-tight font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function DialogFloatingActions({
  work,
  taxonomyLabel,
  fullScreen,
  onToggleFullScreen,
  onClose,
  comparisonIds,
  onToggleComparison,
}: {
  work: Work;
  taxonomyLabel: ReturnType<typeof useArabicTranslations>["taxonomyLabel"];
  fullScreen: boolean;
  onToggleFullScreen: () => void;
  onClose: () => void;
  comparisonIds: string[];
  onToggleComparison: () => void;
}) {
  const [copiedFormat, setCopiedFormat] = useState<ShareFormat | null>(null);

  useEffect(() => {
    if (!copiedFormat) return;

    const timeout = window.setTimeout(() => setCopiedFormat(null), 2_000);
    return () => window.clearTimeout(timeout);
  }, [copiedFormat]);

  const handleCopy = async (format: ShareFormat) => {
    try {
      await copyTextToClipboard(formatWorkShareText(work, format, taxonomyLabel));
      setCopiedFormat(format);
    } catch {
      setCopiedFormat(null);
    }
  };

  const isSelectedForComparison = comparisonIds.includes(work.id);

  return (
    <div
      className={cn(
        "absolute top-3 right-3 z-30 flex items-center gap-1 rounded-full",
        "border bg-background/85 p-1 shadow-lg backdrop-blur-xl",
        "supports-backdrop-filter:bg-background/75 sm:top-4 sm:right-4",
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        aria-label="إغلاق التفاصيل"
        title="إغلاق"
      >
        <XIcon />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="نسخ معلومات العمل"
              title="نسخ ومشاركة"
            />
          }
        >
          {copiedFormat ? <CheckIcon /> : <CopyIcon />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" dir="rtl">
          <DropdownMenuGroup>
            <DropdownMenuLabel>نسخ بصيغة مناسبة لـ</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleCopy("plain")}>
              <CopyIcon />
              نص عام
              {copiedFormat === "plain" && <CheckIcon className="ms-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopy("whatsapp")}>
              <WhatsappLogoIcon />
              واتساب
              {copiedFormat === "whatsapp" && <CheckIcon className="ms-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopy("telegram")}>
              <TelegramLogoIcon />
              تيليجرام
              {copiedFormat === "telegram" && <CheckIcon className="ms-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopy("markdown")}>
              <MarkdownLogoIcon />
              Markdown
              {copiedFormat === "markdown" && <CheckIcon className="ms-auto" />}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onToggleFullScreen}
        aria-label={fullScreen ? "الخروج من ملء الشاشة" : "فتح في ملء الشاشة"}
        title={fullScreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}
      >
        {fullScreen ? <ArrowsInIcon /> : <ArrowsOutIcon />}
      </Button>

      <Button
        variant={isSelectedForComparison ? "secondary" : "ghost"}
        size="sm"
        onClick={onToggleComparison}
        aria-pressed={isSelectedForComparison}
        title={isSelectedForComparison ? "إزالة من المقارنة" : "إضافة إلى المقارنة"}
      >
        <StackIcon data-icon="inline-start" />
        {isSelectedForComparison ? "مختار" : "اختيار"}
      </Button>

      {comparisonIds.length >= 2 && (
        <Link
          to="/compare"
          search={{ ids: comparisonIds.join(",") }}
          className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
        >
          مقارنة {comparisonIds.length}
        </Link>
      )}
    </div>
  );
}

function DialogBackdrop({ bannerPath, visible }: { bannerPath: string | null; visible: boolean }) {
  if (!bannerPath) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-500",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <img
        src={bannerPath}
        alt=""
        className="absolute -inset-8 size-[calc(100%+4rem)] scale-110 object-cover blur-2xl"
      />
      <div className="absolute inset-0 bg-background/82" />
    </div>
  );
}

function handleDialogScroll(
  event: UIEvent<HTMLDivElement>,
  setHasScrolledPastHero: (value: boolean) => void,
) {
  setHasScrolledPastHero(event.currentTarget.scrollTop > 240);
}

function WorkHero({
  work,
  favoritePending,
  toggleFavorite,
}: {
  work: Work;
  favoritePending: boolean;
  toggleFavorite: (work: Work) => void;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b bg-background">
      <div
        className={cn(
          "relative overflow-hidden border-b bg-muted/40",
          work.bannerPath ? "h-[clamp(260px,46vw,620px)]" : "h-65 sm:h-85",
        )}
      >
        {work.bannerPath ? (
          <>
            <img
              src={work.bannerPath}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 size-full scale-110 object-cover opacity-45 blur-2xl"
            />

            <div className="absolute inset-0 bg-black/10" />

            <img
              src={work.bannerPath}
              alt={`بانر ${work.title}`}
              className="relative size-full object-contain"
            />

            <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-background/85 to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-linear-to-bl from-primary/15 via-muted/40 to-background" />
            <div className="absolute top-1/2 right-1/2 size-80 translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15" />
            <div className="absolute top-1/2 right-1/2 size-52 translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
          </>
        )}
      </div>

      <div
        className={cn(
          "relative mx-auto -mt-16 grid w-full max-w-360 items-end overflow-x-hidden!",
          "grid-cols-[112px_minmax(0,1fr)] gap-x-4 gap-y-5 px-4 pb-6",
          "sm:-mt-20 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-x-6 sm:px-6 sm:pb-8",
          "lg:-mt-28 lg:grid-cols-[200px_minmax(0,1fr)_220px] lg:gap-8",
          "xl:grid-cols-[220px_minmax(0,1fr)_230px] xl:px-8",
        )}
      >
        <div className="relative">
          <WorkArtwork
            work={work}
            className={cn(
              "w-full overflow-hidden rounded-2xl border-2 border-background",
              "shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]",
            )}
          />

          <div className="pointer-events-none absolute inset-x-[12%] -bottom-4 -z-10 h-10 rounded-full bg-black/25 blur-xl" />
        </div>

        <div className="min-w-0 pb-1 text-right lg:pb-3">
          <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
            <Badge className="shadow-sm">{translatedKind(work.kind)}</Badge>

            <Badge variant="secondary">{work.year ? formatYear(work.year) : "لم يصدر بعد"}</Badge>

            <Badge variant="outline" className="bg-background/80">
              {releaseStatusLabel(work.releaseStatus)}
            </Badge>
          </div>

          {work.logoPath ? (
            <div className="flex min-h-12 items-center sm:min-h-16">
              <img
                src={work.logoPath}
                alt={work.title}
                className={cn(
                  "max-h-16 max-w-full object-contain object-right sm:max-h-24",
                  "drop-shadow-[0_4px_18px_rgba(0,0,0,0.22)]",
                  "dark:brightness-110",
                )}
              />
            </div>
          ) : (
            <h1
              className={cn(
                "max-w-3xl text-2xl leading-tight font-bold tracking-tight",
                "sm:text-4xl lg:text-5xl",
              )}
            >
              {work.title}
            </h1>
          )}

          {work.logoPath && (
            <p className="mt-2 text-sm font-medium text-foreground/75 sm:mt-3">{work.title}</p>
          )}

          {work.arabicTitle && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/70 sm:mt-3 sm:text-base sm:leading-7">
              {work.arabicTitle}
            </p>
          )}
        </div>

        <div
          className={cn(
            "col-span-2 rounded-2xl border bg-background/88 p-3 shadow-lg",
            "backdrop-blur-xl lg:col-span-1",
          )}
        >
          <Button
            className="w-full"
            variant={work.favorite ? "default" : "outline"}
            disabled={favoritePending}
            onClick={() => toggleFavorite(work)}
          >
            <HeartIcon weight={work.favorite ? "fill" : "regular"} data-icon="inline-start" />

            {work.favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
          </Button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <HeroStat label="الحالة" value={translatedStatus(statusLabel(work.status))} />

            <HeroStat label="التقدّم" value={localizedProgressText(work)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border bg-muted/35 px-3 py-2.5">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>

      <p className="mt-1 truncate text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TrackerLedger({ work, structure }: { work: Work; structure?: WorkStructure }) {
  const total = structure?.totalUnits || work.progressTotal;

  const percentage = total ? Math.min(100, Math.round((work.progress / total) * 100)) : 0;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm",
        "ring-1 ring-border/30",
      )}
    >
      <Collapsible>
        <div className="flex flex-col gap-5 p-5 pb-0 sm:p-6 sm:pb-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold">متابعة التقدّم</h2>

              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                حدّث موضعك الحالي وحالة متابعتك لهذا العمل.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{translatedStatus(statusLabel(work.status))}</Badge>

              <Badge variant="outline">{localizedProgressText(work)}</Badge>
            </div>
          </div>

          <Progress value={percentage}>
            <ProgressLabel>التقدّم الكلي</ProgressLabel>

            <ProgressValue>{() => `${formatNumber(percentage)}٪`}</ProgressValue>
          </Progress>

          <CollapsibleTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "group mx-auto flex w-full rounded-t-md! rounded-b-none! border-b-0",
                  "sm:w-fit sm:min-w-32",
                )}
              />
            }
          >
            تحديث التقدّم
            <CaretDownIcon
              data-icon="inline-end"
              className="transition-transform group-data-[state=open]:rotate-180"
            />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="border-t px-5 py-5 sm:px-6">
          <TrackingForm work={work} structure={structure} />

          {structure?.seasons.length ? (
            <>
              <Separator className="my-5" />
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {structure.seasons.map((season) => {
                  const completed = season.progress?.progress ?? 0;

                  const seasonTotal = seasonCapacity(season);

                  const seasonCompleted = seasonTotal > 0 && completed === seasonTotal;

                  return (
                    <div
                      key={season.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border",
                        "bg-background px-3.5 py-3",
                      )}
                    >
                      <span className="min-w-0 truncate text-sm font-medium">{season.title}</span>

                      <Badge variant={seasonCompleted ? "default" : "outline"} className="shrink-0">
                        {formatNumber(completed)}
                        {" / "}
                        {seasonTotal ? formatNumber(seasonTotal) : "—"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function ScorePreview({ work }: { work: Work }) {
  return (
    <Panel title="تفاصيل التقييم" size="large">
      <div className="grid gap-5 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-center">
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-muted/25 px-4 py-5">
          <span className="font-mono text-3xl font-semibold tabular-nums">
            {work.calculatedRating?.toFixed(1) ?? "—"}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">من 10</span>
        </div>

        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          {scoreCriteria.map((criterion) => {
            const score = work.scoreComponents[criterion];
            return (
              <Progress
                key={criterion}
                value={score === undefined ? null : score * 10}
                className={cn(score === undefined && "opacity-55")}
              >
                <ProgressLabel>{scoreLabel(criterion, work.kind).ar}</ProgressLabel>
                <ProgressValue>
                  {() => (score === undefined ? "—" : score.toFixed(1))}
                </ProgressValue>
              </Progress>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function Panel({
  title,
  children,
  className,
  size = "default",
  empty = false,
  emptyText = "لا توجد بيانات مسجلة.",
}: {
  title: string;
  children?: ReactNode;
  className?: string;
  size?: "default" | "large";
  empty?: boolean;
  emptyText?: string;
}) {
  return (
    <section
      data-empty={empty ? "true" : "false"}
      className={cn(
        "min-w-0 rounded-2xl border bg-card shadow-sm",
        "ring-1 ring-border/20 transition-opacity",
        "data-[empty=true]:opacity-65",
        "hover:data-[empty=true]:opacity-90",
        empty ? "p-4" : size === "large" ? "p-5 sm:p-6" : "p-4 sm:p-5",
        className,
      )}
    >
      <div className={cn("flex items-center gap-3", empty ? "mb-3" : "mb-4")}>
        <span
          className={cn("h-4 w-1 rounded-full", empty ? "bg-muted-foreground/35" : "bg-primary")}
        />

        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground">{title}</h2>
      </div>

      {empty ? <EmptySection>{emptyText}</EmptySection> : children}
    </section>
  );
}

function EmptySection({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-3.5 py-3">
      <p className="text-xs leading-5 text-muted-foreground/75">{children}</p>
    </div>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(88px,auto)_minmax(0,1fr)] gap-4",
        "border-b border-border/70 py-3 text-sm last:border-0",
        "first:pt-0 last:pb-0",
      )}
    >
      <dt className="rtl text-start text-muted-foreground">{label}</dt>

      <dd className="rtl min-w-0 text-start font-medium wrap-break-word">{children}</dd>
    </div>
  );
}

function ContentSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{title}</p>

      {children}
    </div>
  );
}

function TaxonomyRow({
  label,
  items,
  itemLabel,
  emphasized = false,
}: {
  label: string;
  items: string[];
  itemLabel: (value: string) => string;
  emphasized?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>

      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge
            key={`${label}-${item}`}
            variant={emphasized ? "default" : "secondary"}
            className="max-w-full font-normal"
          >
            <span className="truncate">{itemLabel(item)}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}

type RiskLevel = "none" | "low" | "medium" | "high" | "unknown";

const riskConfig: Record<
  RiskLevel,
  {
    label: string;
    dotColor: string;
    textColor: string;
    backgroundColor: string;
  }
> = {
  none: {
    label: "لا يوجد",
    dotColor: "bg-emerald-500",
    textColor: "text-emerald-700 dark:text-emerald-400",
    backgroundColor: "bg-emerald-500/5",
  },
  low: {
    label: "منخفض",
    dotColor: "bg-sky-500",
    textColor: "text-sky-700 dark:text-sky-400",
    backgroundColor: "bg-sky-500/5",
  },
  medium: {
    label: "متوسط",
    dotColor: "bg-amber-500",
    textColor: "text-amber-700 dark:text-amber-400",
    backgroundColor: "bg-amber-500/5",
  },
  high: {
    label: "مرتفع",
    dotColor: "bg-rose-500",
    textColor: "text-rose-700 dark:text-rose-400",
    backgroundColor: "bg-rose-500/5",
  },
  unknown: {
    label: "غير معروف",
    dotColor: "bg-slate-400",
    textColor: "text-muted-foreground",
    backgroundColor: "bg-muted/30",
  },
};

function Risk({ label, level, value }: { label: string; level: RiskLevel; value?: string }) {
  const config = riskConfig[level];

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
        config.backgroundColor,
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>

      <Badge
        variant="outline"
        className={cn("shrink-0 gap-1.5 bg-background/60", config.textColor)}
      >
        <span className={cn("size-1.5 rounded-full", config.dotColor)} />

        {value ?? config.label}
      </Badge>
    </div>
  );
}

const statusTranslations: Record<string, string> = {
  saved: "محفوظ",
  planned: "مخطط له",
  planning: "مخطط له",
  backlog: "في القائمة",
  current: "قيد المتابعة",
  "in progress": "قيد المتابعة",
  watching: "أشاهده حاليًا",
  reading: "أقرأه حاليًا",
  playing: "ألعبه حاليًا",
  completed: "مكتمل",
  finished: "مكتمل",
  paused: "متوقف مؤقتًا",
  "on hold": "متوقف مؤقتًا",
  dropped: "متروك",
  abandoned: "متروك",
  unknown: "غير معروف",
};

const releaseStatusTranslations: Record<string, string> = {
  released: "صدر",
  ended: "انتهى",
  releasing: "قيد الإصدار",
  completed: "مكتمل",
  finished: "مكتمل",
  ongoing: "مستمر",
  publishing: "قيد النشر",
  airing: "يُعرض حاليًا",
  upcoming: "قادم",
  announced: "مُعلن عنه",
  unreleased: "لم يصدر",
  cancelled: "ملغى",
  canceled: "ملغى",
  hiatus: "متوقف",
  unknown: "غير معروف",
};

const kindTranslations: Record<string, string> = {
  anime: "أنمي",
  manga: "مانغا",
  novel: "رواية",
  book: "كتاب",
  movie: "فيلم",
  film: "فيلم",
  tv: "مسلسل",
  series: "مسلسل",
  game: "لعبة",
  "visual-novel": "رواية مرئية",
  videogame: "لعبة فيديو",
  "video-game": "لعبة فيديو",
  animation: "رسوم متحركة",
  documentary: "وثائقي",
  comic: "قصص مصورة",
};

const contributorRoleTranslations: Record<string, string> = {
  author: "المؤلف",
  "original-author": "المؤلف الأصلي",
  writer: "الكاتب",
  screenwriter: "كاتب السيناريو",
  director: "المخرج",
  producer: "المنتج",
  studio: "الاستوديو",
  "animation-studio": "استوديو الرسوم المتحركة",
  "production-company": "شركة الإنتاج",
  publisher: "الناشر",
  developer: "المطوّر",
  illustrator: "الرسام",
  artist: "الفنان",
  editor: "المحرر",
  translator: "المترجم",
  creator: "صاحب العمل",
  composer: "الملحن",
  screenplay: "كاتب السيناريو",
  "original-creator": "المؤلف الأصلي",
};

const sourceTypeTranslations: Record<string, string> = {
  original: "عمل أصلي",
  manga: "مانغا",
  novel: "رواية",
  book: "كتاب",
  game: "لعبة",
  anime: "أنمي",
  comic: "قصص مصورة",
  "light-novel": "رواية خفيفة",
  webnovel: "رواية ويب",
  "web-novel": "رواية ويب",
  visualnovel: "رواية مرئية",
  "visual-novel": "رواية مرئية",
};

const curationStatusTranslations: Record<string, string> = {
  verified: "موثّق",
  provisional: "مؤقت",
  reviewed: "تمت المراجعة",
  approved: "معتمد",
  pending: "بانتظار المراجعة",
  draft: "مسودة",
  rejected: "مرفوض",
  archived: "مؤرشف",
  complete: "مكتمل",
  completed: "مكتمل",
};

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replaceAll("_", " ");
}

function translatedStatus(value: string) {
  return statusTranslations[normalizeLabel(value)] ?? value;
}

function releaseStatusLabel(value: string) {
  return releaseStatusTranslations[normalizeLabel(String(value))] ?? "غير معروف";
}

function translatedKind(kind: string) {
  return kindTranslations[normalizeLabel(String(kind))] ?? "نوع غير معروف";
}

function contributorRoleLabel(value: string) {
  const normalized = normalizeLabel(value).replaceAll(" ", "-");

  return contributorRoleTranslations[normalized] ?? "دور غير معروف";
}

function relationContextLabel(relation: Work["relations"][number]) {
  const labels: Record<
    Work["relations"][number]["relationType"],
    { outgoing: string; incoming: string }
  > = {
    adaptation: {
      outgoing: "مقتبس من هذا العمل",
      incoming: "اقتباس لهذا العمل",
    },
    sequel: {
      outgoing: "تكملة لهذا العمل",
      incoming: "العمل السابق له",
    },
    "spin-off": {
      outgoing: "عمل مشتق من هذا العمل",
      incoming: "العمل الأصلي",
    },
    "side-story": {
      outgoing: "قصة جانبية لهذا العمل",
      incoming: "العمل الأصلي",
    },
    compilation: {
      outgoing: "تجميع يتضمن هذا العمل",
      incoming: "عمل مصدر في هذا التجميع",
    },
    alternative: {
      outgoing: "نسخة بديلة",
      incoming: "نسخة بديلة",
    },
    related: {
      outgoing: "عمل ذو صلة",
      incoming: "عمل ذو صلة",
    },
  };

  return labels[relation.relationType][relation.direction];
}

function sourceTypeLabel(value: string) {
  const normalized = normalizeLabel(value).replaceAll(" ", "-");

  return sourceTypeTranslations[normalized] ?? "مصدر غير معروف";
}

function curationStatusLabel(value: string) {
  return curationStatusTranslations[normalizeLabel(value)] ?? "غير معروف";
}

function progressUnitLabel(value: string) {
  const labels: Record<string, string> = {
    episode: "حلقة",
    episodes: "حلقة",
    chapter: "فصل",
    chapters: "فصل",
    page: "صفحة",
    pages: "صفحة",
    hour: "ساعة",
    hours: "ساعة",
    minute: "دقيقة",
    minutes: "دقيقة",
    volume: "مجلد",
    volumes: "مجلد",
    season: "موسم",
    seasons: "موسم",
    percent: "بالمئة",
  };

  return labels[normalizeLabel(value)] ?? "وحدة";
}

function localizedProgressText(work: Work) {
  if (work.status === "completed" && !work.progressTotal) return "مكتمل";
  if (!work.progressTotal) {
    return work.progress
      ? `${formatNumber(work.progress)} ${progressUnitLabel(work.progressUnit)}`
      : "لم يبدأ بعد";
  }
  return `${formatNumber(work.progress)} / ${formatNumber(
    work.progressTotal,
  )} ${progressUnitLabel(work.progressUnit)}`;
}

function formatDateString(value: string | null) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.valueOf())) return "تاريخ غير صالح";

  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar").format(value);
}

export function formatYear(value: number | string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "غير محدد";

  return new Intl.NumberFormat("ar", {
    useGrouping: false,
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (!hours) {
    return `${formatNumber(value)} دقيقة`;
  }

  if (!minutes) {
    return `${formatNumber(hours)} ساعة`;
  }

  return `${formatNumber(hours)} ساعة و${formatNumber(minutes)} دقيقة`;
}

type ShareFormat = "plain" | "whatsapp" | "telegram" | "markdown";

type ShareField = {
  label: string;
  value: string;
};

type ShareSection = {
  title: string;
  fields: ShareField[];
};

function formatWorkShareText(
  work: Work,
  format: ShareFormat,
  taxonomyLabel: ReturnType<typeof useArabicTranslations>["taxonomyLabel"],
) {
  const releaseSpan =
    work.releaseStart && work.releaseEnd && work.releaseStart !== work.releaseEnd
      ? `${formatDateString(work.releaseStart)} — ${formatDateString(work.releaseEnd)}`
      : formatDateString(work.releaseStart ?? work.releaseEnd);

  const sections = [
    makeShareSection("معلومات العمل", [
      [
        "العنوان العربي",
        work.arabicTitle && work.arabicTitle !== work.title ? work.arabicTitle : null,
      ],
      ["أسماء أخرى", work.aliases.join("، ")],
      ["النوع", translatedKind(work.kind)],
      [
        "حالة الإصدار",
        work.releaseStatus === "unknown" ? null : releaseStatusLabel(work.releaseStatus),
      ],
      ["الإصدار", releaseSpan || (work.year ? formatYear(work.year) : null)],
      ["صنّاع العمل", work.creator],
      ["البلد", work.country.map((country) => taxonomyLabel("country", country)).join("، ")],
      ["الفئة العمرية", work.audience ? taxonomyLabel("audience", work.audience) : null],
      ["الاستوديوهات", work.studios.join("، ")],
      ["المدة", work.runtimeMinutes === null ? null : formatMinutes(work.runtimeMinutes)],
      ["مدة اللعب", work.playtimeMinutes === null ? null : formatMinutes(work.playtimeMinutes)],
      ["الصفحات", shareNumber(work.pageCount)],
      ["الحلقات", shareNumber(work.episodeCount)],
      ["الفصول", shareNumber(work.chapterCount)],
      ["المجلدات", shareNumber(work.volumeCount)],
      ["المسارات", shareNumber(work.routeCount)],
    ]),
    makeShareSection("السجل الشخصي", [
      ["الحالة", translatedStatus(statusLabel(work.status))],
      ["التقدّم", localizedProgressText(work)],
      ["التقييم", shareRating(work.calculatedRating)],
      ["المفضلة", work.favorite ? "نعم" : null],
      ["تاريخ الإضافة", formatDateString(work.trackedOn)],
      ["أول مشاهدة", formatDateString(work.watchDates?.firstWatchedAt ?? null)],
      ["آخر مشاهدة", formatDateString(work.watchDates?.lastWatchedAt ?? null)],
      ["تاريخ الإكمال", formatDateString(work.watchDates?.completedAt ?? null)],
      ["تاريخ الإنجاز", formatTimestamp(work.completedAt)],
      ["مشاركة التجربة مع", work.sharedWith.join("، ")],
    ]),
    makeShareSection("تفاصيل التقييم", [
      ...scoreCriteria.map(
        (criterion) =>
          [
            scoreLabel(criterion, work.kind).ar,
            shareRating(work.scoreComponents[criterion]),
          ] as const,
      ),
    ]),
    makeShareSection("النبذة", [["الوصف", work.summary]]),
    makeShareSection("التصنيف", [
      ["التصنيفات", work.genres.map((genre) => taxonomyLabel("genre", genre)).join("، ")],
      ["الطابع", work.tone.map((tone) => taxonomyLabel("tone", tone)).join("، ")],
      ["الموضوعات", work.tags.map((tag) => taxonomyLabel("tag", tag)).join("، ")],
    ]),
    makeShareSection("النشر والمصدر", [
      ["الصيغة", work.publication?.format],
      ["الناشر", work.publication?.publisher],
      ["العلامة", work.publication?.imprint],
      ["التسلسل", work.publication?.serialization.join("، ")],
      ["المحتويات", work.publication?.contents.join("، ")],
      ["المادة الأصلية", work.sourceMaterial ? sourceTypeLabel(work.sourceMaterial.type) : null],
      ["منشور المصدر", work.sourceMaterial?.publication],
      [
        "بداية نشر المصدر",
        work.sourceMaterial?.started === null || work.sourceMaterial?.started === undefined
          ? null
          : formatYear(work.sourceMaterial.started),
      ],
      [
        "نهاية نشر المصدر",
        work.sourceMaterial?.finished === null || work.sourceMaterial?.finished === undefined
          ? null
          : formatYear(work.sourceMaterial.finished),
      ],
      ["تسلسل المصدر", work.sourceMaterial?.serialization.join("، ")],
    ]),
    makeShareSection(
      "طاقم العمل الأساسي",
      work.contributors.map(
        (contributor) => [contributorRoleLabel(contributor.role), contributor.name] as const,
      ),
    ),
    makeShareSection("ملف المحتوى", [
      ["ملاحظات المحتوى", work.contentWarnings],
      ["التحليل العقدي", work.analysisNotes],
      ["المحتوى الجنسي", work.riskProfile ? riskConfig[work.riskProfile.sexuality].label : null],
      ["السلوكيات", work.riskProfile ? riskConfig[work.riskProfile.behavioral].label : null],
      ["المحتوى العقدي", work.riskProfile ? riskConfig[work.riskProfile.theology].label : null],
    ]),
    makeShareSection("معلومات المراجعة", [
      ["الحالة", work.curation ? curationStatusLabel(work.curation.status) : null],
      ["تاريخ المراجعة", formatDateString(work.curation?.reviewedAt ?? null)],
      ["ملاحظات المراجعة", work.curation?.notes],
    ]),
    makeShareSection(
      "الأعمال المرتبطة",
      work.relations.map(
        (relation) =>
          [
            relationContextLabel(relation),
            [
              relation.work.title,
              translatedKind(relation.work.kind),
              relation.work.year ? formatYear(relation.work.year) : null,
              relation.notes.trim() || null,
            ]
              .filter(Boolean)
              .join(" · "),
          ] as const,
      ),
    ),
    makeShareSection(
      "الروابط الخارجية",
      work.externalLinks.map((link) => [link.label, link.url] as const),
    ),
  ].filter((section): section is ShareSection => section !== null);

  return renderShareText(work.title, sections, format);
}

function makeShareSection(
  title: string,
  fields: ReadonlyArray<readonly [string, string | null | undefined]>,
): ShareSection | null {
  const populatedFields = fields.flatMap(([label, value]) => {
    const normalizedValue = value?.trim();
    return normalizedValue ? [{ label, value: normalizedValue }] : [];
  });

  return populatedFields.length > 0 ? { title, fields: populatedFields } : null;
}

function renderShareText(title: string, sections: ShareSection[], format: ShareFormat) {
  const indented = (value: string) => value.replaceAll("\n", "\n  ");

  if (format === "markdown") {
    return [
      `# 🎬 ${title}`,
      ...sections.map(
        (section) =>
          `## ${section.title}\n${section.fields
            .map((field) => `- **${field.label}:** ${indented(field.value)}`)
            .join("\n")}`,
      ),
    ].join("\n\n");
  }

  if (format === "whatsapp") {
    return [
      `*🎬 ${title}*`,
      ...sections.map(
        (section) =>
          `*${section.title}*\n${section.fields
            .map((field) => `• *${field.label}:* ${indented(field.value)}`)
            .join("\n")}`,
      ),
    ].join("\n\n");
  }

  if (format === "telegram") {
    return [
      `🎬 ${title}`,
      ...sections.map(
        (section) =>
          `▰ ${section.title}\n${section.fields
            .map((field) => `• ${field.label}: ${indented(field.value)}`)
            .join("\n")}`,
      ),
    ].join("\n\n");
  }

  return [
    title,
    ...sections.map(
      (section) =>
        `${section.title}\n${section.fields
          .map((field) => `${field.label}: ${indented(field.value)}`)
          .join("\n")}`,
    ),
  ].join("\n\n");
}

function shareNumber(value: number | null) {
  return value === null ? null : formatNumber(value);
}

function shareRating(value: number | null | undefined) {
  return value === null || value === undefined ? null : `${value.toFixed(1)} / 10`;
}

function formatTimestamp(value: number | null) {
  if (value === null) return null;

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;

  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

async function copyTextToClipboard(text: string) {
  if ("clipboard" in navigator && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.dir = "rtl";
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) throw new Error("Clipboard copy failed");
}
