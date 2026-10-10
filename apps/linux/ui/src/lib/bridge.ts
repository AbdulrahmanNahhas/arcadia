import {
  CatalogFiltersSchema,
  CatalogPageSchema,
  FacetCatalogSchema,
  HomeFeedSchema,
  SessionSchema,
  WorkDetailSchema,
  WorkPageSchema,
  WorkViewerStateSchema,
  WorkActivityPageSchema,
  FavoriteRequestSchema,
  WatchedRequestSchema,
} from "@nahhasio/api-contract";
import type { ApiClient, LoginRequest, WatchedRequest } from "@nahhasio/api-contract";
export type WatchedSelection = Pick<WatchedRequest, "isPlayed"> & {
  installmentId?: string | null;
  episodeId?: string | null;
};
import { z } from "zod";
export type CatalogQuery = NonNullable<Parameters<ApiClient["browseCatalog"]>[0]>;
export type LibraryQuery = NonNullable<Parameters<ApiClient["listWorks"]>[0]>;
const ReplySchema = z.discriminatedUnion("ok", [
  z.object({ id: z.string(), ok: z.literal(true), result: z.json().optional() }),
  z.object({
    id: z.string(),
    ok: z.literal(false),
    error: z.object({ message: z.string(), code: z.string() }),
  }),
]);
type Reply = z.infer<typeof ReplySchema>;
declare global {
  interface Window {
    webkit?: { messageHandlers?: { nahhasio?: { postMessage(message: string): void } } };
    __nahhasioReply?: (reply: Reply) => void;
  }
}
const pending = new Map<
  string,
  { resolve: (reply: Reply) => void; reject: (error: Error) => void }
>();
window["__nahhasioReply"] = (input) => {
  const parsed = ReplySchema.safeParse(input);
  if (!parsed.success) return;
  const waiter = pending.get(parsed.data.id);
  if (!waiter) return;
  pending.delete(parsed.data.id);
  waiter.resolve(parsed.data);
};
export function nativeAvailable() {
  return Boolean(window.webkit?.messageHandlers?.nahhasio);
}
async function call(command: string, payload: z.input<typeof z.json>, signal?: AbortSignal) {
  const handler = window.webkit?.messageHandlers?.nahhasio;
  if (!handler) throw new Error("افتح نهّاسيو من تطبيق Linux للاتصال بمكتبتك.");
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const id = crypto.randomUUID();
  let timer: ReturnType<typeof setTimeout>;
  const response = await new Promise<Reply>((resolve, reject) => {
    const abort = () => {
      pending.delete(id);
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("انتهت مهلة الاتصال. تحقق من تشغيل الخادم ثم أعد المحاولة."));
    }, 25000);
    const finish = (reply: Reply) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve(reply);
    };
    pending.set(id, { resolve: finish, reject });
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const send = handler.postMessage.bind(handler);
      send(JSON.stringify({ id, command, payload }));
    } catch {
      clearTimeout(timer);
      pending.delete(id);
      reject(new Error("تعذر الاتصال بالتطبيق."));
    }
  });
  if (!response.ok) {
    if (response.error.code === "unauthorized" && command !== "login")
      window.dispatchEvent(new Event("nahhasio:signed-out"));
    throw new Error(response.error.message);
  }
  return response.result;
}
export const gateway = {
  session: async (signal?: AbortSignal) =>
    SessionSchema.nullable().parse(await call("session", {}, signal)),
  login: async (payload: LoginRequest) => SessionSchema.parse(await call("login", payload)),
  logout: async () => {
    await call("logout", {});
  },
  works: async (query: LibraryQuery, signal?: AbortSignal) =>
    WorkPageSchema.parse(await call("works", query, signal)),
  browse: async (query: CatalogQuery, signal?: AbortSignal) =>
    CatalogPageSchema.parse(await call("browse", query, signal)),
  facets: async (query: CatalogQuery, signal?: AbortSignal) =>
    FacetCatalogSchema.parse(await call("facets", query, signal)),

  home: async (signal?: AbortSignal) => HomeFeedSchema.parse(await call("home", {}, signal)),
  filters: async (signal?: AbortSignal) =>
    CatalogFiltersSchema.parse(await call("filters", {}, signal)),
  work: async (id: string, signal?: AbortSignal) =>
    WorkDetailSchema.parse(await call("work", { id }, signal)),
  workState: async (id: string, signal?: AbortSignal) =>
    WorkViewerStateSchema.parse(await call("workState", { id }, signal)),
  setFavorite: async (workId: string, isFavorite: boolean) => {
    const input = FavoriteRequestSchema.parse({ isFavorite });
    return WorkViewerStateSchema.parse(await call("setFavorite", { workId, ...input }));
  },
  setWatched: async (workId: string, selection: WatchedSelection) => {
    const input = WatchedRequestSchema.parse({
      installmentId: selection.installmentId ?? null,
      episodeId: selection.episodeId ?? null,
      isPlayed: selection.isPlayed,
    });
    if (input.episodeId !== null && input.installmentId === null)
      throw new Error("اختر الجزء الذي تنتمي إليه الحلقة.");
    return WorkViewerStateSchema.parse(await call("setWatched", { workId, ...input }));
  },
  workActivity: async (id: string, page = 1, signal?: AbortSignal) => {
    z.number().int().min(1).max(100000).parse(page);
    return WorkActivityPageSchema.parse(await call("workActivity", { id, page }, signal));
  },
  artwork: async (id: string, signal?: AbortSignal) =>
    z
      .object({ dataUrl: z.string().regex(/^data:image\/(?:png|jpeg|webp|avif|gif);base64,/) })
      .parse(await call("artwork", { id }, signal)).dataUrl,
};
