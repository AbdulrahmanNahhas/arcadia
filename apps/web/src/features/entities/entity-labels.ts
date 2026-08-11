import type { Entity, WorkContribution } from "@/features/library/model";

export const entityTypeLabels: Record<Entity["entityType"], string> = {
  person: "أشخاص",
  organization: "منظمات",
};

export const contributionRoleLabels: Record<WorkContribution["role"], string> = {
  author: "مؤلف",
  "original-author": "مؤلف أصلي",
  writer: "كاتب",
  screenwriter: "كاتب سيناريو",
  director: "مخرج",
  illustrator: "رسّام",
  artist: "فنان",
  "animation-studio": "استوديو رسوم متحركة",
  "production-company": "شركة إنتاج",
  producer: "منتج",
  developer: "مطوّر",
  publisher: "ناشر",
  composer: "ملحن",
  editor: "محرر",
  translator: "مترجم",
  creator: "منشئ",
};

export function entityMonogram(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join("");
}
