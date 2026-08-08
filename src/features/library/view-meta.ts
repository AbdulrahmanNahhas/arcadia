import type { Icon } from "@phosphor-icons/react";
import {
  BookmarkSimpleIcon,
  BooksIcon,
  CalendarBlankIcon,
  ChartDonutIcon,
  ClockIcon,
  FilmSlateIcon,
  GameControllerIcon,
  GridFourIcon,
  HeartIcon,
  LightningIcon,
  SparkleIcon,
  StarIcon,
} from "@phosphor-icons/react";
import type { SavedViewColorId, SavedViewIconId } from "./model";

export const savedViewIconOptions: Array<{
  id: SavedViewIconId;
  label: string;
  icon: Icon;
}> = [
  { id: "bookmark", label: "علامة", icon: BookmarkSimpleIcon },
  { id: "books", label: "كتب", icon: BooksIcon },
  { id: "film", label: "أفلام", icon: FilmSlateIcon },
  { id: "sparkle", label: "مميز", icon: SparkleIcon },
  { id: "game", label: "ألعاب", icon: GameControllerIcon },
  { id: "heart", label: "مفضلة", icon: HeartIcon },
  { id: "clock", label: "وقت", icon: ClockIcon },
  { id: "star", label: "نجمة", icon: StarIcon },
  { id: "grid", label: "شبكة", icon: GridFourIcon },
  { id: "chart", label: "إحصاءات", icon: ChartDonutIcon },
  { id: "calendar", label: "تقويم", icon: CalendarBlankIcon },
  { id: "lightning", label: "سريع", icon: LightningIcon },
];

export const savedViewColorOptions: Array<{
  id: SavedViewColorId;
  label: string;
  token: string;
}> = [
  { id: "primary", label: "الرئيسي", token: "var(--primary)" },
  { id: "coral", label: "مرجاني", token: "var(--chart-1)" },
  { id: "amber", label: "كهرماني", token: "var(--chart-2)" },
  { id: "green", label: "أخضر", token: "var(--chart-3)" },
  { id: "blue", label: "أزرق", token: "var(--chart-4)" },
  { id: "violet", label: "بنفسجي", token: "var(--chart-5)" },
  { id: "danger", label: "أحمر", token: "var(--destructive)" },
  { id: "neutral", label: "محايد", token: "var(--foreground)" },
];

export function getSavedViewIcon(id: SavedViewIconId) {
  return savedViewIconOptions.find((option) => option.id === id)?.icon ?? BookmarkSimpleIcon;
}

export function getSavedViewColorToken(id: SavedViewColorId) {
  return savedViewColorOptions.find((option) => option.id === id)?.token ?? "var(--primary)";
}

export function getSavedViewAccentStyle(id: SavedViewColorId) {
  const color = getSavedViewColorToken(id);
  return {
    color,
    backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
    borderColor: `color-mix(in oklab, ${color} 28%, transparent)`,
  };
}
