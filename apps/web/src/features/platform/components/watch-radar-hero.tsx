import { CompassIcon, PlayIcon, StarIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Work } from "@/features/library/model";
import { cn } from "@/lib/utils";
import { kindLabel } from "./work-card";

function radarStatus(work: Work) {
  if (work.releaseStatus === "upcoming") return "لم يصدر بعد";
  if (work.releaseStatus === "airing") return "يصدر الآن";
  if (work.releaseStatus === "returning") return "جزء جديد قريباً";
  return "في قائمة المشاهدة";
}

export function WatchRadarHero({ works }: { works: Work[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const work = works[activeIndex] ?? works[0];

  useEffect(() => {
    if (works.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setActiveIndex((activeIndex + 1) % works.length);
    }, 20_000);

    return () => window.clearTimeout(timeout);
  }, [activeIndex, works.length]);

  if (!work) {
    return (
      <section className="archive-grid relative flex min-h-[72svh] items-center overflow-hidden px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold tracking-[0.2em] text-primary">رادار المشاهدة</p>
          <h1 className="mt-4 font-heading text-4xl leading-tight font-semibold sm:text-6xl">
            ما يستحق الانتظار، في مكان واحد.
          </h1>
        </div>
      </section>
    );
  }

  return (
    <section className="relative isolate min-h-[92svh] overflow-hidden sm:min-h-[96svh]">
      {works.map((candidate, index) => {
        const artwork = candidate.bannerPath || candidate.imagePath;
        return artwork ? (
          <img
            key={candidate.id}
            src={artwork}
            alt=""
            fetchPriority={index === 0 ? "high" : "auto"}
            loading={index < 2 ? "eager" : "lazy"}
            className={cn(
              "absolute inset-0 -z-30 size-full object-cover object-center opacity-0 transition duration-1000 ease-out motion-reduce:transition-none",
              "blur-sm md:blur-none",
              !candidate.bannerPath && "scale-110 blur-xl",
              candidate.id === work.id && "opacity-100",
            )}
          />
        ) : null;
      })}
      <div className="absolute inset-0 -z-20 bg-linear-to-t sm:bg-linear-to-l from-background via-background/62 to-background/10" />
      <div className="absolute inset-0 -z-20 bg-linear-to-t sm:bg-linear-to-t from-background via-background/15 to-background/30" />
      <div
        className="absolute inset-y-0 inset-s-0 -z-10 w-2/3 bg-[radial-gradient(circle,var(--primary),transparent_70%)] opacity-15 blur-3xl"
        aria-hidden="true"
      />

      {!work.bannerPath && work.imagePath ? (
        <div
          key={`poster-${work.id}`}
          className="pointer-events-none absolute bottom-72 left-[8%] hidden w-56 animate-in fade-in slide-in-from-left-6 duration-700 lg:block xl:left-[13%] xl:w-64"
          aria-hidden="true"
        >
          <span className="absolute -inset-8 rounded-full border border-dashed border-primary/30" />
          <span className="absolute -inset-16 rounded-full border border-primary/10" />
          <img
            src={work.imagePath}
            alt=""
            className="relative aspect-2/3 w-full rotate-2 rounded-3xl object-cover shadow-2xl ring-1 ring-foreground/15"
          />
        </div>
      ) : null}

      <div className="relative mx-auto flex flex-col min-h-[92svh] max-w-400 items-start justify-end gap-6 px-5 pb-44 pt-28 sm:min-h-[96svh] sm:px-8 lg:pb-36">
        <div
          key={`copy-${work.id}`}
          className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          {work.logoPath ? (
            <img
              src={work.logoPath}
              alt={work.arabicTitle || work.title}
              className="max-h-32 max-w-[min(22rem,82vw)] object-contain object-right drop-shadow-2xl"
            />
          ) : (
            <div>
              <h1 className="max-w-xl font-heading text-4xl leading-tight font-semibold sm:text-6xl">
                {work.arabicTitle || work.title}
              </h1>
              {work.arabicTitle ? (
                <p className="mt-3 text-sm font-medium tracking-[0.08em] text-foreground/55 sm:text-base">
                  {work.title}
                </p>
              ) : null}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge>{radarStatus(work)}</Badge>
            {work.calculatedRating !== null ? (
              <Badge variant="secondary">
                <StarIcon weight="fill" /> {work.calculatedRating.toFixed(1)}
              </Badge>
            ) : null}
            <Badge variant="outline">{work.year ?? "موعد غير محدد"}</Badge>
            <Badge variant="outline">{kindLabel[work.kind]}</Badge>
          </div>

          {work.summary ? (
            <p className="mt-5 line-clamp-3 max-w-xl text-sm leading-7 text-foreground/72 sm:text-base sm:leading-8">
              {work.summary}
            </p>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Tooltip>
              <TooltipTrigger
                render={<Button size="lg" className="rounded-full font-semibold" disabled />}
              >
                <PlayIcon weight="fill" data-icon="inline-start" /> تشغيل
              </TooltipTrigger>
              <TooltipContent>يُفعّل عند ربط هذا العمل بخادم Jellyfin</TooltipContent>
            </Tooltip>
            <Link
              to="/titles/$titleId"
              params={{ titleId: work.id }}
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "rounded-full")}
            >
              <CompassIcon data-icon="inline-start" /> تفاصيل العمل
            </Link>
          </div>
        </div>

        {works.length > 1 ? (
          <nav
            className="relative flex items-center gap-2"
            aria-label={`قائمة الرادار · ${works.length} أعمال`}
          >
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
                    "h-4 rounded-full bg-foreground/25 transition-all duration-300 hover:bg-foreground/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
                    selected ? "w-8 bg-primary hover:bg-primary" : "w-4",
                  )}
                />
              );
            })}
          </nav>
        ) : null}
      </div>
    </section>
  );
}
