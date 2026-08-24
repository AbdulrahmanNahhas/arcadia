import { TrophyIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { Work } from "@/features/library/model";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { WorkRail } from "@/features/platform/components/work-rail";
import { getWorks } from "@/server/library.functions";
import { getPublicAwards } from "@/server/platform.functions";

export function AwardsPage() {
  const { data: works } = useSuspenseQuery({ queryKey: ["works"], queryFn: () => getWorks() });
  const { data: awards } = useSuspenseQuery({
    queryKey: ["public-awards"],
    queryFn: () => getPublicAwards(),
  });
  const worksById = useMemo(() => new Map(works.map((work) => [work.id, work])), [works]);

  const rails = useMemo(
    () =>
      awards.organizations
        .map((organization) => {
          const recognitions = awards.recognitions.filter(
            (recognition) => recognition.organizationId === organization.id,
          );
          const seen = new Set<string>();
          const rowWorks: Work[] = [];
          for (const recognition of recognitions) {
            if (seen.has(recognition.titleId)) continue;
            seen.add(recognition.titleId);
            const work = worksById.get(recognition.titleId);
            if (work) rowWorks.push(work);
          }
          return { organization, works: rowWorks };
        })
        .filter((row) => row.works.length > 0)
        .toSorted((a, b) => b.works.length - a.works.length), // Highest work count first
    [awards, worksById],
  );

  return (
    <PlatformShell>
      <section className="archive-grid border-b border-white/8">
        <div className="mx-auto max-w-400 px-5 pb-12 pt-28 sm:px-8 sm:pt-36">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.18em] text-primary">
            <TrophyIcon weight="fill" /> التكريمات الموثّقة
          </p>
          <h1 className="mt-3 font-heading text-4xl font-semibold sm:text-6xl">الجوائز</h1>
          <p className="mt-4 max-w-2xl text-lg leading-9 text-foreground/70">
            كل جهة مانحة وأعمالها الفائزة والمرشّحة في المكتبة، كما وثّقها فريق التحرير.
          </p>
        </div>
      </section>

      <main className="max-w-600 mx-auto pb-24 pt-10">
        {rails.length ? (
          <div className="flex flex-col gap-14 ">
            {rails.map(({ organization, works: orgWorks }) => (
              <WorkRail
                key={organization.id}
                title={organization.nameAr}
                description={`${organization.winnerCount} فوز · ${organization.nomineeCount} ترشيح · ${organization.workCount} عمل`}
                works={orgWorks}
                href={{
                  to: "/awards/$organizationSlug",
                  params: { organizationSlug: organization.slug },
                }}
              />
            ))}
          </div>
        ) : (
          <div className="px-5 sm:px-8">
            <Empty className="min-h-72 border border-dashed border-white/10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TrophyIcon />
                </EmptyMedia>
                <EmptyTitle>لا توجد جوائز موثّقة بعد</EmptyTitle>
                <EmptyDescription>
                  ستظهر هنا الجهات المانحة وأعمالها فور توثيقها من لوحة الإدارة.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </main>
    </PlatformShell>
  );
}
