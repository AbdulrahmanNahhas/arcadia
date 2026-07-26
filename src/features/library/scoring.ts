import type { WorkKind } from "./model"

export const scoreCriteria = [
  "story",
  "characters",
  "depth",
  "worldBuilding",
  "originality",
  "craft",
] as const

export type ScoreCriterion = (typeof scoreCriteria)[number]
export type ScoreComponents = Partial<Record<ScoreCriterion, number>>

export const scoreWeights = {
  story: 0.25,
  characters: 0.2,
  depth: 0.15,
  worldBuilding: 0.1,
  originality: 0.1,
  craft: 0.2,
} as const satisfies Record<ScoreCriterion, number>

export const scoreCriterionLabels: Record<
  ScoreCriterion,
  { ar: string; en: string }
> = {
  story: { ar: "القصة", en: "Story" },
  characters: { ar: "الشخصيات", en: "Characters" },
  depth: { ar: "العمق والأفكار", en: "Depth & themes" },
  worldBuilding: { ar: "بناء العالم", en: "World-building" },
  originality: { ar: "الأصالة", en: "Originality" },
  craft: { ar: "الحِرفة", en: "Craft" },
}

const craftLabels: Record<WorkKind, { ar: string; en: string }> = {
  anime: {
    ar: "التحريك والحِرفة السمعية البصرية",
    en: "Animation & audiovisual craft",
  },
  movie: {
    ar: "الإخراج والحِرفة السمعية البصرية",
    en: "Direction & audiovisual craft",
  },
  series: {
    ar: "الإخراج والحِرفة السمعية البصرية",
    en: "Direction & audiovisual craft",
  },
  novel: { ar: "النثر والحِرفة الأدبية", en: "Prose & literary craft" },
  manga: { ar: "الرسم والسرد المتتابع", en: "Art & sequential storytelling" },
  comic: { ar: "الرسم والسرد المتتابع", en: "Art & sequential storytelling" },
  game: {
    ar: "أسلوب اللعب والتصميم التفاعلي",
    en: "Gameplay & interactive design",
  },
  "visual-novel": {
    ar: "النثر والرسم والتفاعل",
    en: "Prose, art & interaction",
  },
}

export function scoreLabel(criterion: ScoreCriterion, kind: WorkKind) {
  return criterion === "craft"
    ? craftLabels[kind]
    : scoreCriterionLabels[criterion]
}

export function calculatedRating(components: ScoreComponents): number | null {
  if (
    !scoreCriteria.every(
      (criterion) =>
        typeof components[criterion] === "number" &&
        Number.isFinite(components[criterion]) &&
        components[criterion]! >= 0 &&
        components[criterion]! <= 10
    )
  ) {
    return null
  }

  const weighted = scoreCriteria.reduce(
    (total, criterion) =>
      total + components[criterion]! * scoreWeights[criterion],
    0
  )
  return Math.round(weighted * 10) / 10
}
