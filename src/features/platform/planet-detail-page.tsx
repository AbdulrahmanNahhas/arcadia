import { ArrowRightIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getPlanetDetail } from "@/server/platform.functions";
import { PlatformShell } from "./components/platform-shell";
import { WorkCard } from "./components/work-card";

export function PlanetDetailPage({ slug }: { slug: string }) {
  const { data: planet } = useSuspenseQuery({
    queryKey: ["planet", slug],
    queryFn: () => getPlanetDetail({ data: { slug } }),
  });
  if (!planet)
    return (
      <PlatformShell>
        <div className="mx-auto max-w-3xl px-5 py-32">تعذر العثور على هذا الكوكب.</div>
      </PlatformShell>
    );
  return (
    <PlatformShell immersive>
      <section className="relative isolate overflow-hidden border-b border-white/8">
        <div
          className="absolute inset-0 -z-20"
          style={{
            background: `radial-gradient(circle at 75% 20%, ${planet.primaryColor}55, transparent 35rem), linear-gradient(135deg, ${planet.secondaryColor}22, transparent 60%)`,
          }}
        />
        <div className="archive-grid absolute inset-0 -z-10 opacity-50" />
        <div className="mx-auto max-w-400 px-5 pb-16 pt-32 sm:px-8 sm:pb-24 sm:pt-40">
          <Link
            to="/planets"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRightIcon /> كل الكواكب
          </Link>
          <div className="mt-10 flex max-w-3xl items-start gap-5">
            <span
              className="flex size-20 shrink-0 items-center justify-center rounded-full border text-4xl"
              style={{
                borderColor: `${planet.primaryColor}99`,
                background: `${planet.primaryColor}18`,
                boxShadow: `0 0 60px ${planet.primaryColor}33`,
              }}
            >
              {planet.icon}
            </span>
            <div>
              <p
                className="text-xs font-semibold tracking-[0.18em]"
                style={{ color: planet.primaryColor }}
              >
                كوكب أركاديا
              </p>
              <h1 className="mt-3 font-heading text-4xl leading-tight font-semibold sm:text-6xl">
                {planet.nameAr}
              </h1>
              {planet.nameEn && (
                <p className="mt-2 font-mono text-sm text-muted-foreground" dir="ltr">
                  {planet.nameEn}
                </p>
              )}
            </div>
          </div>
          <p className="mt-8 max-w-2xl text-lg leading-9 text-foreground/75">
            {planet.description}
          </p>
          <p className="mt-5 text-sm text-muted-foreground">
            {planet.workCount} عمل · الأحدث عرضاً أولاً
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-400 px-5 pb-28 pt-10 sm:px-8">
        {planet.works.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {planet.works.map((work) => (
              <WorkCard key={work.id} work={work} />
            ))}
          </div>
        ) : (
          <Empty className="min-h-80 border border-dashed border-white/10">
            <EmptyHeader>
              <EmptyTitle>هذا المدار بانتظار أول عمل</EmptyTitle>
              <EmptyDescription>
                الإسناد صريح ومحفوظ في قاعدة البيانات. أضف عملاً من لوحة الإدارة.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </PlatformShell>
  );
}
