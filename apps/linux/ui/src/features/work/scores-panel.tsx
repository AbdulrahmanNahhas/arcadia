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
        <p className="long-copy">
          تقييم العمل هو متوسط الأجزاء التي اكتملت معاييرها الستة. تُحسب الأوزان قبل التقريب إلى منزلة
          عشرية. الأجزاء ناقصة التقييم لا تُعامل كصفر.
        </p>
        <div className="criteria-weights">
          {criteria.map((c) => (
            <span key={c.key}>
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
          <div className="criterion-grid">
            {criteria.map((c) => (
              <div key={c.key}>
                <span>{c.label}</span>
                <strong>{unit.scores?.[c.key] ?? "غير مقيّم"}</strong>
                <meter min={0} max={10} value={unit.scores?.[c.key] ?? 0} aria-label={c.label} />
              </div>
            ))}
          </div>
          <p className="muted-copy">آخر تحديث للتقييم: {dateLabel(unit.scores?.updatedAt)}</p>
        </Section>
      ))}
    </>
  );
}
