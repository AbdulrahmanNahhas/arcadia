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
      <div className="home-hero home-hero-loading" role="status">
        {result.error
          ? result.error.message
          : result.isLoading
            ? "جارٍ تحميل المكتبة…"
            : "لا توجد أعمال عامة بعد."}
      </div>
    );
  return (
    <section
      className="home-hero"
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
        className="home-hero-backdrop"
        priority
      />
      <div className="home-hero-shade" />
      <div className="home-hero-content">
        {work.logo ? (
          <h1>
            <Artwork
              id={work.logo.id}
              alt={work.titleAr || work.canonicalTitle}
              className="home-hero-logo"
              priority
            />
          </h1>
        ) : (
          <h1 dir="auto">{work.titleAr || work.canonicalTitle}</h1>
        )}
        <div className="home-hero-meta">
          <ScoreBadge score={work.score} />
          {work.releaseYear && <span>{work.releaseYear}</span>}
          <span>{work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}</span>
          <span dir="auto">{work.age}</span>
        </div>
        <p className="home-hero-summary" dir="auto">
          {work.summary}
        </p>
        <div className="home-hero-actions">
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
      <div className="home-hero-controls" role="group" aria-label="التنقل بين الأعمال">
        {items.map((item, n) => (
          <button
            key={item.id}
            className="home-hero-dot"
            aria-label={`اعرض ${item.titleAr || item.canonicalTitle}`}
            aria-pressed={n === index % items.length}
            onClick={() => setIndex(n)}
          >
            <span />
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
