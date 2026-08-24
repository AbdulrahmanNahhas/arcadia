import type { PublicAwardRecognition } from "@arcadia/contracts";
import { ArrowRightIcon, ArrowSquareOutIcon, StarIcon, TrophyIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { Work } from "@/features/library/model";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { kindLabel } from "@/features/platform/components/work-card";
import { cn } from "@/lib/utils";
import { getWorks } from "@/server/library.functions";
import { getPublicAwards } from "@/server/platform.functions";

export function AwardOrganizationPage({ organizationSlug }: { organizationSlug: string }) {
  const { data: works } = useSuspenseQuery({ queryKey: ["works"], queryFn: () => getWorks() });
  const { data: awards } = useSuspenseQuery({
    queryKey: ["public-awards"],
    queryFn: () => getPublicAwards(),
  });
  const worksById = useMemo(() => new Map(works.map((work) => [work.id, work])), [works]);
  const organization = awards.organizations.find((item) => item.slug === organizationSlug);
  const recognitions = useMemo(
    () =>
      organization
        ? awards.recognitions.filter((item) => item.organizationId === organization.id)
        : [],
    [awards.recognitions, organization],
  );

  const byYear = useMemo(() => {
    const groups = new Map<string, PublicAwardRecognition[]>();
    for (const recognition of recognitions) {
      const key = recognition.year ? String(recognition.year) : "غير مؤرّخ";
      groups.set(key, [...(groups.get(key) ?? []), recognition]);
    }
    return [...groups.entries()]
      .toSorted(([left], [right]) => (right === "غير مؤرّخ" ? -1 : Number(right) - Number(left)))
      .map(
        ([year, items]) =>
          [
            year,
            items.toSorted((left, right) =>
              left.result === right.result ? 0 : left.result === "winner" ? -1 : 1,
            ),
          ] as const,
      );
  }, [recognitions]);

  if (!organization)
    return (
      <PlatformShell>
        <div className="mx-auto max-w-3xl px-5 py-32 text-center">
          <p className="text-muted-foreground">تعذّر العثور على هذه الجهة المانحة.</p>
          <Link
            to="/awards"
            className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowRightIcon /> العودة إلى الجوائز
          </Link>
        </div>
      </PlatformShell>
    );

  return (
    <PlatformShell>
      <section className="archive-grid border-b border-white/8">
        <div className="mx-auto max-w-400 px-5 pb-12 pt-28 sm:px-8 sm:pt-36">
          <Link
            to="/awards"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRightIcon /> الجوائز
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              {organization.logoPath ? (
                <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-card p-2">
                  <img src={organization.logoPath} alt="" className="size-full object-contain" />
                </span>
              ) : (
                <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <TrophyIcon weight="duotone" size={28} />
                </span>
              )}
              <div>
                <h1 className="font-heading text-3xl font-semibold sm:text-5xl">
                  {organization.nameAr}
                </h1>
                {organization.description ? (
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                    {organization.description}
                  </p>
                ) : null}
              </div>
            </div>
            {organization.websiteUrl ? (
              <a
                href={organization.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                الموقع الرسمي <ArrowSquareOutIcon />
              </a>
            ) : null}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge>{organization.winnerCount} فوز</Badge>
            <Badge variant="outline">{organization.nomineeCount} ترشيح</Badge>
            <Badge variant="secondary">{organization.workCount} عمل مكرّم</Badge>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-600 pb-28 pt-10 sm:px-8">
        {byYear.length ? (
          <div className="flex flex-row gap-12 overflow-x-scroll scroll-fade-x px-5">
            {byYear.map(([year, items]) => (
              <section key={year}>
                <h2 className="font-heading text-2xl font-semibold">{year}</h2>
                <div className="mt-5 flex flex-col gap-x-4 gap-y-8 w-44 xl:w-56">
                  {items.map((recognition) => (
                    <RecognitionCard
                      key={recognition.id}
                      recognition={recognition}
                      work={worksById.get(recognition.titleId)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <Empty className="min-h-64 border border-dashed border-white/10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TrophyIcon />
              </EmptyMedia>
              <EmptyTitle>لا توجد تكريمات مسجّلة</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </main>
    </PlatformShell>
  );
}

/**
 * Poster-only card in the same visual language as `WorkCard`'s poster variant, but built for
 * the recognition itself rather than a `Work`: it links straight to the recognized installment
 * when the award was for one (not just the title as a whole), and shows that installment's own
 * poster (the API already prefers it over the title's poster for this reason).
 */
function RecognitionCard({
  recognition,
  work,
}: {
  recognition: PublicAwardRecognition;
  work: Work | undefined;
}) {
  const displayTitle = recognition.installmentTitle || recognition.titleAr || recognition.title;
  const parentTitle =
    recognition.installmentTitle && (recognition.titleAr || recognition.title) !== displayTitle
      ? recognition.titleAr || recognition.title
      : null;

  return (
    <Link
      to={
        recognition.installmentId
          ? "/titles/$titleId/installments/$installmentId"
          : "/titles/$titleId"
      }
      params={
        recognition.installmentId
          ? { titleId: recognition.titleId, installmentId: recognition.installmentId }
          : { titleId: recognition.titleId }
      }
      className={cn(
        "group flex flex-col gap-4",
        recognition.result === "winner" && "bg-muted! p-2 hover:pt-3 rounded-2xl",
      )}
    >
      <div className="relative aspect-2/3 transform-gpu overflow-hidden rounded-2xl bg-muted shadow-md shadow-black/20 ring-1 ring-white/10 transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-[1.03] group-hover:shadow-2xl group-hover:shadow-black/40 group-hover:ring-primary/35">
        {recognition.posterPath ? (
          <img
            src={recognition.posterPath}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/25 via-muted to-muted p-4 text-center">
            <span className="font-heading text-sm leading-6 text-foreground/90">
              {displayTitle}
            </span>
          </div>
        )}
        <Badge
          variant={recognition.result === "winner" ? "default" : "secondary"}
          className="absolute top-2.5 inset-s-2.5 gap-1"
        >
          <StarIcon weight="fill" className="size-3" />
          {recognition.result === "winner" ? "فائز" : "مرشّح"}
        </Badge>
      </div>
      <div className="flex flex-col gap-1 px-0.5">
        {parentTitle ? (
          <p className="truncate text-xs font-medium text-muted-foreground/75">{parentTitle}</p>
        ) : null}
        <h3 className="truncate font-heading text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
          {displayTitle}
        </h3>
        <p className="truncate text-xs text-muted-foreground">
          {work ? `${kindLabel[work.kind]} · ` : ""}
          {recognition.category}
        </p>
      </div>
    </Link>
  );
}
