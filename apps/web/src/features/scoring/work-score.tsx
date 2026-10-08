import { installmentRating, workScore, type Score, type WorkScore } from "@arcadia/domain";
import { StarIcon } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { scoreDefinitions } from "./score-model";

export function WorkScoreBadge({ score }: { score: WorkScore | undefined }) {
  const description = score
    ? `تقييم العمل: ${score.rating ?? "بلا تقييم"} من 10 · ${score.scored} من ${score.total} أجزاء مكتملة التقييم`
    : "بلا تقييم";
  const weights = scoreDefinitions
    .map((criterion) => `${criterion.label} ${criterion.weight * 100}%`)
    .join(" · ");
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      aria-label={description}
      title={`${description}\n${weights}`}
    >
      <StarIcon className="size-3.5 fill-current text-primary" aria-hidden="true" />
      {score?.rating === null || !score ? "غير مقيّم" : `${score.rating}`}
      {score && score.scored > 0 && score.scored < score.total && (
        <span className="text-muted-foreground">
          جزئي · {score.scored}/{score.total}
        </span>
      )}
    </span>
  );
}

export function WorkScoreDetails({
  installments,
}: {
  installments: Array<{ title: string; score?: Score; id?: string; position?: number }>;
}) {
  const summary = workScore(installments.map((item) => item.score ?? {}));
  return (
    <Card aria-label="التقييم الموزون للعمل" className="mt-4">
      <CardHeader>
        <CardTitle>تقييم العمل</CardTitle>
        <CardDescription>متوسط تقييمات الأجزاء الموزونة، من 0 إلى 10.</CardDescription>
        <CardAction>
          <div className="flex flex-col items-end gap-1">
            <WorkScoreBadge score={summary} />
            <span className="text-xs text-muted-foreground">
              {summary.scored} من {summary.total} أجزاء مكتملة التقييم
            </span>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-5">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
            {scoreDefinitions.map((criterion) => (
              <div key={criterion.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3 text-sm font-medium">
                  <span>{criterion.label}</span>
                  <span>{criterion.weight * 100}%</span>
                </div>
                <span className="text-xs text-muted-foreground">{criterion.english}</span>
                <p className="text-xs leading-6 text-muted-foreground">{criterion.description}</p>
              </div>
            ))}
          </div>
          {installments.length > 0 && (
            <dl className="grid gap-2 sm:grid-cols-2">
              {installments.map((item) => {
                const rating = installmentRating(item.score ?? {});
                return (
                  <div
                    key={item.id ?? item.position ?? item.title}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <dt>{item.title}</dt>
                    <dd className="shrink-0 font-medium">
                      {rating === null ? "تقييم غير مكتمل" : `${rating}`}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      </CardContent>
      {summary.scored < summary.total && (
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            الأجزاء ذات المعايير الناقصة لا تدخل في المتوسط حتى تكتمل معاييرها الستة.
          </p>
        </CardFooter>
      )}
    </Card>
  );
}
