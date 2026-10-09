import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Play } from "lucide-react";
import { useEffect, useRef } from "react";

import { Artwork } from "../../components/artwork";
import { ScoreBadge } from "../../components/media-card";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { gateway } from "../../lib/bridge";
import { Details, Family, Overview } from "./work-sections";

export function WorkPage({
  id,
  installmentId,
  onBack,
}: {
  id: string;
  installmentId?: string;
  onBack: () => void;
}) {
  const result = useQuery({
    queryKey: ["work", id],
    queryFn: ({ signal }) => gateway.work(id, signal),
  });
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    back.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onBack();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onBack]);
  const work = result.data;
  const banner = work?.artwork.find((image) => image.role === "banner");
  return (
    <article className="flex flex-col gap-[22px] pb-9" aria-label="صفحة العمل">
      <Button ref={back} variant="ghost" onClick={onBack}>
        <ArrowRight data-icon="inline-start" /> العودة إلى المكتبة
      </Button>
      {result.isLoading && <p role="status">جارٍ تحميل العمل…</p>}
      {result.error && (
        <>
          <p
            className="rounded-xl bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive"
            role="alert"
          >
            {result.error.message}
          </p>
          <Button variant="outline" onClick={() => void result.refetch()}>
            إعادة المحاولة
          </Button>
        </>
      )}
      {work && (
        <>
          <header className="relative overflow-hidden rounded-2xl bg-card">
            <Artwork
              id={banner?.id ?? work.poster?.id}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-background/75" />
            <div className="relative flex min-h-[330px] items-end gap-7 px-7 py-10 max-[640px]:min-h-0 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-5 max-[640px]:px-5 max-[640px]:py-7">
              <Artwork
                id={work.poster?.id}
                alt=""
                className="aspect-[2/3] w-[145px] shrink-0 rounded-xl object-cover max-[640px]:w-[110px]"
                priority
              />
              <div className="flex min-w-0 flex-col items-start gap-4">
                <h1 className="text-3xl leading-snug font-semibold md:text-4xl" dir="auto">
                  {work.titleAr || work.canonicalTitle}
                </h1>
                {work.titleAr && (
                  <p className="mt-2 text-sm text-muted-foreground" dir="auto">
                    {work.canonicalTitle}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3.5 text-sm text-muted-foreground">
                  <ScoreBadge score={work.score} />
                  <span>
                    {work.releaseYear} · {work.age} · {work.installmentCount} جزء
                  </span>
                </div>
                <p
                  className="whitespace-pre-line text-sm leading-relaxed text-foreground/90"
                  dir="auto"
                >
                  {work.summary}
                </p>
                <Button disabled>
                  <Play data-icon="inline-start" /> المشاهدة
                </Button>
              </div>
            </div>
          </header>
          <Tabs defaultValue={installmentId ? "installments" : "overview"}>
            <TabsList variant="line" className="max-w-full flex-wrap">
              <TabsTrigger value="overview">نبذة</TabsTrigger>
              <TabsTrigger value="family">دليل العائلة</TabsTrigger>
              <TabsTrigger value="installments">الأجزاء</TabsTrigger>
              <TabsTrigger value="details">التفاصيل</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <Overview work={work} />
            </TabsContent>
            <TabsContent value="family">
              <Family work={work} />
            </TabsContent>
            <TabsContent value="details">
              <Details work={work} />
            </TabsContent>
            <TabsContent value="installments">
              {work.installments.length === 0 && (
                <p className="text-sm text-muted-foreground">لم تُضف أجزاء لهذا العمل بعد.</p>
              )}
              {work.installments.map((item) => (
                <section
                  className="mb-3 flex flex-col gap-2 rounded-xl border border-border bg-card p-4 aria-current:border-primary"
                  key={item.id}
                  aria-current={item.id === installmentId ? "true" : undefined}
                >
                  <h2 dir="auto">{item.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {item.kind === "movie" ? "فيلم" : item.kind === "season" ? "موسم" : "إصدار خاص"}{" "}
                    · {item.releaseDate || "الموعد غير معروف"}{" "}
                    {item.runtimeMinutes ? `· ${item.runtimeMinutes} دقيقة` : ""}
                  </p>
                  {item.summary && <p dir="auto">{item.summary}</p>}
                  {item.episodes.length > 0 && (
                    <details>
                      <summary>{item.episodes.length} حلقة</summary>
                      <ol>
                        {item.episodes.map((episode) => (
                          <li key={episode.id}>
                            <span dir="auto">
                              {episode.number} · {episode.title || "حلقة"}
                            </span>
                            {episode.releaseDate && <small> · {episode.releaseDate}</small>}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </section>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </article>
  );
}
