export const scoreCriteria = [
  "story",
  "characters",
  "depth",
  "worldBuilding",
  "originality",
  "craft",
] as const;
export type ScoreCriterion = (typeof scoreCriteria)[number];
export type Score = Partial<Record<ScoreCriterion, number | null>>;
export const scoreWeights = {
  story: 0.25,
  characters: 0.2,
  depth: 0.2,
  worldBuilding: 0.1,
  originality: 0.1,
  craft: 0.15,
} satisfies Record<ScoreCriterion, number>;

function weightedInstallmentValue(score: Score): number | null {
  const values = scoreCriteria.map((criterion) => score[criterion]);
  if (
    !values.every(
      (value): value is number => typeof value === "number" && value >= 0 && value <= 10,
    )
  )
    return null;
  return scoreCriteria.reduce((total, criterion, index) => {
    const value = values[index];
    return total + (value ?? 0) * scoreWeights[criterion];
  }, 0);
}

export function installmentRating(score: Score): number | null {
  const rating = weightedInstallmentValue(score);
  return rating === null ? null : Math.round(rating * 10) / 10;
}

export function workScore(scores: Score[]) {
  const complete = scores
    .map(weightedInstallmentValue)
    .filter((value): value is number => value !== null);
  return {
    rating: complete.length
      ? Math.round((complete.reduce((sum, value) => sum + value, 0) / complete.length) * 10) / 10
      : null,
    scored: complete.length,
    total: scores.length,
  };
}

export type WorkScore = ReturnType<typeof workScore>;

export function titleRating(scores: Score[]) {
  const score = workScore(scores);
  return score;
}
