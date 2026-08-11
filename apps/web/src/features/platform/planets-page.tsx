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
  const totalWorks = useMemo(
    () => planets.reduce((acc, p) => acc + (p.workCount || 0), 0),
    [planets],
  );

  return (
    <PlatformShell immersive>
      <div className="relative overflow-hidden border-b border-border/60 bg-background/80 backdrop-blur-3xl">
        <div
          className="pointer-events-none absolute -top-32 right-1/3 size-150 rounded-full bg-primary/15 blur-[160px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute top-1/2 -left-20 size-112.5 -translate-y-1/2 rounded-full bg-purple-600/10 blur-[150px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-size-[32px_32px]"
          aria-hidden="true"
        />

        <header className="relative mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20 lg:py-24">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="mt-6 text-3xl font-heading font-semibold leading-normal sm:text-5xl lg:text-6xl">
                اعبر البوابة إلى <br />
                <span className="bg-linear-to-l from-primary via-purple-300 to-amber-200 bg-clip-text text-transparent">
                  عالمك المفضل.
                </span>
              </h1>

              {/* Fixed typo: "يتشكل مدار كل كوكب" instead of "كوكب كل كوكب" */}
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg sm:leading-8">
                الكواكب ليست مجرد تصنيفات، بل هي وجهات سينمائية تضم أفلامك، مسلسلاتك، وأعمال الأنمي
                المفضلة. يتشكل مدار كل كوكب بحسب ثقل الأرشيف المكتنز داخله.
              </p>
            </div>

            <div className="inline-flex items-center rounded-2xl border border-border/75 bg-card/40 p-2.5 backdrop-blur-2xl shadow-2xl shadow-black/40">
              <div className="flex items-center gap-3.5 px-4 py-1 border-e">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                  <PlanetIcon weight="duotone" className="size-5" />
                </div>
                <div>
                  <div className="font-mono text-2xl font-extrabold leading-none tracking-tight">
                    {planets.length}
                  </div>
                  <span className="mt-1 block text-[11px] font-medium text-muted-foreground/80">
                    كوكب نشط
                  </span>
                </div>
              </div>

              {/* Total Works Metric */}
              <div className="flex items-center gap-3.5 px-4 py-1">
                <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/25">
                  <FilmStripIcon weight="duotone" className="size-5" />
                </div>
                <div>
                  <div className="font-mono text-2xl font-extrabold leading-none tracking-tight">
                    {totalWorks}
                  </div>
                  <span className="mt-1 block text-[11px] font-medium text-muted-foreground/80">
                    عمل وسائطي
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {planets.map((planet, index) => {
            const primaryColor = planet.primaryColor || "#6366f1";
            const secondaryColor = planet.secondaryColor || "#f59e0b";
            const worksList = planet.works || [];
            const featuredBanner = worksList[0]?.bannerPath || worksList[0]?.imagePath;

            return (
              <Link
                key={planet.id}
                to="/planets/$planetSlug"
                params={{ planetSlug: planet.slug }}
                style={
                  {
                    "--planet-color": primaryColor,
                    "--planet-secondary": secondaryColor,
                  } as React.CSSProperties
                }
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-card/50 p-6 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-white/20 hover:shadow-2xl hover:shadow-black/60"
              >
                {/* Ambient Background Radial Light */}
                <div
                  className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full blur-[100px] opacity-20 transition-opacity duration-700 group-hover:opacity-40"
                  style={{ background: primaryColor }}
                  aria-hidden="true"
                />

                <div>
                  {/* Card Header: Orbit Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-1 font-mono text-xs font-semibold backdrop-blur-md transition-colors"
                      style={{
                        backgroundColor: `${primaryColor}12`,
                        borderColor: `${primaryColor}30`,
                        color: primaryColor,
                      }}
                    >
                      <span
                        className="size-1.5 rounded-full shadow-[0_0_8px_currentColor] animate-pulse"
                        style={{ background: primaryColor }}
                      />
                      كوكب {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  {/* Centerpiece: Celestial Planet Portal */}
                  <div className="my-7 flex items-center justify-center">
                    <div className="relative flex items-center justify-center">
                      {/* Animated Dashed Orbit Ring */}
                      <div
                        className="absolute -inset-5 rounded-full border border-dashed opacity-25 transition-all duration-1000 ease-out group-hover:scale-110 group-hover:rotate-90 group-hover:opacity-60"
                        style={{ borderColor: primaryColor }}
                        aria-hidden="true"
                      />

                      {/* Orbiting Satellite Dot */}
                      <div
                        className="absolute -top-3 left-3 size-3 rounded-full shadow-[0_0_12px_currentColor] transition-transform duration-700 group-hover:-translate-x-3 group-hover:-translate-y-1"
                        style={{ color: secondaryColor, background: secondaryColor }}
                        aria-hidden="true"
                      />

                      {/* Planet Core Sphere */}
                      <div
                        className="relative flex size-28 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-background shadow-2xl transition-all duration-500 group-hover:scale-105"
                        style={{ boxShadow: `0 16px 50px ${primaryColor}30` }}
                      >
                        {featuredBanner && (
                          <img
                            src={featuredBanner}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 size-full object-cover blur-[2px] opacity-40 transition-all duration-700 group-hover:scale-125 group-hover:opacity-60"
                          />
                        )}

                        <div
                          className="absolute inset-0 mix-blend-color opacity-60"
                          style={{ background: primaryColor }}
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-background/90 via-background/20 to-transparent" />

                        {/* Planet Icon */}
                        <span className="relative text-4xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] transition-transform duration-500 group-hover:scale-110">
                          {planet.icon || (
                            <PlanetIcon weight="duotone" className="size-10 text-white" />
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="text-center sm:text-right pt-4!">
                    {/* Title colored dynamically using primaryColor */}
                    <h2
                      className="font-heading text-2xl font-bold tracking-tight transition-all duration-300 group-hover:drop-shadow-[0_2px_10px_currentColor]"
                      style={{ color: primaryColor }}
                    >
                      {planet.nameAr}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground/80">
                      {planet.description || "استكشف الأعمال والأفلام والمسلسلات داخل هذا الكوكب."}
                    </p>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-8 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between">
                    {/* Poster Stack Preview */}
                    <div className="flex items-center gap-2.5">
                      {worksList.length > 0 ? (
                        <div className="flex items-center">
                          {worksList.slice(0, 3).map((preview, pIdx) => {
                            const poster = preview.imagePath || preview.bannerPath;
                            return (
                              <div
                                key={preview.id || pIdx}
                                className={cn(
                                  "relative h-9 w-6 overflow-hidden rounded-md border border-white/20 bg-muted shadow-lg transition-transform duration-300 group-hover:-translate-y-1",
                                  pIdx > 0 && "-ms-2.5",
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
                                  <div className="flex size-full items-center justify-center bg-muted/80">
                                    <FilmStripIcon
                                      weight="thin"
                                      className="size-3 text-muted-foreground"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex size-7 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                          <PopcornIcon
                            weight="duotone"
                            className="size-3.5 text-muted-foreground"
                          />
                        </div>
                      )}

                      <span className="font-mono text-xs font-semibold text-muted-foreground/80">
                        {planet.workCount || 0} عمل
                      </span>
                    </div>

                    {/* CTA Button colored with primaryColor */}
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-bold transition-transform duration-300 group-hover:translate-x-0.5"
                      style={{ color: primaryColor }}
                    >
                      اعبر البوابة
                      <ArrowLeftIcon
                        weight="bold"
                        className="size-3.5 transition-transform duration-300 group-hover:-translate-x-1"
                      />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </PlatformShell>
  );
}
