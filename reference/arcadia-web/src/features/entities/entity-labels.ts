import type { Entity, WorkContribution } from "@/features/library/model";

export const entityTypeLabels = {
  person: "أشخاص",
  organization: "منظمات",
} satisfies Record<Entity["entityType"], string>;

export const contributionRoleLabels = {
  creator: "منشئ",
  original_author: "مؤلف أصلي",
  director: "مخرج",
  writer: "كاتب",
  producer: "منتج",
  executive_producer: "منتج تنفيذي",
  creative_producer: "منتج إبداعي",
  character_designer: "مصمم شخصيات",
  art_director: "مدير فني",
  scene_design: "تصميم المشاهد",
  composer: "ملحن",
  animation_studio: "استوديو رسوم متحركة",
  production_company: "شركة إنتاج",
  distributor: "موزّع",
  publisher: "ناشر",
} satisfies Record<WorkContribution["role"], string>;

export function entityMonogram(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join("");
}
