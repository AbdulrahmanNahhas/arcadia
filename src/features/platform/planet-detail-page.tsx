import { ArrowRightIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Work } from "@/features/library/model";
import { getPlanetDetail } from "@/server/platform.functions";
import { PlatformShell } from "./components/platform-shell";
import { WorkCard } from "./components/work-card";

type WorkView = "poster" | "banner" | "logo";
type WorkSort = "added" | "newest" | "oldest" | "ranked";

function releaseTimestamp(work: Work) {
  const exact = work.releaseStart ? Date.parse(`${work.releaseStart}T00:00:00Z`) : Number.NaN;
  return Number.isFinite(exact) ? exact : (work.year ?? 0) * 31_536_000_000;
}

function sortWorks(works: Work[], sort: WorkSort) {
  return [...works].sort((left, right) => {
    if (sort === "ranked") {
      return (
        (right.calculatedRating ?? -1) - (left.calculatedRating ?? -1) ||
        right.addedAt - left.addedAt
      );
    }
    if (sort === "added") return right.addedAt - left.addedAt;
    const comparison = releaseTimestamp(left) - releaseTimestamp(right);
    return (sort === "newest" ? -comparison : comparison) || right.addedAt - left.addedAt;
  });
}

export function PlanetDetailPage({ slug }: { slug: string }) {
  const [view, setView] = useState<WorkView>("poster");
  const [sort, setSort] = useState<WorkSort>("added");
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
        <div className="mx-auto max-w-400 px-5 pb-16 pt-32 sm:px-8 sm:pb-8">
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
                كوكب نحّاسينما
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
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {planet.workCount} عمل ·{" "}
              {sort === "ranked"
                ? "الأعلى تقييماً أولاً"
                : sort === "added"
                  ? "الأحدث إضافةً أولاً"
                  : sort === "oldest"
                    ? "الأقدم إصداراً أولاً"
                    : "الأحدث إصداراً أولاً"}
            </p>
            <div className="order-first flex flex-wrap items-center gap-3" dir="ltr">
              <div className="flex items-center gap-2" dir="rtl">
                <span className="text-xs text-muted-foreground">العرض</span>
                <ToggleGroup
                  value={[view]}
                  multiple={false}
                  variant="outline"
                  size="sm"
                  spacing={0}
                  aria-label="طريقة عرض الأعمال"
                  onValueChange={(values) => {
                    const next = values[0] as WorkView | undefined;
                    if (next) setView(next);
                  }}
                >
                  <ToggleGroupItem value="poster">بوستر</ToggleGroupItem>
                  <ToggleGroupItem value="banner">خلفية</ToggleGroupItem>
                  <ToggleGroupItem value="logo">شعار</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="flex items-center gap-2" dir="rtl">
                <span className="text-xs text-muted-foreground">الترتيب</span>
                <ToggleGroup
                  value={[sort]}
                  multiple={false}
                  variant="outline"
                  size="sm"
                  spacing={0}
                  aria-label="ترتيب الأعمال"
                  onValueChange={(values) => {
                    const next = values[0] as WorkSort | undefined;
                    if (next) setSort(next);
                  }}
                >
                  <ToggleGroupItem value="added">الجديد</ToggleGroupItem>
                  <ToggleGroupItem value="newest">الأحدث</ToggleGroupItem>
                  <ToggleGroupItem value="oldest">الأقدم</ToggleGroupItem>
                  <ToggleGroupItem value="ranked">التقييم</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-400 px-5 pb-28 pt-10 sm:px-8">
        {planet.works.length ? (
          <div
            className={
              view === "banner"
                ? "grid grid-cols-1 gap-y-12 gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : view === "logo"
                  ? "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7"
                  : "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7"
            }
          >
            {sortWorks(planet.works, sort).map((work) => (
              <WorkCard key={work.id} work={work} variant={view} />
            ))}
          </div>
        ) : (
          <Empty className="min-h-80 border border-dashed border-white/10">
            <EmptyHeader>
              <EmptyTitle>هذا الكوكب بانتظار أول عمل</EmptyTitle>
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
