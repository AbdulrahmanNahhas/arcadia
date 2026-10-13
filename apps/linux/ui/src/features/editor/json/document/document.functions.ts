import { rpcInputs, rpcResults } from "@arcadia/contracts/editor-rpc";
import { z } from "zod";

import { gateway } from "@/lib/bridge";
type Request<T> = { data: T; signal?: AbortSignal };
export async function loadWorks({ data, signal }: Request<z.input<typeof rpcInputs.read>>) {
  return rpcResults.read.parse(
    await gateway.editorCall({ operation: "read", data: rpcInputs.read.parse(data) }, signal),
  );
}
export async function reviewWorks({ data, signal }: Request<z.input<typeof rpcInputs.review>>) {
  return rpcResults.review.parse(
    await gateway.editorCall({ operation: "review", data: rpcInputs.review.parse(data) }, signal),
  );
}
export async function saveWorkReview({ data, signal }: Request<z.input<typeof rpcInputs.save>>) {
  return rpcResults.save.parse(
    await gateway.editorCall({ operation: "save", data: rpcInputs.save.parse(data) }, signal),
  );
}
export async function reviewNewWork({ data, signal }: Request<z.input<typeof rpcInputs.create>>) {
  return rpcResults.create.parse(
    await gateway.editorCall({ operation: "create", data: rpcInputs.create.parse(data) }, signal),
  );
}
export async function parseWorkDraft({ data, signal }: Request<z.input<typeof rpcInputs.parse>>) {
  return rpcResults.parse.parse(
    await gateway.editorCall({ operation: "parse", data: rpcInputs.parse.parse(data) }, signal),
  );
}
export async function checkEpisodeDeletion({
  data,
  signal,
}: Request<z.input<typeof rpcInputs.links>>) {
  return rpcResults.links.parse(
    await gateway.editorCall({ operation: "links", data: rpcInputs.links.parse(data) }, signal),
  );
}
