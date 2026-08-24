import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCurrentAccount } from "@/features/accounts/api";
import type { PlanetWithWorks } from "@/features/platform/model";
import { cn } from "@/lib/utils";
import { getAdminWatchRadar, getPlatformHome } from "@/server/platform.functions";
import { FamilyActivityRail } from "./components/family-activity-rail";
import { PlatformShell } from "./components/platform-shell";
import { WatchRadarHero } from "./components/watch-radar-hero";
import { WorkRail } from "./components/work-rail";

export function PlatformHome() {
  const { data: accountData } = useCurrentAccount();
  const { data } = useSuspenseQuery({
    queryKey: ["platform-home"],
    queryFn: () => getPlatformHome(),
  });
  const isAdmin = accountData?.account.role === "owner" || accountData?.account.role === "editor";
  const { data: adminWatchRadar } = useQuery({
    queryKey: ["platform-home", "admin", "watch-radar"],
    queryFn: getAdminWatchRadar,
    enabled: isAdmin,
  });
  const populatedPlanets = data.planets.filter((planet) => planet.works.length > 0);
  const watchRadar = isAdmin && adminWatchRadar ? adminWatchRadar : data.watchRadar;

  return (
    <PlatformShell immersive>
      <WatchRadarHero works={watchRadar} />
      <div className="relative z-10 mx-auto -mt-8 flex flex-col gap-18 pb-28 lg:-mt-12 lg:gap-24 px-0">
        {data.continueExploring.length > 0 && (
          <WorkRail
            title="واصل الاستكشاف"
            description="الأعمال التي تركتها مفتوحة تنتظرك هنا."
            works={data.continueExploring}
            variant="banner"
          />
        )}

        <PlanetIndex planets={populatedPlanets} />
        <FamilyActivityRail items={data.familyActivity} />

        <WorkRail
          title="الأعلى تقييماً"
          description="أعمال صعدت وفق معاييرنا الخاصة، لا وفق قائمة عامة."
          works={data.highlyRated}
          variant="banner"
        />

        {populatedPlanets.length > 0 && (
          <section className="flex flex-col gap-16" aria-labelledby="planet-collections-title">
            {" "}
            {populatedPlanets.map((planet, index) => (
              <div
                key={planet.id}
                className={cn(
                  "relative before:absolute before:inset-y-0 before:w-px before:bg-linear-to-b before:from-transparent before:via-white/10 before:to-transparent",
                  index % 2 === 0 ? "before:inset-s-0" : "before:inset-e-0",
                )}
                style={{
                  background: `radial-gradient(circle at ${index % 2 === 0 ? "0%" : "100%"} 50%, ${planet.primaryColor}12, transparent 32%)`,
                }}
              >
                <WorkRail
                  title={`${planet.icon} ${planet.nameAr}`}
                  description={`${planet.workCount} عمل في هذا الكوكب · الأحدث عرضاً أولاً`}
                  works={planet.works.slice(0, (index - 1) % 3 === 1 ? 6 : 12)}
                  href={{ to: "/planets/$planetSlug", params: { planetSlug: planet.slug } }}
                  variant={(index - 1) % 3 === 1 ? "banner" : "poster"}
                />
              </div>
            ))}
          </section>
        )}
      </div>
    </PlatformShell>
  );
}

