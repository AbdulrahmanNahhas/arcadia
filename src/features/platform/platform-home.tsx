import {
  ArrowLeftIcon,
  CompassIcon,
  DatabaseIcon,
  PlanetIcon,
  SparkleIcon,
  StarIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { Work } from "@/features/library/model";
import type { PlanetWithWorks } from "@/features/platform/model";
import { cn } from "@/lib/utils";
import { getPlatformHome } from "@/server/platform.functions";
import { PlatformShell } from "./components/platform-shell";
import { kindLabel } from "./components/work-card";
import { WorkRail } from "./components/work-rail";

export function PlatformHome() {
  const { data } = useSuspenseQuery({
    queryKey: ["platform-home"],
    queryFn: () => getPlatformHome(),
  });
  const populatedPlanets = data.planets.filter((planet) => planet.works.length > 0);

  return (
    <PlatformShell immersive>
      <FeaturedHero works={data.featured} />
      <div className="relative z-10 mx-auto -mt-8 flex flex-col gap-18 pb-28 lg:-mt-12 lg:gap-24 px-0">
        {/*{data.continueExploring.length > 0 && (
          <WorkRail
            title="واصل الاستكشاف"
            description="الأعمال التي تركتها مفتوحة تنتظرك هنا."
            works={data.continueExploring}
            variant="banner"
          />
        )}*/}

        <WorkRail
          title="وصل حديثاً إلى الأرشيف"
          description="آخر الأعمال التي أضفتها، من الأحدث إلى الأقدم."
          works={data.recentlyAdded}
        />

        <PlanetIndex planets={data.planets} />

        <WorkRail
          title="اختياراتك الأعلى تقييماً"
          description="أعمال صعدت وفق معاييرك أنت، لا وفق قائمة عامة."
          works={data.highlyRated}
          variant="banner"
        />

        {populatedPlanets.length > 0 && (
          <section className="flex flex-col gap-20" aria-labelledby="planet-collections-title">
            <div className="mx-auto w-full max-w-400 border-b border-white/10 pb-6 px-6">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-primary">
                <PlanetIcon weight="fill" /> من كل مدار
              </p>
              <h2
                id="planet-collections-title"
                className="mt-3 max-w-2xl font-heading text-3xl leading-tight font-semibold sm:text-4xl"
              >
                مجموعات تتبدّل إيقاعاتها مع محتواها.
              </h2>
            </div>

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
                  description={`${planet.workCount} عمل في هذا المدار · الأحدث عرضاً أولاً`}
                  works={planet.works}
                  href={{ to: "/planets/$planetSlug", params: { planetSlug: planet.slug } }}
                  variant={index % 3 === 1 ? "banner" : "poster"}
                />
              </div>
            ))}
          </section>
        )}
      </div>
    </PlatformShell>
  );
}

