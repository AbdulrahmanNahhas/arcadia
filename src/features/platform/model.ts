import { z } from "zod";
import type { Entity, Work } from "@/features/library/model";

export const planetSchema = z.object({
  id: z.string(),
  slug: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
  icon: z.string(),
  description: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  displayOrder: z.number().int(),
  classificationHints: z.record(z.string(), z.array(z.string())),
  isActive: z.boolean(),
  workCount: z.number().int().min(0),
  reviewCount: z.number().int().min(0),
});

export type Planet = z.infer<typeof planetSchema>;

export type PlanetWithWorks = Planet & {
  works: Work[];
};

export type PlanetAssignment = {
  workId: string;
  planetId: string;
  source: "migration-default" | "suggested" | "manual";
  confidence: number | null;
  reviewState: "needs-review" | "reviewed";
  featuredRank: number | null;
};

export type RiskAssessment = {
  dimensionId: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  description: string;
  displayOrder: number;
  level: "none" | "low" | "medium" | "high";
  explanation: string;
  notes: string;
};

export type CatalogSearchResult =
  | { type: "work"; id: string; title: string; subtitle: string; imagePath: string | null }
  | { type: "person"; id: string; title: string; subtitle: string; imagePath: string | null }
  | { type: "studio"; id: string; title: string; subtitle: string; imagePath: string | null }
  | { type: "planet"; id: string; slug: string; title: string; subtitle: string; icon: string };

export type RecommendationReason = {
  signal:
    | "tag"
    | "genre"
    | "tone"
    | "planet"
    | "person"
    | "studio"
    | "audience"
    | "score"
    | "risk"
    | "era"
    | "relationship"
    | "country"
    | "source"
    | "kind";
  label: string;
  contribution: number;
};

export type Recommendation = {
  work: Work;
  score: number;
  reasons: RecommendationReason[];
};

export type ValidationIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  entityType: "work" | "person" | "studio" | "planet" | "relationship" | "asset" | "search";
  entityId: string;
  title: string;
  path: string;
  message: string;
  action: string;
};

export type OrganizationRelationship = {
  id: string;
  source: Entity;
  target: Entity;
  type: {
    id: string;
    nameAr: string;
    nameEn: string | null;
    inverseNameAr: string | null;
    category: "corporate" | "historical" | "creative";
    isDirected: boolean;
    allowsCycles: boolean;
  };
  occurredOn: string | null;
  datePrecision: "day" | "month" | "year" | "unknown";
  description: string;
  notes: string;
  prominence: number;
  people: Array<{ entity: Entity; role: string; position: number }>;
};

export type PlatformHomeData = {
  featured: Work[];
  continueExploring: Work[];
  recentlyAdded: Work[];
  highlyRated: Work[];
  recentlyUpdated: Work[];
  planets: PlanetWithWorks[];
};
