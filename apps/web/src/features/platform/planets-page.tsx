import { ArrowLeftIcon, FilmStripIcon, PlanetIcon, PopcornIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getPlanets } from "@/server/platform.functions";
import { PlatformShell } from "./components/platform-shell";

export function PlanetsPage() {
  const { data: planets } = useSuspenseQuery({
    queryKey: ["planets"],
    queryFn: () => getPlanets(),
  });

  const sortedPlanets = useMemo(
    () => [...planets].sort((a, b) => (b.workCount || 0) - (a.workCount || 0)),
    [planets],
  );

  const totalWorks = useMemo(
    () => planets.reduce((acc, planet) => acc + (planet.workCount || 0), 0),
    [planets],
  );

  return (
    <PlatformShell immersive>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60 bg-background">
        <div
          className="pointer-events-none absolute -top-40 right-1/3 size-120 rounded-full bg-primary/8 blur-[140px]"
          aria-hidden="true"
        />

        <div
          className="pointer-events-none absolute -bottom-32 -left-20 size-100 rounded-full bg-primary/5 blur-[130px]"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl px-6 py-14 sm:px-8 sm:py-18 lg:py-20">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            {/* Intro */}
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-primary/50" />

                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                  أرشيف الكواكب
                </span>
              </div>

              <h1 className="mt-5 font-heading text-4xl font-semibold leading-normal tracking-tight sm:text-5xl lg:text-6xl">
                اعبر البوابة إلى
                <br />
                <span className="text-muted-foreground">عالمك المفضل.</span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                الكواكب ليست مجرد تصنيفات، بل وجهات سينمائية تضم أفلامك، مسلسلاتك، وأعمال الأنمي
                المفضلة. يكبر مدار كل كوكب بقدر ما يحتفظ به من أعمال.
              </p>
            </div>

            {/* Stats */}
            <div className="flex w-fit items-center rounded-2xl border border-border/70 bg-card/50 p-1.5 shadow-sm backdrop-blur-xl">
              <div className="flex items-center gap-3 px-3.5 py-2.5 sm:px-4">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <PlanetIcon weight="duotone" className="size-4.5" />
                </div>

                <div>
                  <div className="font-mono text-xl font-semibold leading-none">
                    {planets.length}
                  </div>

                  <span className="mt-1 block text-[10px] text-muted-foreground">كوكب نشط</span>
                </div>
              </div>

              <div className="h-9 w-px bg-border/70" />

              <div className="flex items-center gap-3 px-3.5 py-2.5 sm:px-4">
                <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <FilmStripIcon weight="duotone" className="size-4.5" />
                </div>

                <div>
                  <div className="font-mono text-xl font-semibold leading-none">{totalWorks}</div>

                  <span className="mt-1 block text-[10px] text-muted-foreground">عمل وسائطي</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Planet collection */}
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedPlanets.map((planet, index) => {
            const primaryColor = planet.primaryColor || "#6366f1";
            const secondaryColor = planet.secondaryColor || "#f59e0b";
            const works = planet.works || [];
            const featuredArtwork = works[0]?.bannerPath || works[0]?.imagePath;

            return (
              <Link
                key={planet.id}
                to="/planets/$planetSlug"
                params={{ planetSlug: planet.slug }}
                className="
                  group relative flex min-h-95 flex-col overflow-hidden
                  rounded-2xl border border-border/70
                  bg-card/50 p-2.5
                  transition-all duration-300
                  hover:-translate-y-1
                  hover:border-border
                  hover:bg-card
                  hover:shadow-xl hover:shadow-black/5
                  focus-visible:outline-none
                  focus-visible:ring-2 focus-visible:ring-ring
                  motion-reduce:transition-none
                "
              >
                {/* Artwork */}
                <div className="relative aspect-[1.45] overflow-hidden rounded-xl bg-muted">
                  {featuredArtwork ? (
                    <img
                      src={featuredArtwork}
                      alt=""
                      loading="lazy"
                      className="
                        absolute inset-0 size-full
                        scale-105 object-cover
                        blur-[5px]
                        opacity-60
                        saturate-[0.75]
                        transition duration-500
                        group-hover:scale-[1.08]
                        group-hover:opacity-70
                        motion-reduce:transition-none
                      "
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `
                          radial-gradient(
                            circle at 50% 20%,
                            ${secondaryColor}20,
                            transparent 45%
                          ),
                          linear-gradient(
                            135deg,
                            ${primaryColor}20,
                            transparent 70%
                          )
                        `,
                      }}
                    />
                  )}

                  {/* Atmospheric tint */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `
                        linear-gradient(
                          180deg,
                          ${primaryColor}08 0%,
                          ${primaryColor}12 45%,
                          hsl(var(--background) / 0.94) 100%
                        )
                      `,
                    }}
                  />

                  {/* Top row */}
                  <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                    <span
                      className="
                        flex size-7 items-center justify-center
                        rounded-full border border-white/10
                        bg-black/20
                        text-[9px] font-medium text-white/75
                        backdrop-blur-md
                      "
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span
                      className="
                        rounded-full border border-white/10
                        bg-black/20 px-2 py-0.5
                        text-[9px] font-medium text-white/75
                        backdrop-blur-md
                      "
                    >
                      {planet.workCount || 0} عمل
                    </span>
                  </div>

                  {/* Planet icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="
                        flex size-16 items-center justify-center
                        rounded-full
                        border border-white/10
                        bg-black/10
                        text-3xl
                        shadow-2xl
                        backdrop-blur-sm
                        transition duration-300
                        group-hover:scale-105
                        motion-reduce:transition-none
                      "
                      style={{
                        boxShadow: `0 14px 45px ${primaryColor}30`,
                      }}
                    >
                      {planet.icon || <PlanetIcon weight="duotone" className="size-9 text-white" />}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col px-1.5 pb-0.5 pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: primaryColor }}
                        />

                        <h2 className="truncate font-heading text-lg font-semibold tracking-tight">
                          {planet.nameAr}
                        </h2>
                      </div>

                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {planet.description ||
                          "استكشف الأعمال والأفلام والمسلسلات داخل هذا الكوكب."}
                      </p>
                    </div>

                    <span
                      className="
                        flex size-8 shrink-0 items-center justify-center
                        rounded-full border border-border/70
                        text-muted-foreground
                        transition-all duration-300
                        group-hover:border-border
                        group-hover:bg-muted
                        group-hover:text-foreground
                        motion-reduce:transition-none
                      "
                      aria-hidden="true"
                    >
                      <ArrowLeftIcon
                        weight="bold"
                        className="
                          size-3.5
                          transition-transform duration-300
                          group-hover:-translate-x-0.5
                          motion-reduce:transition-none
                        "
                      />
                    </span>
                  </div>

                  <div className="mt-auto border-t border-border/50 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      {/* Preview */}
                      <div className="flex min-w-0 items-center">
                        {works.length > 0 ? (
                          <div className="flex items-center">
                            {works.slice(0, 3).map((preview, previewIndex) => {
                              const poster = preview.imagePath || preview.bannerPath;

                              return (
                                <span
                                  key={preview.id || previewIndex}
                                  className={cn(
                                    "relative size-7 overflow-hidden rounded-md border-2 border-card bg-muted",
                                    previewIndex > 0 && "-ms-1.5",
                                  )}
                                >
                                  {poster ? (
                                    <img
                                      src={poster}
                                      alt=""
                                      loading="lazy"
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    <span className="flex size-full items-center justify-center">
                                      <FilmStripIcon
                                        weight="thin"
                                        className="size-3 text-muted-foreground"
                                      />
                                    </span>
                                  )}
                                </span>
                              );
                            })}

                            {works.length > 3 && (
                              <span
                                className="
                                  -ms-1.5 flex size-7 items-center justify-center
                                  rounded-md border-2 border-card
                                  bg-muted text-[8px] font-medium
                                  text-muted-foreground
                                "
                              >
                                +{works.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-muted">
                            <PopcornIcon
                              weight="duotone"
                              className="size-3.5 text-muted-foreground"
                            />
                          </span>
                        )}

                        <span className="ms-2.5 text-[11px] font-medium text-muted-foreground">
                          {planet.workCount || 0} عمل
                        </span>
                      </div>

                      <span
                        className="
                          inline-flex shrink-0 items-center gap-1.5
                          text-[10px] font-semibold
                          text-muted-foreground
                          transition-colors
                          group-hover:text-foreground
                        "
                      >
                        استكشف العالم
                        <ArrowLeftIcon
                          weight="bold"
                          className="
                            size-3
                            transition-transform duration-300
                            group-hover:-translate-x-0.5
                            motion-reduce:transition-none
                          "
                        />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Planet accent */}
                <span
                  className="
                    absolute inset-x-4 bottom-0 h-px
                    opacity-0 transition-opacity duration-300
                    group-hover:opacity-100
                    motion-reduce:transition-none
                  "
                  style={{ backgroundColor: primaryColor }}
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </main>
    </PlatformShell>
  );
}
