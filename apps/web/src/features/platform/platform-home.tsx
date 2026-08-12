import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { PlanetWithWorks } from "@/features/platform/model";
import { currentProfile } from "@/features/profiles/model";
import { cn } from "@/lib/utils";
import { getAdminWatchRadar, getPlatformHome } from "@/server/platform.functions";
import { PlatformShell } from "./components/platform-shell";
import { WatchRadarHero } from "./components/watch-radar-hero";
import { WorkRail } from "./components/work-rail";

export function PlatformHome() {
  const { data } = useSuspenseQuery({
    queryKey: ["platform-home"],
    queryFn: () => getPlatformHome(),
  });
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => setIsAdmin(currentProfile().accountKind === "admin"), []);
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
        {/*{data.continueExploring.length > 0 && (
          <WorkRail
            title="واصل الاستكشاف"
            description="الأعمال التي تركتها مفتوحة تنتظرك هنا."
            works={data.continueExploring}
            variant="banner"
          />
        )}*/}

        <PlanetIndex planets={data.planets} />

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

const portalSizes = [
  "size-40 sm:size-48",
  "size-32 sm:size-40",
  "size-44 sm:size-52",
  "size-36 sm:size-44",
  "size-40 sm:size-48",
] as const;

function PlanetIndex({ planets }: { planets: PlanetWithWorks[] }) {
  return (
    <section className="relative overflow-hidden py-0" aria-labelledby="planet-index-title">
      <div className="mx-auto flex max-w-400 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary">خريطة أرشيفك</p>
          <h2
            id="planet-index-title"
            className="mt-3 font-heading text-3xl leading-tight font-semibold sm:text-4xl"
          >
            لا قوائم هنا. اعبر من بوابة إلى عالم.
          </h2>
        </div>
      </div>

      <div className="relative mt-10  overflow-visible bg-card/10 p-0 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle,currentColor_1px,transparent_1px)] before:bg-size-[42px_42px] before:text-foreground before:opacity-[0.04]">
        <div className="pointer-events-none absolute inset-x-0 top-2/5 h-px bg-linear-to-r from-transparent via-primary/20 to-transparent" />
        <div className="flex snap-x snap-mandatory items-center gap-8 pb-6 pt-14 px-10! overflow-x-auto scrollbar-none sm:gap-12">
          {planets.map((planet, index) => {
            const artwork = planet.works[0]?.bannerPath || planet.works[0]?.imagePath;
            return (
              <Link
                key={planet.id}
                to="/planets/$planetSlug"
                params={{ planetSlug: planet.slug }}
                className={cn(
                  "group/planet flex w-48 shrink-0 snap-center flex-col items-center text-center focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-ring",
                  index % 2 === 0 ? "-translate-y-5" : "translate-y-5",
                )}
              >
                <span
                  className={cn(
                    "relative flex items-center justify-center rounded-full bg-card shadow-2xl ring-1 ring-white/12 transition duration-500 ease-out group-hover/planet:-translate-y-2 group-hover/planet:scale-105 group-hover/planet:ring-white/35 motion-reduce:transition-none",
                    portalSizes[index % portalSizes.length],
                  )}
                  style={{ boxShadow: `0 24px 70px ${planet.primaryColor}28` }}
                >
                  <span
                    className="absolute -inset-3 rotate-3 rounded-full border border-dashed opacity-35 transition duration-700 group-hover/planet:rotate-12 group-hover/planet:opacity-70 motion-reduce:transition-none"
                    style={{ borderColor: planet.primaryColor }}
                    aria-hidden="true"
                  />
                  <span
                    className="absolute -top-3 left-12 size-2.5 rounded-full shadow-[0_0_16px_currentColor] transition-transform duration-700 group-hover/planet:-top-4 group-hover/planet:translate-x-8"
                    style={{ color: planet.secondaryColor, background: planet.secondaryColor }}
                    aria-hidden="true"
                  />
                  <span className="absolute inset-0 overflow-hidden rounded-full">
                    {artwork && (
                      <img
                        src={artwork}
                        alt=""
                        loading="lazy"
                        className="absolute blur-md inset-0 size-full object-cover transition duration-700 group-hover/planet:scale-110"
                      />
                    )}
                    <span
                      className="absolute inset-0 opacity-75 mix-blend-multiply"
                      style={{ background: planet.primaryColor }}
                    />
                    <span className="absolute inset-0 bg-linear-to-t from-background/85 via-background/15 to-white/10" />
                    <span className="absolute inset-3 rounded-full border border-white/12" />
                  </span>
                  <span className="relative text-4xl drop-shadow-xl" aria-hidden="true">
                    {planet.icon}
                  </span>
                </span>
                <strong className="mt-4 font-heading text-base font-semibold transition group-hover/planet:text-primary">
                  {planet.nameAr}
                </strong>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {planet.workCount} عمل
                  {planet.reviewCount > 0 && `· ${planet.reviewCount} للمراجعة`}
                  <ArrowLeftIcon className="transition-transform group-hover/planet:-translate-x-1" />
                </span>
                {planet.works.length > 0 && (
                  <span className="mt-3 flex items-center" aria-hidden="true">
                    {planet.works.slice(0, 3).map((preview, previewIndex) => (
                      <span
                        key={preview.id}
                        className={cn(
                          "relative w-7 h-auto overflow-hidden rounded-lg bg-muted ring-2 ring-background transition-transform duration-300 group-hover/planet:-translate-y-1",
                          previewIndex > 0 && "-ms-2",
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
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