function PlanetIndex({ planets }: { planets: PlanetWithWorks[] }) {
  const sortedPlanets = [...planets].sort((a, b) => b.workCount - a.workCount);

  return (
    <section className="relative py-14 sm:py-16" aria-labelledby="planet-index-title">
      <div className="mx-auto max-w-400 px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border/60 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h2
              id="planet-index-title"
              className="mt-4 font-heading text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl"
            >
              لا قوائم هنا.
              <br />
              <span className="text-muted-foreground">اعبر من بوابة إلى عالم.</span>
            </h2>
          </div>

          <p className="max-w-xs text-sm leading-6 text-muted-foreground sm:text-end">
            كل عالم يجمع أعماله، أفكاره، وما ينتظر مراجعته.
          </p>
        </div>

        {/* Horizontal planet rail */}
        <div className="mt-7 overflow-hidden">
          <div className="flex scroll-fade-x gap-3 overflow-x-auto pb-4 scrollbar-none">
            {sortedPlanets.map((planet, index) => {
              const artwork = planet.works[0]?.bannerPath || planet.works[0]?.imagePath;

              return (
                <Link
                  key={planet.id}
                  to="/planets/$planetSlug"
                  params={{ planetSlug: planet.slug }}
                  className="
                    group relative flex w-[72vw] max-w-90 shrink-0
                    flex-col overflow-hidden rounded-2xl
                    border border-border/70 bg-card/50
                    p-2.5
                    transition-all duration-300
                    hover:-translate-y-1
                    hover:border-border
                    hover:bg-card
                    hover:shadow-xl hover:shadow-black/5
                    focus-visible:outline-none
                    focus-visible:ring-2 focus-visible:ring-ring
                    motion-reduce:transition-none
                    sm:w-80
                  "
                >
                  {/* Artwork */}
                  <div
                    className="
                      relative aspect-[1.5]
                      overflow-hidden rounded-xl
                      bg-muted
                    "
                  >
                    {artwork ? (
                      <img
                        src={artwork}
                        alt=""
                        loading="lazy"
                        className="
                          absolute inset-0
                          size-full
                          scale-105
                          object-cover
                          blur-[5px]
                          opacity-65
                          saturate-[0.75]
                          transition duration-500
                          group-hover:scale-[1.08]
                          group-hover:opacity-75
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
                              ${planet.secondaryColor}28,
                              transparent 45%
                            ),
                            linear-gradient(
                              135deg,
                              ${planet.primaryColor}22,
                              transparent 70%
                            )
                          `,
                        }}
                      />
                    )}

                    {/* Atmospheric overlay */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `
                          linear-gradient(
                            180deg,
                            ${planet.primaryColor}08 0%,
                            ${planet.primaryColor}12 50%,
                            hsl(var(--background) / 0.9) 100%
                          )
                        `,
                      }}
                    />

                    {/* Top metadata */}
                    <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                      <span
                        className="
                          flex size-7 items-center justify-center
                          rounded-full border border-white/10
                          bg-black/20 backdrop-blur-md
                          text-[9px] font-medium text-white/80
                        "
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <span
                        className="
                          rounded-full border border-white/10
                          bg-black/20 px-2 py-0.5
                          text-[9px] font-medium text-white/80
                          backdrop-blur-md
                        "
                      >
                        {planet.workCount} عمل
                      </span>
                    </div>

                    {/* Planet identity */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="
                          flex size-14 items-center justify-center
                          rounded-full
                          border border-white/10
                          bg-black/10
                          text-2xl
                          shadow-2xl
                          backdrop-blur-sm
                          transition duration-300
                          group-hover:scale-105
                          motion-reduce:transition-none
                        "
                      >
                        {planet.icon}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-1.5 pb-0.5 pt-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: planet.primaryColor }}
                          />

                          <h3 className="truncate font-heading text-[17px] font-semibold tracking-tight">
                            {planet.nameAr}
                          </h3>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{planet.workCount} عمل</span>

                          {planet.reviewCount > 0 && (
                            <>
                              <span className="text-border">•</span>
                              <span>{planet.reviewCount} للمراجعة</span>
                            </>
                          )}
                        </div>
                      </div>

                      <span
                        className="
                          mt-0.5 flex size-8 shrink-0 items-center justify-center
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
                          className="
                            size-3.5
                            transition-transform duration-300
                            group-hover:-translate-x-0.5
                            motion-reduce:transition-none
                          "
                        />
                      </span>
                    </div>

                    {/* Preview strip */}
                    {planet.works.length > 0 && (
                      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
                        <div className="flex items-center">
                          {planet.works.slice(0, 3).map((preview, previewIndex) => (
                            <span
                              key={preview.id}
                              className={cn(
                                "relative size-7 overflow-hidden rounded-md border-2 border-card bg-muted",
                                previewIndex > 0 && "-ms-1.5",
                              )}
                            >
                              {preview.imagePath && (
                                <img
                                  src={preview.imagePath}
                                  alt=""
                                  loading="lazy"
                                  className="size-full object-cover"
                                />
                              )}
                            </span>
                          ))}

                          {planet.works.length > 3 && (
                            <span
                              className="
                                -ms-1.5 flex size-7 items-center justify-center
                                rounded-md border-2 border-card
                                bg-muted text-[8px] font-medium
                                text-muted-foreground
                              "
                            >
                              +{planet.works.length - 3}
                            </span>
                          )}
                        </div>

                        <span
                          className="
                            text-[10px] text-muted-foreground
                            transition-colors
                            group-hover:text-foreground
                          "
                        >
                          استكشف العالم
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Planet accent */}
                  <span
                    className="
                      absolute inset-x-4 bottom-0 h-px
                      opacity-0 transition-opacity duration-300
                      group-hover:opacity-100
                      motion-reduce:transition-none
                    "
                    style={{ backgroundColor: planet.primaryColor }}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
