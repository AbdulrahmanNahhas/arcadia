import { rpcInputs, rpcResults } from "@arcadia/contracts/editor-rpc";
import { z } from "zod";

import { gateway } from "@/lib/bridge";
type Request<T> = { data: T; signal?: AbortSignal };
export async function searchArtwork({ data, signal }: Request<z.input<typeof rpcInputs.search>>) {
  return rpcResults.search.parse(
    await gateway.editorCall({ operation: "search", data: rpcInputs.search.parse(data) }, signal),
  );
}
export async function ingestArtwork({ data, signal }: Request<z.input<typeof rpcInputs.ingest>>) {
  return rpcResults.ingest.parse(
    await gateway.editorCall({ operation: "ingest", data: rpcInputs.ingest.parse(data) }, signal),
  );
}
export async function uploadArtwork({ data, signal }: Request<z.input<typeof rpcInputs.upload>>) {
  return rpcResults.upload.parse(
    await gateway.editorCall({ operation: "upload", data: rpcInputs.upload.parse(data) }, signal),
  );
}
