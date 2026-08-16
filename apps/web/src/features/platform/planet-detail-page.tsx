import { ArrowRightIcon, ImageIcon, ImageSquareIcon, PanoramaIcon } from "@phosphor-icons/react";
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

const SORT_LABELS: Record<string, string> = {
  ranked: "الأعلى تقييماً أولاً",
  added: "الأحدث إضافةً أولاً",
  oldest: "الأقدم إصداراً أولاً",
  newest: "الأحدث إصداراً أولاً",
};

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
      <section
        className="relative isolate overflow-hidden border-b border-white/10"
        style={
          {
            "--planet-color": planet.primaryColor,
            "--planet-secondary": planet.secondaryColor,
          } as React.CSSProperties
        }
      >
        {/* Dynamic Radial Ambient Light */}
        <div
          className="pointer-events-none absolute inset-0 -z-20 opacity-80"
          style={{
            background: `radial-gradient(circle at 75% 20%, ${planet.primaryColor}44, transparent 35rem), linear-gradient(135deg, ${planet.secondaryColor}18, transparent 60%)`,
          }}
          aria-hidden="true"
        />

        <div className="archive-grid pointer-events-none absolute inset-0 -z-10 opacity-40" />

        <div className="mx-auto max-w-7xl px-5 pb-12 pt-24 sm:px-8 sm:pb-10 sm:pt-28">
          {/* Back Link */}
          <Link
            to="/planets"
            className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            <span>كل الكواكب</span>
          </Link>

          {/* Planet Info Header */}
          <div className="mt-8 flex max-w-3xl items-start gap-5 sm:gap-6">
            {/* Planet Avatar Icon */}
            <span
              className="flex size-16 shrink-0 items-center justify-center rounded-2xl border text-3xl shadow-2xl backdrop-blur-md sm:size-20 sm:rounded-3xl sm:text-4xl"
              style={{
                borderColor: `${planet.primaryColor}80`,
                background: `${planet.primaryColor}15`,
                boxShadow: `0 0 50px ${planet.primaryColor}25`,
              }}
            >
              {planet.icon}
            </span>

            <div className="space-y-2">
              {/* Eyebrow Badge */}
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 font-mono text-xs font-semibold backdrop-blur-sm"
                  style={{
                    backgroundColor: `${planet.primaryColor}12`,
                    borderColor: `${planet.primaryColor}30`,
                    color: planet.primaryColor,
                  }}
                >
                  {planet.nameEn && planet.nameEn}
                  <span
                    className="size-1.5 rounded-full animate-pulse"
                    style={{ background: planet.primaryColor }}
                  />
                </span>
              </div>

              {/* Titles */}
              <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                {planet.nameAr}
              </h1>
            </div>
          </div>

          {/* Description */}
          {planet.description && (
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/80 sm:text-lg sm:leading-8">
              {planet.description}
            </p>
          )}

          {/* Controls Toolbar */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-6">
            <p className="text-xs text-muted-foreground sm:text-sm">
              <span className="font-semibold text-foreground">{planet.workCount || 0}</span> عمل ·{" "}
              <span>{SORT_LABELS[sort] || SORT_LABELS.newest}</span>
            </p>

            <div className="flex flex-wrap items-center gap-4">
              {/* View Switcher */}
              <div className="flex items-center gap-2" dir="rtl">
                <span className="text-xs font-medium text-muted-foreground">العرض</span>
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
                  <ToggleGroupItem value="poster" aria-label="عرض بوستر" className="px-2.5">
                    <ImageIcon className="size-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="banner" aria-label="عرض بانر" className="px-2.5">
                    <PanoramaIcon className="size-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="logo" aria-label="عرض شعار" className="px-2.5">
                    <ImageSquareIcon className="size-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Sort Switcher */}
              <div className="flex items-center gap-2" dir="rtl">
                <span className="text-xs font-medium text-muted-foreground">الترتيب</span>
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
                  <ToggleGroupItem value="added" className="px-3 text-xs">
                    الجديد
                  </ToggleGroupItem>
                  <ToggleGroupItem value="newest" className="px-3 text-xs">
                    الأحدث
                  </ToggleGroupItem>
                  <ToggleGroupItem value="oldest" className="px-3 text-xs">
                    الأقدم
                  </ToggleGroupItem>
                  <ToggleGroupItem value="ranked" className="px-3 text-xs">
                    التقييم
                  </ToggleGroupItem>
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
