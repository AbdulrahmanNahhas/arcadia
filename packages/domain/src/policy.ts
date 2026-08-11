import { z } from "zod";
import type { Classification } from "./classification";
import { intersectClassifications } from "./classification";

export const filterTreeSchema: z.ZodType<FilterTree> = z.lazy(() =>
  z.union([
    z.object({ op: z.enum(["and", "or"]), children: z.array(filterTreeSchema).min(1).max(20) }),
    z.object({ op: z.literal("not"), child: filterTreeSchema }),
    z.object({
      op: z.literal("in"),
      field: z.enum(["planet", "genre", "tag"]),
      values: z.array(z.string().min(1)).min(1).max(100),
    }),
  ]),
);
export type FilterTree =
  | { op: "and" | "or"; children: FilterTree[] }
  | { op: "not"; child: FilterTree }
  | { op: "in"; field: "planet" | "genre" | "tag"; values: string[] };

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
