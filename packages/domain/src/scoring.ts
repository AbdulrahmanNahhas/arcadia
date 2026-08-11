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
export const scoreWeights: Record<ScoreCriterion, number> = {
  story: 0.25,
  characters: 0.2,
  depth: 0.15,
  worldBuilding: 0.1,
  originality: 0.1,
  craft: 0.2,
};

export function installmentRating(score: Score): number | null {
  const values = scoreCriteria.map((criterion) => score[criterion]);
  if (
    !values.every(
      (value): value is number => typeof value === "number" && value >= 0 && value <= 10,
    )
  )
    return null;
  const rating = scoreCriteria.reduce((total, criterion, index) => {
    const value = values[index];
    return total + (typeof value === "number" ? value : 0) * scoreWeights[criterion];
  }, 0);
  return Math.round(rating * 10) / 10;
}

export function titleRating(scores: Score[]) {
  const complete = scores.map(installmentRating).filter((value): value is number => value !== null);
  return {
    rating: complete.length
      ? Math.round((complete.reduce((a, b) => a + b, 0) / complete.length) * 10) / 10
      : null,
    scored: complete.length,
    total: scores.length,
  };
}
