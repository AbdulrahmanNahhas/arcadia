import { z } from "zod";

/**
 * A title's presentation format — whether it was animated or shot in live action. This is the
 * one axis the catalog has to store, since nothing else about a title implies it; the other
 * axis (film vs. episodic) is derived from the title's own installments, so the two can never
 * disagree with the structure beneath them.
 */
export const titleFormatSchema = z.enum(["animated", "live-action"]);
export type TitleFormat = z.infer<typeof titleFormatSchema>;

/** Film vs. episodic — derived, never stored: a title is a series exactly when it has a season. */
export const titleShapeSchema = z.enum(["movie", "series"]);
export type TitleShape = z.infer<typeof titleShapeSchema>;

/**
 * The four catalog types, one per (format × shape) pair. This is what readers filter, group,
 * and sort by, and what the account-level "which types do I want to see" preference selects
 * from — a single flat value rather than two fields, because every reader-facing surface
 * (browse chips, group headers, the type badge) wants one label.
 */
export const titleKinds = [
  "animated-movie",
  "animated-series",
  "live-action-movie",
  "live-action-series",
] as const;
export const titleKindSchema = z.enum(titleKinds);
export type TitleKind = z.infer<typeof titleKindSchema>;

export function titleKindOf(format: TitleFormat, shape: TitleShape): TitleKind {
  return `${format}-${shape}`;
}

export function titleFormatOf(kind: TitleKind): TitleFormat {
  return kind.startsWith("live-action") ? "live-action" : "animated";
}

export function titleShapeOf(kind: TitleKind): TitleShape {
  return kind.endsWith("-series") ? "series" : "movie";
}

export const titleKindLabels: Record<TitleKind, { ar: string; en: string }> = {
  "animated-movie": { ar: "فيلم رسوم متحركة", en: "Animated Movie" },
  "animated-series": { ar: "مسلسل رسوم متحركة", en: "Animated Series" },
  "live-action-movie": { ar: "فيلم واقعي", en: "Live-Action Movie" },
  "live-action-series": { ar: "مسلسل واقعي", en: "Live-Action Series" },
};

export const titleFormatLabels: Record<TitleFormat, { ar: string; en: string }> = {
  animated: { ar: "رسوم متحركة", en: "Animated" },
  "live-action": { ar: "تمثيل واقعي", en: "Live Action" },
};
