import { installmentRating, scoreWeights, workScore } from "@arcadia/domain";
import type { Scores, WorkDetail } from "@nahhasio/api-contract";

import { criteria } from "../catalog/filter-model";

export function scoreValue(value: number | null | undefined) {
  return value != null && Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
}

export function weightedValue(scores: Scores | null) {
  let total = 0;
  for (const criterion of criteria) {
    const value = scoreValue(scores?.[criterion.key]);
    if (value === null) return null;
    total += value * scoreWeights[criterion.key];
  }
  return total;
}

export function scoreProfile(work: WorkDetail) {
  const complete = work.installments.filter(
    (unit) => installmentRating(unit.scores ?? {}) !== null,
  );
  const totals = complete.flatMap((unit) => {
    const value = weightedValue(unit.scores);
    return value === null ? [] : [value];
  });
  return {
    unroundedAverage: totals.length
      ? totals.reduce((sum, value) => sum + value, 0) / totals.length
      : null,
    summary: workScore(work.installments.map((unit) => unit.scores ?? {})),
    criteria: criteria.map((criterion) => {
      const values = complete.flatMap((unit) => {
        const value = scoreValue(unit.scores?.[criterion.key]);
        return value === null ? [] : [value];
      });
      return {
        ...criterion,
        average: values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : null,
      };
    }),
  };
}
