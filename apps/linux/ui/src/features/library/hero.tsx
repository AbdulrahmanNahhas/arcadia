import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Info, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { Artwork } from "../../components/artwork";
import { gateway } from "../../lib/bridge";

export function Hero({
  onSelect,
  active = true,
}: {
  onSelect: (id: string) => void;
  active?: boolean;
}) {
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
      !active ||
      paused ||
      rotationStopped ||
      items.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % items.length), 8000);
    return () => clearInterval(timer);
  }, [active, paused, rotationStopped, items.length]);
  const work = items[index % Math.max(1, items.length)];
  const detail = useQuery({
    queryKey: ["work", work?.id],
    queryFn: ({ signal }) => gateway.work(work?.id ?? "", signal),
    enabled: Boolean(work),
  });
  if (!work)
    return candidates.error ? (
      <p
        className="rounded-xl bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive"
        role="alert"
      >
        {candidates.error.message}
      </p>
    ) : candidates.isLoading ? (
      <div
        className="mb-9 grid min-h-[470px] place-items-center bg-card text-muted-foreground"
        aria-busy="true"
      >
        جارٍ تحميل أبرز الأعمال…
      </div>
    ) : (
      <div className="mb-9 grid min-h-[470px] place-items-center bg-card text-muted-foreground">
        لا توجد أعمال عامة لعرضها بعد.
      </div>
    );
  const banner = detail.data?.artwork.find((image) => image.role === "banner") ?? work.poster;
  const logo = detail.data?.artwork.find((image) => image.role === "logo");
  return (
    <section
      className="relative isolate -mx-[var(--hero-gutter)] mb-9 h-[clamp(550px,80vh,820px)] min-h-[550px] overflow-hidden bg-card [--hero-gutter:38px] min-[1700px]:[--hero-gutter:52px] max-[1100px]:[--hero-gutter:25px] max-[800px]:[--hero-gutter:20px] max-[640px]:-mx-[15px] max-[640px]:h-auto max-[640px]:min-h-[500px]"
      aria-label="أحدث الأعمال"
      aria-roledescription="عرض أعمال متغيّر"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <Artwork
        id={banner?.id}
        alt=""
        className="absolute inset-0 block h-full w-full object-cover object-center"
        priority
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,var(--background),transparent_75%),linear-gradient(270deg,var(--background),transparent_80%)] max-[640px]:bg-[linear-gradient(0deg,var(--background),transparent)]" />
      <div className="relative flex h-full w-[min(620px,72%)] flex-col items-start justify-end gap-5 px-[var(--hero-gutter)] pt-32 pb-[88px] max-[800px]:w-[85%] max-[640px]:min-h-[500px] max-[640px]:w-full max-[640px]:gap-3.5">
        <p className="text-xs text-foreground/90">من مكتبتنا</p>
        {logo ? (
          <h1 className="w-full text-[clamp(32px,4.5vw,64px)] leading-[1.35] font-semibold [text-wrap:balance]">
            <Artwork
              id={logo.id}
              alt={work.titleAr || work.canonicalTitle}
              className="h-[clamp(100px,12vw,180px)] w-full object-contain object-right-bottom max-[640px]:h-[100px]"
              priority
            />
          </h1>
        ) : (
          <h1
            className="text-[clamp(32px,4.5vw,64px)] leading-[1.35] font-semibold [text-wrap:balance]"
            dir="auto"
          >
            {work.titleAr || work.canonicalTitle}
          </h1>
        )}
        <ul
          className="m-0 flex list-none flex-wrap gap-2 p-0 text-xs text-foreground/90"
          aria-label="معلومات العمل"
        >
          {work.releaseYear && (
            <li className="rounded-full border border-white/20 bg-background/80 px-3 py-1">
              {work.releaseYear}
            </li>
          )}
          {work.age && (
            <li
              className="rounded-full border border-white/20 bg-background/80 px-3 py-1"
              dir="auto"
            >
              {work.age === "all" ? "للجميع" : work.age}
            </li>
          )}
          <li className="rounded-full border border-white/20 bg-background/80 px-3 py-1">
            {work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}
          </li>
          {work.episodeCount > 0 && (
            <li className="rounded-full border border-white/20 bg-background/80 px-3 py-1">
              {work.episodeCount} حلقة
            </li>
          )}
          {detail.data?.genres.slice(0, 3).map((genre) => (
            <li
              className="rounded-full border border-white/20 bg-background/80 px-3 py-1"
              key={genre.id}
            >
              {genre.labelAr || genre.labelEn}
            </li>
          ))}
        </ul>
        <p
          className="line-clamp-3 max-w-full text-base leading-loose max-[640px]:text-sm"
          dir="auto"
        >
          {work.summary || "اكتشف تفاصيل هذا العمل ودليل العائلة."}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center justify-center gap-2.5 rounded-full bg-foreground px-6 py-3 font-semibold text-background transition-opacity hover:opacity-90 max-[640px]:px-4 max-[640px]:py-2.5"
            onClick={() => onSelect(work.id)}
          >
            <Info size={21} aria-hidden="true" /> عرض التفاصيل
          </button>
          <button
            className="inline-flex items-center justify-center gap-2.5 rounded-full border border-white/25 bg-background/80 px-6 py-3 font-semibold text-foreground disabled:opacity-65 max-[640px]:px-4 max-[640px]:py-2.5"
            disabled
            title="المشغّل في خطوة لاحقة"
          >
            <Play size={19} aria-hidden="true" /> المشاهدة قريبًا
          </button>
        </div>
      </div>
      {items.length > 1 && (
        <div className="absolute inset-inline-[var(--hero-gutter)] bottom-6 flex items-center justify-start gap-1 max-[640px]:bottom-4">
          <button
            className="grid size-[34px] shrink-0 place-items-center rounded-full bg-background/50"
            aria-label="العمل السابق"
            onClick={() => setIndex((index + items.length - 1) % items.length)}
          >
            <ChevronRight />
          </button>
          <div
            className="flex flex-wrap items-center"
            role="group"
            aria-label="اختيار العمل المميز"
          >
            {items.map((item, position) => (
              <button
                key={item.id}
                className="grid size-8 place-items-center rounded-lg bg-transparent max-[640px]:w-5"
                aria-label={`عرض ${item.titleAr || item.canonicalTitle}`}
                aria-pressed={position === index % items.length}
                onClick={() => setIndex(position)}
              >
                <span
                  className={`block h-1.5 rounded-full ${position === index % items.length ? "w-[18px] bg-foreground" : "w-1.5 bg-foreground/45"}`}
                />
              </button>
            ))}
          </div>
          <button
            className="grid size-[34px] shrink-0 place-items-center rounded-full bg-background/50"
            aria-label="العمل التالي"
            onClick={() => setIndex((index + 1) % items.length)}
          >
            <ChevronLeft />
          </button>
          <button
            className="ms-2.5 grid size-[34px] shrink-0 place-items-center rounded-full bg-background/50"
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
