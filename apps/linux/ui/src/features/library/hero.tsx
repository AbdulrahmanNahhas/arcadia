import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Info, Pause, Play } from "lucide-react";
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
  const [rotationStopped, setRotationStopped] = useState(false);
  useEffect(() => {
    if (
      paused ||
      rotationStopped ||
      items.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % items.length), 8000);
    return () => clearInterval(timer);
  }, [paused, rotationStopped, items.length]);
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
    ) : candidates.isLoading ? (
      <div className="hero-loading" aria-busy="true">
        جارٍ تحميل أبرز الأعمال…
      </div>
    ) : (
      <div className="hero-loading">لا توجد أعمال عامة لعرضها بعد.</div>
    );
  const banner = detail.data?.artwork.find((image) => image.role === "banner") ?? work.poster;
  const logo = detail.data?.artwork.find((image) => image.role === "logo");
  return (
    <section
      className="library-hero"
      aria-label="أحدث الأعمال"
      aria-roledescription="عرض أعمال متغيّر"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <Artwork id={banner?.id} alt="" className="hero-backdrop" priority />
      <div className="hero-shade" />
      <div className="hero-content">
        <p className="hero-eyebrow">من مكتبتنا</p>
        {logo ? (
          <h1 className="hero-title-logo">
            <Artwork
              id={logo.id}
              alt={work.titleAr || work.canonicalTitle}
              className="hero-logo"
              priority
            />
          </h1>
        ) : (
          <h1 dir="auto">{work.titleAr || work.canonicalTitle}</h1>
        )}
        <ul className="hero-meta" aria-label="معلومات العمل">
          {work.releaseYear && <li>{work.releaseYear}</li>}
          {work.age && <li dir="auto">{work.age}</li>}
          <li>{work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}</li>
          {work.episodeCount > 0 && <li>{work.episodeCount} حلقة</li>}
          {detail.data?.genres.slice(0, 3).map((genre) => (
            <li key={genre.id}>{genre.labelAr || genre.labelEn}</li>
          ))}
        </ul>
        <p className="hero-summary" dir="auto">
          {work.summary || "اكتشف تفاصيل هذا العمل ودليل العائلة."}
        </p>
        <div className="hero-actions">
          <button className="hero-details" onClick={() => onSelect(work.id)}>
            <Info size={21} aria-hidden="true" /> عرض التفاصيل
          </button>
          <button className="hero-watch" disabled title="المشغّل في خطوة لاحقة">
            <Play size={19} aria-hidden="true" /> المشاهدة قريبًا
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
          <div className="hero-slides" role="group" aria-label="اختيار العمل المميز">
            {items.map((item, position) => (
              <button
                key={item.id}
                className="hero-slide"
                aria-label={`عرض ${item.titleAr || item.canonicalTitle}`}
                aria-pressed={position === index % items.length}
                onClick={() => setIndex(position)}
              >
                <span />
              </button>
            ))}
          </div>
          <button
            className="icon-button"
            aria-label="العمل التالي"
            onClick={() => setIndex((index + 1) % items.length)}
          >
            <ChevronLeft />
          </button>
          <button
            className="icon-button hero-pause"
            aria-label={rotationStopped ? "تشغيل التبديل التلقائي" : "إيقاف التبديل التلقائي"}
            aria-pressed={rotationStopped}
            onClick={() => setRotationStopped(!rotationStopped)}
          >
            {rotationStopped ? <Play size={16} /> : <Pause size={16} />}
          </button>
        </div>
      )}
    </section>
  );
}
