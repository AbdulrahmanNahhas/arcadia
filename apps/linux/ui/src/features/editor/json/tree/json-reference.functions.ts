import { rpcInputs, rpcResults } from "@arcadia/contracts/editor-rpc";
import { z } from "zod";

import { gateway } from "@/lib/bridge";
export const jsonVocabularySchema = z.enum([
  "genres",
  "tones",
  "tags",
  "countries",
  "planets",
  "roles",
]);
export type JsonVocabulary = z.infer<typeof jsonVocabularySchema>;
export async function getJsonVocabulary({
  data,
  signal,
}: {
  data: z.input<typeof rpcInputs.vocabulary>;
  signal?: AbortSignal;
}) {
  return rpcResults.vocabulary.parse(
    await gateway.editorCall(
      { operation: "vocabulary", data: rpcInputs.vocabulary.parse(data) },
      signal,
    ),
  );
}
