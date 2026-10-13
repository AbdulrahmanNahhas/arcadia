import { z } from "zod";
export const editorSearchSchema = z.object({ ids: z.string().max(1200).catch("").default("") });

export const workEditorSearchSchema = z.object({
  section: z
    .enum(["identity", "structure", "indexing", "editorial", "images", "awards", "references"])
    .catch("identity")
    .default("identity"),
});
