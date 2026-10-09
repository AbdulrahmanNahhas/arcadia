import { useQuery } from "@tanstack/react-query";
import { Info, Play, Pause } from "lucide-react";
import { useEffect, useState } from "react";

import { Artwork } from "../../components/artwork";
import { ScoreBadge } from "../../components/media-card";
import { Button } from "../../components/ui/button";
import { gateway } from "../../lib/bridge";
import { workLink } from "../shell/navigation";
export function Hero() {
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
        className="relative isolate grid h-[clamp(360px,54vh,560px)] min-h-90 place-items-center overflow-hidden bg-card text-muted-foreground max-[520px]:h-100"
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
      className="relative isolate h-[clamp(360px,54vh,560px)] min-h-90 overflow-hidden bg-card max-[520px]:h-100"
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
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,var(--background),transparent_90%),linear-gradient(270deg,color-mix(in_srgb,var(--background)_87.843%,transparent),color-mix(in_srgb,var(--background)_43.922%,transparent)_48%,transparent_85%)]" />
      <div className="relative flex h-full w-[min(650px,75%)] flex-col items-start justify-end gap-4 px-8.5 pt-7.5 pb-17.5 max-[800px]:w-[88%] max-[800px]:px-5.5 max-[520px]:w-full max-[520px]:gap-3.5 max-[520px]:px-4 max-[520px]:pt-6 max-[520px]:pb-16.5">
        {work.logo ? (
          <h1 className="w-full text-[clamp(28px,3.2vw,48px)] leading-normal font-semibold">
            <Artwork
              id={work.logo.id}
              alt={work.titleAr || work.canonicalTitle}
              className="block h-[clamp(90px,11vw,150px)] w-[min(420px,100%)] object-contain object-bottom-right max-[520px]:h-25"
              priority
            />
          </h1>
        ) : (
          <h1
            className="w-full text-[clamp(28px,3.2vw,48px)] leading-normal font-semibold"
            dir="auto"
          >
            {work.titleAr || work.canonicalTitle}
          </h1>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground max-[520px]:gap-2 max-[520px]:text-[11px]">
          <ScoreBadge score={work.score} />
          {work.releaseYear && <span>{work.releaseYear}</span>}
          <span>{work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}</span>
          <span dir="auto">{work.age}</span>
        </div>
        <p className="line-clamp-2 text-sm leading-[1.9] max-[520px]:text-[13px]" dir="auto">
          {work.summary}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button nativeButton={false} render={<a href={workLink(work.id)} />}>
            <Info data-icon="inline-start" />
            عرض التفاصيل
          </Button>
          <Button variant="outline" disabled>
            <Play data-icon="inline-start" />
            المشاهدة قريبًا
          </Button>
        </div>
      </div>
      <div
        className="absolute inset-s-8.5 bottom-4.5 flex items-center gap-0.5 max-[800px]:inset-s-5.5 max-[520px]:inset-s-4"
        role="group"
        aria-label="التنقل بين الأعمال"
      >
        {items.map((item, n) => (
          <button
            key={item.id}
            className="group/dot grid h-7 w-5.5 place-items-center rounded-[7px] bg-transparent"
            aria-label={`اعرض ${item.titleAr || item.canonicalTitle}`}
            aria-pressed={n === index % items.length}
            onClick={() => setIndex(n)}
          >
            <span className="block size-1.5 rounded-[6px] bg-muted-foreground group-aria-pressed/dot:w-4 group-aria-pressed/dot:bg-primary" />
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
