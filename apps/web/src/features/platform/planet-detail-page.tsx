import { ArrowRightIcon, ImageIcon, ImageSquareIcon, PanoramaIcon } from "@phosphor-icons/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type * as React from "react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCurrentAccount } from "@/features/accounts/api";
import type { Work } from "@/features/library/model";
import { getAdminPlanets, getPlanets } from "@/server/platform.functions";
import { PlatformShell } from "./components/platform-shell";
import { WorkCard } from "./components/work-card";

type WorkView = "poster" | "banner" | "logo";
type WorkSort = "newest" | "oldest" | "ranked";
type Privacy = "public" | "all" | "private";

const SORT_LABELS = {
  ranked: "الأعلى تقييماً أولاً",
  oldest: "الأقدم إصداراً أولاً",
  newest: "الأحدث إصداراً أولاً",
} satisfies Record<WorkSort, string>;

const PRIVACY_LABELS = {
  public: "العامة",
  private: "الخاصة",
  all: "الكل",
} satisfies Record<Privacy, string>;

function releaseTimestamp(work: Work) {
  const exact = work.releaseStart ? Date.parse(`${work.releaseStart}T00:00:00Z`) : Number.NaN;

  return Number.isFinite(exact) ? exact : (work.year ?? 0) * 31_536_000_000;
}

function sortWorks(works: Work[], sort: WorkSort) {
  return works.toSorted((left, right) => {
    if (sort === "ranked") {
      return (
        (right.calculatedRating ?? -1) - (left.calculatedRating ?? -1) ||
        right.addedAt - left.addedAt
      );
    }

    const comparison = releaseTimestamp(left) - releaseTimestamp(right);

    return (sort === "newest" ? -comparison : comparison) || right.addedAt - left.addedAt;
  });
}

export function PlanetDetailPage({ slug }: { slug: string }) {
  const [view, setView] = useState<WorkView>("poster");
  const [sort, setSort] = useState<WorkSort>("newest");
  const [privacy, setPrivacy] = useState<Privacy>("public");

  const { data: accountData } = useCurrentAccount();
  const isAdmin = accountData?.account.role === "owner" || accountData?.account.role === "editor";

  const { data: publicPlanets } = useSuspenseQuery({
    queryKey: ["planets"],
    queryFn: () => getPlanets(),
  });
  // Admins see private works too — the public planets feed hard-excludes them, so this page
  // re-fetches from the admin-only planets endpoint once we know the viewer can see them.
  const { data: adminPlanets } = useQuery({
    queryKey: ["planets", "admin"],
    queryFn: () => getAdminPlanets(),
    enabled: isAdmin,
  });
  const planets = isAdmin && adminPlanets ? adminPlanets : publicPlanets;
  const planet = planets.find((item) => item.slug === slug) ?? null;

  const visibleWorks = useMemo(() => {
    return (planet?.works || []).filter(
      (w) => privacy === "all" || (privacy === "private" ? w.isPrivate : !w.isPrivate),
    );
  }, [planet, privacy]);

  if (!planet) {
    return (
      <PlatformShell>
        <div className="mx-auto max-w-3xl px-5 py-32">تعذر العثور على هذا الكوكب.</div>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell immersive>
      <section
        className="relative isolate overflow-hidden border-b border-white/10"
        style={
          // SAFETY: `--planet-color`/`--planet-secondary` are CSS custom properties, which
          // `CSSProperties` doesn't declare — the cast only widens `style` to accept the same
          // underlying `Record<string, string>` these two extra keys need.
          {
            "--planet-color": planet.primaryColor,
            "--planet-secondary": planet.secondaryColor,
          } as React.CSSProperties
        }
      >
        <div
          className="pointer-events-none absolute inset-0 -z-20 opacity-80"
          style={{
            background: `radial-gradient(circle at 75% 20%, ${planet.primaryColor}44, transparent 35rem), linear-gradient(135deg, ${planet.secondaryColor}18, transparent 60%)`,
          }}
          aria-hidden="true"
        />

        <div className="archive-grid pointer-events-none absolute inset-0 -z-10 opacity-40" />

        <div className="mx-auto max-w-7xl px-5 pb-12 pt-24 sm:px-8 sm:pb-10 sm:pt-28">
          <Link
            to="/planets"
            className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            <span>كل الكواكب</span>
          </Link>

          <div className="mt-8 flex max-w-3xl items-start gap-5 sm:gap-6">
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
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 font-mono text-xs font-semibold backdrop-blur-sm"
                  style={{
                    backgroundColor: `${planet.primaryColor}12`,
                    borderColor: `${planet.primaryColor}30`,
                    color: planet.primaryColor,
                  }}
                >
                  {planet.nameEn}
                  <span
                    className="size-1.5 animate-pulse rounded-full"
                    style={{ background: planet.primaryColor }}
                  />
                </span>
              </div>

              <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                {planet.nameAr}
              </h1>
            </div>
          </div>

          {planet.description && (
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/80 sm:text-lg sm:leading-8">
              {planet.description}
            </p>
          )}

          {isAdmin && (
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm hover:bg-card">
                  {PRIVACY_LABELS[privacy]}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setPrivacy("public")}>
                    {PRIVACY_LABELS.public}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPrivacy("all")}>
                    {PRIVACY_LABELS.all}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPrivacy("private")}>
                    {PRIVACY_LABELS.private}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Badge variant="outline">وضع المدير</Badge>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-6">
            <p className="text-xs text-muted-foreground sm:text-sm">
              <span className="font-semibold text-foreground">{visibleWorks.length}</span> عمل ·{" "}
              <span>{SORT_LABELS[sort]}</span>
            </p>

            <div className="flex flex-wrap items-center gap-4">
              {/* View */}
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
                    // SAFETY: the `ToggleGroupItem`s below only offer "poster"/"banner"/"logo" —
                    // the same union as `WorkView` — so `values[0]` is one of them or undefined.
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

              {/* Sort */}
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
                    // SAFETY: the `ToggleGroupItem`s below only offer "newest"/"oldest"/"ranked"
                    // — the same union as `WorkSort` — so `values[0]` is one of them or undefined.
                    const next = values[0] as WorkSort | undefined;
                    if (next) setSort(next);
                  }}
                >
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
        {visibleWorks.length ? (
          <div
            className={
              view === "banner"
                ? "grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7"
            }
          >
            {sortWorks(visibleWorks, sort).map((work) => (
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
