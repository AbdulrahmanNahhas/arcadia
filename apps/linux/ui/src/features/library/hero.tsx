import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { Artwork } from "../../components/artwork";
import { gateway } from "../../lib/bridge";

export function Hero({ onSelect }: { onSelect: (id: string) => void }) {
  const candidates = useQuery({
    queryKey: ["works", "hero"],
    queryFn: ({ signal }) =>
      gateway.works({ sort: "added-desc", pageSize: 10, includePrivate: false }, signal),
  });
  const items = candidates.data?.items ?? [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || items.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % items.length), 8000);
    return () => clearInterval(timer);
  }, [paused, items.length]);
  const work = items[index % Math.max(1, items.length)];
  const detail = useQuery({
    queryKey: ["work", work?.id],
    queryFn: ({ signal }) => gateway.work(work?.id ?? "", signal),
    enabled: Boolean(work),
  });
  if (!work)
    return candidates.error ? (
      <p className="error" role="alert">
        {candidates.error.message}
      </p>
    ) : (
      <div className="hero-loading" aria-busy="true">
        جارٍ تحميل أبرز الأعمال…
      </div>
    );
  const banner = detail.data?.artwork.find((image) => image.role === "banner") ?? work.poster;
  const logo = detail.data?.artwork.find((image) => image.role === "logo");
  return (
    <section
      className="library-hero"
      aria-label="أحدث الأعمال"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <Artwork id={banner?.id} alt="" className="hero-backdrop" />
      <div className="hero-shade" />
      <div className="hero-content">
        {logo ? (
          <Artwork id={logo.id} alt={work.titleAr || work.canonicalTitle} className="hero-logo" />
        ) : (
          <h1>{work.titleAr || work.canonicalTitle}</h1>
        )}
        <p className="hero-meta">
          {work.releaseYear} · {work.age} ·{" "}
          {work.episodeCount ? `${work.episodeCount} حلقة` : "فيلم"}
        </p>
        <p className="hero-summary">{work.summary}</p>
        <div className="hero-actions">
          <button className="primary-button" disabled>
            <Play size={18} /> المشاهدة قريبًا
          </button>
          <button className="hero-details" onClick={() => onSelect(work.id)}>
            عرض التفاصيل
          </button>
        </div>
      </div>
      {items.length > 1 && (
        <div className="hero-controls">
          <button
            className="icon-button"
            aria-label="العمل السابق"
            onClick={() => setIndex((index + items.length - 1) % items.length)}
          >
            <ChevronRight />
          </button>
          <span>
            {(index % items.length) + 1} / {items.length}
          </span>
          <button
            className="icon-button"
            aria-label="العمل التالي"
            onClick={() => setIndex((index + 1) % items.length)}
          >
            <ChevronLeft />
          </button>
        </div>
      )}
    </section>
  );
}
