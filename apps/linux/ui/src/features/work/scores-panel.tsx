import { installmentRating } from "@arcadia/domain";
import type { WorkDetail } from "@nahhasio/api-contract";

import { ScoreBadge } from "../../components/media-card";
import { criteria } from "../catalog/filter-model";
import { Section } from "./field-list";
import { dateLabel } from "./format";
export function ScoresPanel({ work }: { work: WorkDetail }) {
  return (
    <>
      <Section title="بصمة التقييم">
        <ScoreBadge score={work.score} />
        <p className="text-sm leading-[2.1] whitespace-pre-line wrap-anywhere">
          تقييم العمل هو متوسط الأجزاء التي اكتملت معاييرها الستة. تُحسب الأوزان قبل التقريب إلى منزلة
          عشرية. الأجزاء ناقصة التقييم لا تُعامل كصفر.
        </p>
        <div className="mt-6.25 flex flex-wrap gap-2.5">
          {criteria.map((c) => (
            <span className="rounded-full bg-secondary px-3.25 py-1.25 text-[11px]" key={c.key}>
              {c.label} · {c.weight}%
            </span>
          ))}
        </div>
      </Section>
      {work.installments.map((unit) => (
        <Section key={unit.id} title={unit.title}>
          <ScoreBadge
            score={{
              rating: installmentRating(unit.scores ?? {}),
              scored: installmentRating(unit.scores ?? {}) === null ? 0 : 1,
              total: 1,
            }}
          />
          <div className="my-6.25 grid grid-cols-3 gap-5 [@media(max-width:750px)]:grid-cols-2">
            {criteria.map((c) => (
              <div className="grid grid-cols-[1fr_auto] gap-3.75 text-[13px]" key={c.key}>
                <span>{c.label}</span>
                <strong>{unit.scores?.[c.key] ?? "غير مقيّم"}</strong>
                <meter
                  className="col-span-full h-2 w-full accent-(--gold)"
                  min={0}
                  max={10}
                  value={unit.scores?.[c.key] ?? 0}
                  aria-label={c.label}
                />
              </div>
            ))}
          </div>
          <p className="text-[13px] leading-[1.9] text-muted-foreground">
            آخر تحديث للتقييم: {dateLabel(unit.scores?.updatedAt)}
          </p>
        </Section>
      ))}
    </>
  );
}
