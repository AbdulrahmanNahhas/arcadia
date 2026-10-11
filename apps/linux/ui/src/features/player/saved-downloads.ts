import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { nativeCall } from "@/lib/bridge";

const SavedSchema = z
  .array(
    z.object({
      target: z.object({
        workId: z.string().uuid(),
        installmentId: z.string().uuid().nullable(),
        episodeId: z.string().uuid().nullable(),
      }),
      available: z.boolean(),
    }),
  )
  .max(4096);

export function savedDownloadOptions() {
  return queryOptions({
    queryKey: ["native", "downloads"] as const,
    queryFn: async () => SavedSchema.parse(await nativeCall("media.saved", {})),
    staleTime: 5000,
    retry: false,
    networkMode: "always",
  });
}