function FeaturedHero({ works }: { works: Work[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [isFocusInside, setIsFocusInside] = useState(false);
  const work = works[activeIndex] ?? works[0];
  const isPaused = isPointerInside || isFocusInside;

  useEffect(() => {
    if (
      works.length < 2 ||
      isPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setActiveIndex((activeIndex + 1) % works.length);
    }, 5_000);

    return () => window.clearTimeout(timeout);
  }, [activeIndex, isPaused, works.length]);

  if (!work) {
    return (
      <section className="archive-grid relative flex min-h-[72svh] items-center overflow-hidden px-6">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 20%, var(--primary) 0%, transparent 45%)",
          }}
          aria-hidden="true"
        />
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold tracking-[0.2em] text-primary">أرشيف نحّاسينما</p>
          <h1 className="mt-4 font-heading text-4xl leading-tight font-semibold sm:text-6xl">
            عوالمك، في خريطة واحدة.
          </h1>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative isolate min-h-[92svh] overflow-hidden sm:min-h-[96svh]"
      onPointerEnter={() => setIsPointerInside(true)}
      onPointerLeave={() => setIsPointerInside(false)}
      onFocusCapture={() => setIsFocusInside(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocusInside(false);
      }}
    >
      {works.map((candidate, index) => (
        <img
          key={candidate.id}
          src={candidate.bannerPath ?? undefined}
          alt=""
          fetchPriority={index === 0 ? "high" : "auto"}
          loading={index < 2 ? "eager" : "lazy"}
          className={cn(
            "absolute inset-0 -z-30 size-full object-cover object-center opacity-0 transition-opacity duration-1000 ease-in-out motion-reduce:transition-none",
            candidate.id === work.id && "opacity-100",
          )}
        />
      ))}
      <div className="absolute inset-0 -z-20 bg-linear-to-l from-background via-background/58 to-background/5" />
      <div className="absolute inset-0 -z-20 bg-linear-to-t from-background via-background/15 to-background/25" />
      <div
        className="absolute inset-y-0 inset-s-0 -z-10 w-2/3 bg-[radial-gradient(circle,var(--primary),transparent_70%)] opacity-15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-[92svh] max-w-400 items-center px-5 pb-36 pt-28 sm:min-h-[96svh] sm:px-8 lg:pb-28">
        <div
          key={`copy-${work.id}`}
          className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <p className="mb-5 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-primary">
            <SparkleIcon weight="fill" /> أضيف حديثاً إلى أرشيفك
          </p>

          <img
            src={work.logoPath ?? undefined}
            alt={work.arabicTitle || work.title}
            className="max-h-32 max-w-[min(22rem,82vw)] object-contain object-right drop-shadow-2xl"
          />

          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            {work.calculatedRating !== null && (
              <span className="flex items-center gap-1 rounded-full bg-background/35 px-3 py-1.5 font-semibold text-amber-300 ring-1 ring-white/10 backdrop-blur-md">
                <StarIcon weight="fill" />
                {work.calculatedRating.toFixed(1)}
              </span>
            )}
            <span className="rounded-full bg-background/35 px-3 py-1.5 text-white/85 ring-1 ring-white/10 backdrop-blur-md">
              {work.year ?? "—"}
            </span>
            <span className="rounded-full bg-background/35 px-3 py-1.5 text-white/85 ring-1 ring-white/10 backdrop-blur-md">
              {kindLabel[work.kind]}
            </span>
            {work.genres.slice(0, 2).map((genre) => (
              <span key={genre} className="text-white/60">
                {genre}
              </span>
            ))}
          </div>

          {work.summary && (
            <p className="mt-5 line-clamp-3 max-w-xl text-sm leading-7 text-white/72 sm:text-base sm:leading-8">
              {work.summary}
            </p>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/works/$workId"
              params={{ workId: work.id }}
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-full px-7 shadow-xl shadow-primary/20",
              )}
            >
              <CompassIcon data-icon="inline-start" weight="fill" /> استكشف العمل
            </Link>
            <Link
              to="/database"
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "rounded-full bg-white/10 px-6 text-white backdrop-blur-xl hover:bg-white/16",
              )}
            >
              <DatabaseIcon data-icon="inline-start" /> افتح السجل
            </Link>
          </div>
        </div>

        {works.length > 1 && (
          <div className="absolute inset-x-5 bottom-16 sm:inset-x-8 lg:right-auto lg:left-8 lg:max-w-[48%]">
            <div className="mb-3 hidden items-center justify-between gap-4 text-[10px] font-semibold tracking-[0.18em] text-white/45 sm:flex">
              <p>أحدث الإضافات المكتملة بصرياً</p>
              <p aria-live="polite">{isPaused ? "متوقف مؤقتاً" : "العنوان التالي خلال بضعة ثوان"}</p>
            </div>
            <div className="flex gap-2 overflow-x-auto px-1 py-2 [direction:ltr] scrollbar-none">
              {works.map((candidate, index) => {
                const selected = candidate.id === work.id;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    aria-label={`اعرض ${candidate.arabicTitle || candidate.title}`}
                    aria-pressed={selected}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "group/hero-logo relative flex h-12 w-18 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background/35 p-2 ring-1 ring-white/12 backdrop-blur-lg transition-all duration-300 hover:-translate-y-1 hover:bg-background/55 hover:ring-white/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-14 sm:w-22",
                      selected && "-translate-y-1 bg-white/14 ring-2 ring-primary sm:w-26",
                    )}
                  >
                    <img
                      src={candidate.logoPath ?? undefined}
                      alt=""
                      loading="lazy"
                      className="max-h-full max-w-full object-contain drop-shadow-md transition-transform duration-300 group-hover/hero-logo:scale-105"
                    />
                    {selected && (
                      <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
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
        <p className="max-w-md text-sm leading-7 text-muted-foreground">
          كل بوابة تستعير مشهداً من داخل كوكبها، ويتغيّر مدارها مع نمو مجموعتك.
        </p>
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
