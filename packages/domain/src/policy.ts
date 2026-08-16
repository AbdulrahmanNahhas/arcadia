import { z } from "zod";
import type { Classification } from "./classification";
import { intersectClassifications, isClassificationAllowed } from "./classification";

export const filterTreeSchema: z.ZodType<FilterTree> = z.lazy(() =>
  z.union([
    z.object({ op: z.enum(["and", "or"]), children: z.array(filterTreeSchema).min(1).max(20) }),
    z.object({ op: z.literal("not"), child: filterTreeSchema }),
    z.object({
      op: z.literal("in"),
      field: z.enum(["planet", "genre", "tag", "tone", "country", "person", "studio"]),
      values: z.array(z.string().min(1)).min(1).max(100),
    }),
  ]),
);
export type FilterTree =
  | { op: "and" | "or"; children: FilterTree[] }
  | { op: "not"; child: FilterTree }
  | {
      op: "in";
      field: "planet" | "genre" | "tag" | "tone" | "country" | "person" | "studio";
      values: string[];
    };

export type VisibilityPolicy = {
  maximum: Classification;
  blockedTitleIds: ReadonlySet<string>;
  blockedTagIds: ReadonlySet<string>;
  blockedGenreIds: ReadonlySet<string>;
  blockedEntityIds: ReadonlySet<string>;
  blockedPlanetIds: ReadonlySet<string>;
};

export type VisibilityCandidate = {
  id: string;
  classification: Classification;
  tagIds?: readonly string[];
  genreIds?: readonly string[];
  entityIds?: readonly string[];
  planetIds?: readonly string[];
};

export function isVisibleToPolicy(candidate: VisibilityCandidate, policy: VisibilityPolicy) {
  if (!isClassificationAllowed(candidate.classification, policy.maximum)) return false;
  if (policy.blockedTitleIds.has(candidate.id)) return false;
  const hasBlocked = (values: readonly string[] | undefined, blocked: ReadonlySet<string>) =>
    values?.some((value) => blocked.has(value)) ?? false;
  return !(
    hasBlocked(candidate.tagIds, policy.blockedTagIds) ||
    hasBlocked(candidate.genreIds, policy.blockedGenreIds) ||
    hasBlocked(candidate.entityIds, policy.blockedEntityIds) ||
    hasBlocked(candidate.planetIds, policy.blockedPlanetIds)
  );
}

export const languagePolicySchema = z
  .object({
    preferredAudio: z.array(z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)).max(20),
    allowedAudio: z
      .array(z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/))
      .min(1)
      .max(50),
    subtitleMode: z.enum(["off", "allowed"]),
    canSwitchTracks: z.boolean(),
  })
  .superRefine((policy, context) => {
    for (const language of policy.preferredAudio)
      if (!policy.allowedAudio.includes(language))
        context.addIssue({
          code: "custom",
          message: "Preferred audio must be allowed",
          path: ["preferredAudio"],
        });
  });

export function effectivePolicy(profile: Classification, restriction: Classification | null) {
  return restriction ? intersectClassifications(profile, restriction) : profile;
}
