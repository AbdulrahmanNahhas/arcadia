import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireLocalAdmin } from "@/features/database/database.server";

export const loadWorks = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.string().uuid()).min(1) }))
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const { loadWorkSnapshots } = await import("./work-edit.server");
    return loadWorkSnapshots([...new Set(data.ids)]);
  });
export const reviewWorks = createServerFn({ method: "POST" })
  .validator(
    z.object({
      json: z.string().max(4000000),
      originals: z
        .array(z.object({ id: z.string().uuid(), revision: z.string().length(64) }))
        .min(1),
    }),
  )
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const { prepareWorkReview } = await import("./work-edit.server");
    return prepareWorkReview(data.json, data.originals);
  });
export const saveWorkReview = createServerFn({ method: "POST" })
  .validator(z.object({ ticket: z.string().max(8000000) }))
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const { commitWorkReview } = await import("./work-edit.server");
    return commitWorkReview(data.ticket);
  });

export const checkEpisodeDeletion = createServerFn({ method: "GET" })
  .validator(z.object({ workId: z.string().uuid(), episodeId: z.string().uuid() }))
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const { inspectEpisodeDeletion } = await import("./work-edit.server");
    return inspectEpisodeDeletion(data.workId, data.episodeId);
  });

export const reviewNewWork = createServerFn({ method: "POST" })
  .validator(z.object({ json: z.string().max(4000000) }))
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const { prepareNewWorkReview } = await import("./work-edit.server");
    return prepareNewWorkReview(data.json);
  });
export const parseWorkDraft = createServerFn({ method: "POST" })
  .validator(z.object({ json: z.string().max(4000000) }))
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const { validateWorkDraft } = await import("./work-edit.server");
    return validateWorkDraft(data.json);
  });
