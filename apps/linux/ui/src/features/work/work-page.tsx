import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Play } from "lucide-react";
import { useEffect, useRef } from "react";

import { Artwork } from "../../components/artwork";
import { ScoreBadge } from "../../components/media-card";
import { Failure } from "../../components/status";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { gateway } from "../../lib/bridge";
import { Recommendations } from "../discovery/recommendations-page";
import { workLink, navigate } from "../shell/navigation";
import { CreatorsPanel } from "./creators-panel";
import { DataPanel } from "./data-panel";
import { FamilyPanel } from "./family-panel";
import { Section, FieldList } from "./field-list";
import { audienceLabels } from "./format";
import { InstallmentsPanel } from "./installments-panel";
import { ScoresPanel } from "./scores-panel";
function onBack() {
  if (window.history.length > 1) window.history.back();
  else navigate("/home");
}

export function WorkPage({ id, installmentId }: { id: string; installmentId?: string }) {
  const result = useQuery({
    queryKey: ["work", id],
    queryFn: ({ signal }) => gateway.work(id, signal),
  });
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    back.current?.focus({ preventScroll: true });
  }, []);
  const work = result.data;
  return (
    <article className="pb-15" aria-label="صفحة العمل">
      <div className="absolute inset-s-[clamp(24px,4vw,64px)] top-28.5 z-3 max-[750px]:top-35.5">
        <Button ref={back} variant="ghost" onClick={onBack}>
          <ArrowRight data-icon="inline-start" />
          العودة إلى المكتبة
        </Button>
      </div>
      {result.error && (
        <div className="mx-auto max-w-[1600px] px-[clamp(20px,4vw,64px)]">
          <Failure error={result.error} retry={() => void result.refetch()} />
        </div>
      )}
      {result.isLoading && (
        <p className="mx-auto max-w-[1600px] px-[clamp(20px,4vw,64px)]" role="status">
          جارٍ تحميل العمل…
        </p>
      )}
      {work && (
        <>
          <header className="relative isolate h-auto min-h-[85dvh] overflow-hidden bg-background">
            <Artwork
              id={work.banner?.id ?? work.poster?.id}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
              priority
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,var(--background),transparent_85%),linear-gradient(270deg,color-mix(in_srgb,var(--background)_82%,transparent),transparent_95%)]" />
            <div className="relative ms-auto flex h-full w-[min(970px,80%)] flex-col items-start justify-end gap-6 px-[clamp(24px,4vw,70px)] pt-50 pb-22.5 max-[1100px]:w-[85%] max-[750px]:w-full max-[750px]:gap-4.5 max-[750px]:px-6 max-[750px]:pt-55 max-[750px]:pb-17.5">
              <div className="flex flex-wrap gap-2">
                {work.planets.map((planet) => (
                  <a
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px]"
                    key={planet.id}
                    href={`#/planets/${planet.slug}`}
                  >
                    {planet.icon} {planet.nameAr}
                  </a>
                ))}
              </div>
              <h1 className="mt-5 w-full text-[clamp(38px,4.5vw,72px)] leading-[1.4] font-bold text-balance">
                {work.logo ? (
                  <Artwork
                    id={work.logo.id}
                    alt={work.titleAr || work.canonicalTitle}
                    className="block h-[clamp(110px,15vw,230px)] w-full object-contain object-bottom-right max-[750px]:h-37.5"
                    priority
                  />
                ) : (
                  <span dir="auto">{work.titleAr || work.canonicalTitle}</span>
                )}
              </h1>
              {work.logo && (
                <p className="text-[19px] text-muted-foreground" dir="auto">
                  {work.titleAr || work.canonicalTitle}
                </p>
              )}
              <p className="text-[13px] text-muted-foreground" dir="auto">
                {work.canonicalTitle}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs leading-relaxed text-muted-foreground">
                <ScoreBadge score={work.score} />
                <span>{work.releaseYear}</span>
                <span>{work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}</span>
                <span>{audienceLabels.get(work.audience)}</span>
                <span dir="auto">{work.age}</span>
                <span>
                  {work.installmentCount} جزء · {work.episodeCount} حلقة
                </span>
                {work.isPrivate && <span>خاص</span>}
              </div>
              <p
                className="max-w-190 text-sm leading-loose whitespace-pre-line wrap-anywhere max-[750px]:text-sm"
                dir="auto"
              >
                {work.summary}
              </p>
              <div className="flex flex-wrap items-center gap-3.75">
                <Button disabled>
                  <Play data-icon="inline-start" />
                  المشغّل قريبًا
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    document.getElementById("work-sections")?.scrollIntoView({
                      behavior: window.matchMedia("(prefers-reduced-motion:reduce)").matches
                        ? "auto"
                        : "smooth",
                    })
                  }
                >
                  استكشف بيانات العمل
                </Button>
              </div>
            </div>
          </header>
          <div
            className="mx-auto max-w-[1600px] px-[clamp(20px,4vw,64px)] pt-8.75"
            id="work-sections"
          >
            <Tabs
              defaultValue={installmentId ? "installments" : "profile"}
              key={`${id}-${installmentId ?? ""}`}
            >
              <TabsList
                variant="line"
                className="mb-8.75 w-full flex-nowrap justify-start gap-2 overflow-x-auto min-[751px]:gap-5.5 *:data-[slot=tabs-trigger]:flex-none"
              >
                <TabsTrigger value="profile">الملف</TabsTrigger>
                <TabsTrigger value="installments">الأجزاء</TabsTrigger>
                <TabsTrigger value="creators">الصنّاع</TabsTrigger>
                <TabsTrigger value="scores">التقييم</TabsTrigger>
                <TabsTrigger value="family">العائلة</TabsTrigger>
                <TabsTrigger value="data">البيانات</TabsTrigger>
              </TabsList>
              <TabsContent value="profile">
                <div className="grid grid-cols-1 gap-6 min-[1101px]:grid-cols-[minmax(0,1fr)_300px] min-[1101px]:gap-11.25">
                  <div>
                    <Section title="نبذة العمل">
                      <p className="text-sm leading-[2.1] whitespace-pre-line wrap-anywhere">
                        {work.summary}
                      </p>
                      <div className="mt-5.5 flex flex-wrap gap-2">
                        {[...work.genres, ...work.tones, ...work.tags].map((term) => (
                          <span
                            className="rounded-full bg-secondary px-3 py-1.5 text-[11px]"
                            key={`${term.id}-${term.slug}`}
                          >
                            {term.labelAr || term.labelEn}
                          </span>
                        ))}
                      </div>
                    </Section>
                    <FamilyPanel work={work} />
                    <Section title="حقائق ومعلومات">
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {work.trivia.map((fact) => (
                          <article
                            className="rounded-2xl border border-border bg-card p-5.5"
                            key={fact}
                          >
                            <p className="text-sm leading-[2.1] whitespace-pre-line wrap-anywhere">
                              {fact}
                            </p>
                          </article>
                        ))}
                      </div>
                      {work.trivia.length === 0 && (
                        <p className="text-[13px] leading-[1.9] text-muted-foreground">
                          لم تُسجّل حقائق إضافية.
                        </p>
                      )}
                    </Section>
                    <Section title="الأعمال المرتبطة">
                      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.75">
                        {work.relations.map((related) => (
                          <a
                            className="rounded-2xl border border-border p-5"
                            key={related.id}
                            href={workLink(related.workId)}
                          >
                            <strong>{related.titleAr || related.canonicalTitle}</strong>
                            <span className="mt-2 block text-[11px] text-muted-foreground">
                              {related.kind} ·{" "}
                              {related.direction === "outgoing" ? "علاقة صادرة" : "علاقة واردة"}
                              {related.notes && <p>{related.notes}</p>}
                            </span>
                          </a>
                        ))}
                      </div>
                    </Section>
                  </div>
                  <aside className="order-first self-start rounded-3xl border border-border bg-card p-6 min-[1101px]:order-0">
                    <Section title="بطاقة السجل">
                      <Artwork
                        id={work.poster?.id}
                        alt=""
                        className="mb-5 aspect-2/3 w-full rounded-2xl object-cover max-[750px]:hidden"
                      />
                      <FieldList
                        rows={[
                          ["النوع", work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"],
                          ["الإصدار", work.releaseYear],
                          ["الجمهور", audienceLabels.get(work.audience)],
                          ["الفئة العمرية", work.age],
                          ["الأجزاء", work.installmentCount],
                          ["الحلقات", work.episodeCount],
                          ["التقييم", work.score.rating],
                        ]}
                      />
                    </Section>
                  </aside>
                </div>
                <Recommendations workId={work.id} />
              </TabsContent>
              <TabsContent value="installments">
                <InstallmentsPanel work={work} initial={installmentId} />
              </TabsContent>
              <TabsContent value="creators">
                <CreatorsPanel work={work} />
              </TabsContent>
              <TabsContent value="scores">
                <ScoresPanel work={work} />
              </TabsContent>
              <TabsContent value="family">
                <FamilyPanel work={work} />
              </TabsContent>
              <TabsContent value="data">
                <DataPanel work={work} />
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
    </article>
  );
}
