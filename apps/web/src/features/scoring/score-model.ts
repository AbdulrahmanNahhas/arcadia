import { scoreWeights } from "@arcadia/domain";
import { z } from "zod";

export const workScoreVersion = "weighted-average-v1";

export const workScoreSchema = z.object({
  rating: z.number().min(0).max(10).nullable(),
  scored: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const scoreDefinitions = [
  {
    key: "story",
    label: "القصة والحبكة",
    english: "Story & Plot",
    description: "بناء السرد، الإيقاع، الاتساق، اكتمال الحبكة وجودة الحكي.",
    weight: scoreWeights.story,
  },
  {
    key: "characters",
    label: "الشخصيات",
    english: "Characters",
    description: "التطور، الدوافع، العلاقات، الحوار والأثر العاطفي.",
    weight: scoreWeights.characters,
  },
  {
    key: "depth",
    label: "العمق",
    english: "Depth",
    description: "الأفكار، التعقيد النفسي، الأسئلة الأخلاقية، الرمزية والمعنى.",
    weight: scoreWeights.depth,
  },
  {
    key: "worldBuilding",
    label: "بناء العالم",
    english: "Worldbuilding",
    description: "المكان، الأجواء، الاتساق الداخلي، التاريخ وقواعد العالم.",
    weight: scoreWeights.worldBuilding,
  },
  {
    key: "originality",
    label: "الأصالة",
    english: "Originality",
    description: "مدى تميّز العمل عن القصص والأعراف القائمة.",
    weight: scoreWeights.originality,
  },
  {
    key: "craft",
    label: "الإبداع والتنفيذ",
    english: "Creativity & Execution",
    description: "الإخراج، التحريك، التصوير، الموسيقى، السرد البصري والتنفيذ الفني.",
    weight: scoreWeights.craft,
  },
] as const;
