import { useQuery } from "@tanstack/react-query";
import { Info, Play, Pause } from "lucide-react";
import { useEffect, useState } from "react";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { ScoreBadge } from "../../components/media-card";
import { Button } from "../../components/ui/button";
import { gateway } from "../../lib/bridge";
import { requestWatch } from "../player/watch-request";
import { navigate, workLink } from "../shell/navigation";
export function Hero() {
  const navigation = useCardNavigation();
  const result = useQuery({
    queryKey: ["home", "hero"],
    queryFn: ({ signal }) => gateway.works({ sort: "added-desc", pageSize: 10 }, signal),
  });
  const [index, setIndex] = useState(0);
  const [pause, setPause] = useState(false);
  const [stopped, setStopped] = useState(false);
  const items = result.data?.items ?? [];
  useEffect(() => {
    if (
      pause ||
      stopped ||
      items.length < 2 ||
      window.matchMedia("(prefers-reduced-motion:reduce)").matches
    )
      return;
    const timer = setInterval(() => setIndex((v) => (v + 1) % items.length), 9000);
    return () => clearInterval(timer);
  }, [pause, stopped, items.length]);
  const work = items[index % Math.max(items.length, 1)];
  if (!work)
    return (
      <div
        className="relative isolate grid min-h-140 place-items-center overflow-hidden bg-card text-muted-foreground sm:min-h-160 lg:min-h-[clamp(560px,76svh,820px)]"
        role="status"
      >
        {result.error
          ? result.error.message
          : result.isLoading
            ? "جارٍ تحميل المكتبة…"
            : "لا توجد أعمال عامة بعد."}
      </div>
    );
  return (
    <section
      {...navigation}
      tabIndex={0}
      data-navigation-align="start"
      aria-keyshortcuts="ArrowLeft ArrowRight Enter"
      onKeyDown={(event) => {
        if (
          event.target !== event.currentTarget ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.nativeEvent.isComposing
        )
          return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          setIndex(
            (value) => (value + (event.key === "ArrowLeft" ? 1 : -1) + items.length) % items.length,
          );
        } else if (event.key === "Enter") {
          event.preventDefault();
          navigate(workLink(work.id).slice(1));
        } else navigation?.onKeyDown(event);
      }}
      className="relative isolate flex min-h-140 items-end overflow-hidden bg-card focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary sm:min-h-160 lg:min-h-[clamp(560px,76svh,820px)]"
      aria-label="أحدث الأعمال"
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onFocusCapture={() => setPause(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPause(false);
      }}
    >
      <Artwork
        id={work.banner?.id ?? work.poster?.id}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        priority
      />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-l from-background/90 via-background/45 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent" />
      <div className="relative flex w-full max-w-190 flex-col items-start gap-5 px-4 pt-20 pb-24 sm:w-4/5 sm:gap-6 sm:px-8.5 sm:pt-28 sm:pb-28 lg:w-3/5 lg:px-12">
        {work.logo ? (
          <h1 className="w-full text-4xl leading-normal font-semibold sm:text-5xl lg:text-6xl">
            <Artwork
              id={work.logo.id}
              alt={work.titleAr || work.canonicalTitle}
              className="block h-32 w-full max-w-lg object-contain object-bottom-right sm:h-40 lg:h-48"
              priority
            />
          </h1>
        ) : (
          <h1
            className="w-full text-4xl leading-normal font-semibold sm:text-5xl lg:text-6xl"
            dir="auto"
          >
            {work.titleAr || work.canonicalTitle}
          </h1>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:gap-4 sm:text-sm">
          <ScoreBadge score={work.score} />
          {work.releaseYear && <span>{work.releaseYear}</span>}
          <span>{work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}</span>
          <span dir="auto">{work.age}</span>
        </div>
        <p
          className="line-clamp-3 max-w-150 text-sm leading-loose text-foreground/80 sm:text-base"
          dir="auto"
        >
          {work.summary}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button size="lg" nativeButton={false} render={<a href={workLink(work.id)} />}>
            <Info data-icon="inline-start" />
            عرض التفاصيل
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() =>
              requestWatch({
                workId: work.id,
                title: work.titleAr || work.canonicalTitle,
              })
            }
          >
            <Play data-icon="inline-start" />
            المشاهدة
          </Button>
        </div>
      </div>
      <div
        className="absolute inset-s-4 bottom-6 flex items-center gap-0.5 sm:inset-s-8.5 lg:inset-s-12"
        role="group"
        aria-label="التنقل بين الأعمال"
      >
        {items.map((item, n) => (
          <button
            key={item.id}
            className="group/dot grid h-9 w-6 place-items-center rounded-lg bg-transparent"
            aria-label={`اعرض ${item.titleAr || item.canonicalTitle}`}
            aria-pressed={n === index % items.length}
            onClick={() => setIndex(n)}
          >
            <span className="block size-1.5 rounded-full bg-muted-foreground transition-all group-aria-pressed/dot:w-4 group-aria-pressed/dot:bg-primary motion-reduce:transition-none" />
          </button>
        ))}
        <Button
          variant="ghost"
          size="icon"
          aria-label={stopped ? "تشغيل التبديل التلقائي" : "إيقاف التبديل التلقائي"}
          onClick={() => setStopped(!stopped)}
        >
          {stopped ? <Play /> : <Pause />}
        </Button>
      </div>
    </section>
  );
}
