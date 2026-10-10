import { installmentRating } from "@arcadia/domain";
import type { WorkDetail } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { MediaCard, ScoreBadge } from "../../components/media-card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { gateway } from "../../lib/bridge";
import { workLink } from "../shell/navigation";
import { Section } from "./field-list";
import { pickArtwork, statusLabels } from "./format";
import { SummaryExcerpt } from "./work-hero";

export function OverviewPanel({ work }: { work: WorkDetail }) {
  const terms = [...work.genres, ...work.tones, ...work.tags].filter((term) => term.labelAr.trim());
  const notes = [
    { title: "تنبيه المحتوى", text: work.contentWarnings },
    { title: "ملاحظات التحليل", text: work.analysisNotes },
  ].filter((note) => note.text?.trim());
  return (
    <div className="flex min-w-0 flex-col gap-8 md:gap-12">
      {work.summary.trim() && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-2xl font-semibold md:text-3xl">الحكاية</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <SummaryExcerpt work={work} />
            {terms.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label="الأنواع والطابع والوسوم">
                {terms.map((term) => (
                  <Badge key={term.id} variant="secondary">
                    {term.labelAr}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {!work.summary.trim() && terms.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="الأنواع والطابع والوسوم">
          {terms.map((term) => (
            <Badge key={term.id} variant="secondary">
              {term.labelAr}
            </Badge>
          ))}
        </div>
      )}
      {notes.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-2">
          {notes.map((note) => (
            <Card key={note.title}>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-xl font-semibold md:text-2xl">{note.title}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-loose whitespace-pre-line wrap-anywhere md:text-lg">
                  {note.text}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {work.trivia.length > 0 && (
        <Section title="حقائق ومعلومات">
          <div className="grid gap-5 xl:grid-cols-2">
            {work.trivia.map((fact) => (
              <Card key={fact}>
                <CardHeader>
                  <CardTitle>
                    <Lightbulb aria-label="معلومة" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base leading-loose md:text-lg">{fact}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}
      {work.installments.length > 0 && (
        <Section title="الأجزاء والمواسم">
          <InstallmentTiles work={work} />
        </Section>
      )}
      {work.relations.length > 0 && (
        <Section title="الأعمال المرتبطة">
          <RelatedWorks work={work} />
        </Section>
      )}
    </div>
  );
}

export function InstallmentTiles({ work }: { work: WorkDetail }) {
  const navigation = useCardNavigation();
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
      {work.installments.map((unit) => {
        const rating = installmentRating(unit.scores ?? {});
        return (
          <a
            {...navigation}
            href={workLink(work.id, unit.id)}
            key={unit.id}
            className="group flex min-w-0 flex-col gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            aria-label={`تفاصيل ${unit.title}`}
          >
            <div className="relative overflow-hidden rounded-2xl">
              <Artwork
                id={pickArtwork(unit.artwork, "poster")?.id ?? work.poster?.id}
                alt=""
                className="aspect-2/3 w-full object-cover motion-safe:transition-transform motion-safe:group-hover:scale-105"
              />
              <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                <Badge variant="secondary">
                  {unit.kind === "season" ? "موسم" : unit.kind === "movie" ? "فيلم" : "إصدار خاص"}
                </Badge>
                {!(unit.status === "announced" && rating === null) && (
                  <ScoreBadge score={{ rating, scored: rating === null ? 0 : 1, total: 1 }} />
                )}
              </div>
              {unit.status === "completed" && (
                <div className="absolute inset-s-3 bottom-3">
                  <Badge variant="secondary">{statusLabels.get(unit.status)}</Badge>
                </div>
              )}
            </div>
            <h3 className="text-base font-semibold md:text-lg">{unit.title}</h3>
            <p className="text-sm text-muted-foreground">
              {unit.kind === "season"
                ? `${unit.episodes.length} حلقة`
                : unit.runtimeMinutes
                  ? `${unit.runtimeMinutes} دقيقة`
                  : "إصدار مستقل"}
            </p>
          </a>
        );
      })}
    </div>
  );
}

function RelatedWorks({ work }: { work: WorkDetail }) {
  // Keep metadata requests bounded even for unusually large relation lists.
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {work.relations.map((relation) => (
        <RelatedWork key={relation.id} relation={relation} />
      ))}
    </div>
  );
}
const relationLabels = new Map([
  ["sequel", "تكملة"],
  ["prequel", "عمل سابق"],
  ["adaptation", "اقتباس"],
  ["spin-off", "عمل مشتق"],
  ["side-story", "قصة جانبية"],
  ["alternative", "نسخة بديلة"],
  ["related", "عمل مرتبط"],
  ["compilation", "تجميع"],
]);
function RelatedWork({ relation }: { relation: WorkDetail["relations"][number] }) {
  const related = useQuery({
    queryKey: ["work", relation.workId],
    queryFn: ({ signal }) => gateway.work(relation.workId, signal),
    enabled: false,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <a href={workLink(relation.workId)} className="text-lg" dir="auto">
            {relation.titleAr || relation.canonicalTitle}
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Badge variant="outline">{relationLabels.get(relation.kind) ?? "عمل مرتبط"}</Badge>
        {relation.notes && <p className="text-base leading-relaxed">{relation.notes}</p>}
        {related.data ? (
          <MediaCard work={related.data} layout="banner" />
        ) : (
          <Button
            variant="ghost"
            onClick={() => void related.refetch()}
            disabled={related.isFetching}
          >
            معاينة العمل
          </Button>
        )}
        {related.error && <p role="alert">تعذّرت المعاينة. افتح صفحة العمل للمحاولة مجددًا.</p>}
      </CardContent>
    </Card>
  );
}
