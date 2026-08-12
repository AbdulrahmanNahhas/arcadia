import { CompassIcon, SparkleIcon, SquaresFourIcon, StarIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Work } from "@/features/library/model";
import { cn } from "@/lib/utils";
import { kindLabel, WorkCard } from "./work-card";

function radarStatus(work: Work) {
  if (work.releaseStatus === "upcoming") return "لم يصدر بعد";
  if (work.releaseStatus === "airing") return "يصدر الآن";
  if (work.releaseStatus === "returning") return "جزء جديد قريباً";
  return "في قائمة المشاهدة";
}

export function WatchRadarHero({ works }: { works: Work[] }) {
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
    }, 7_000);

    return () => window.clearTimeout(timeout);
  }, [activeIndex, isPaused, works.length]);

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
    <section
      className="relative isolate min-h-[92svh] overflow-hidden sm:min-h-[96svh]"
      aria-label="رادار المشاهدة"
      onPointerEnter={() => setIsPointerInside(true)}
      onPointerLeave={() => setIsPointerInside(false)}
      onFocusCapture={() => setIsFocusInside(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocusInside(false);
      }}
    >
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
              !candidate.bannerPath && "scale-110 blur-xl",
              candidate.id === work.id && "opacity-100",
            )}
          />
        ) : null;
      })}
      <div className="absolute inset-0 -z-20 bg-linear-to-l from-background via-background/62 to-background/10" />
      <div className="absolute inset-0 -z-20 bg-linear-to-t from-background via-background/15 to-background/30" />
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

      <div className="relative mx-auto flex min-h-[92svh] max-w-400 items-center px-5 pb-44 pt-28 sm:min-h-[96svh] sm:px-8 lg:pb-36">
        <div
          key={`copy-${work.id}`}
          className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <p className="mb-5 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-primary">
            <SparkleIcon weight="fill" /> اختيارات مثبتة · على الرادار
          </p>

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

          <p className="mt-5 max-w-lg text-xs leading-6 text-foreground/48">
            أعمال واعدة لم أشاهدها بعد؛ بعضها وصل بالفعل، وبعضها ما زال في الطريق.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/titles/$titleId"
              params={{ titleId: work.id }}
              className={cn(buttonVariants({ size: "lg" }), "rounded-full px-7")}
            >
              <CompassIcon data-icon="inline-start" weight="fill" /> استكشف العمل
            </Link>

            <Dialog>
              <DialogTrigger
                render={<Button variant="secondary" size="lg" className="rounded-full" />}
              >
                <SquaresFourIcon data-icon="inline-start" /> افتح الرادار كاملًا
              </DialogTrigger>
              <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-6xl">
                <DialogHeader className="pe-10">
                  <DialogTitle className="text-2xl sm:text-3xl">على رادار المشاهدة</DialogTitle>
                  <DialogDescription className="max-w-2xl leading-6">
                    قائمة قصيرة ومقصودة، لا ترتيب فيها للأفضلية. اختر أي عمل لفتح سجله الكامل.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
                  {works.map((candidate) => (
                    <WorkCard key={candidate.id} work={candidate} />
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {works.length > 1 ? (
          <div className="absolute inset-x-5 bottom-14 sm:inset-x-8 lg:right-auto lg:left-8 lg:max-w-[58%]">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.18em] text-foreground/45">
                  قائمة الرادار · {works.length} أعمال
                </p>
                <p className="mt-1 hidden text-xs text-foreground/35 sm:block">
                  اختر ملصقاً، أو اترك الرادار ينتقل بينها.
                </p>
              </div>
              <p className="hidden text-[10px] text-foreground/35 sm:block" aria-live="polite">
                {isPaused ? "متوقف مؤقتاً" : "يتنقل تلقائياً"}
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto px-1 py-2 scrollbar-none">
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
                      "group/radar relative h-16 w-12 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/12 transition duration-300 hover:-translate-y-1 hover:ring-foreground/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-20 sm:w-14",
                      selected && "-translate-y-1 ring-2 ring-primary sm:w-16",
                    )}
                  >
                    {candidate.imagePath ? (
                      <img
                        src={candidate.imagePath}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition duration-500 group-hover/radar:scale-105"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center p-1 text-center text-[9px] leading-3">
                        {candidate.arabicTitle || candidate.title}
                      </span>
                    )}
                    <span className="absolute inset-0 bg-linear-to-t from-background/55 to-transparent" />
                    {selected ? (
                      <span className="absolute inset-x-1 bottom-1 h-0.5 rounded-full bg-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
