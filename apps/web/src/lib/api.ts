import type { BrowseResponse, TitleDetail } from "@arcadia/contracts";
import type { paths } from "@arcadia/contracts/openapi";
import createClient from "openapi-fetch";

/** Same `localStorage` key convention `settings-page.tsx` already uses for the theme
 *  preference (`arcadia:theme`) — no new persistence mechanism needed for one string. */
const apiUrlOverrideKey = "arcadia:apiUrl";

/**
 * Lets one desktop build serve any device on the LAN without a rebuild per server address (see
 * `docs/deployment-and-release-roadmap.md` §3). `VITE_API_URL` is baked in at build time — fine
 * as a default, wrong as the *only* option once the family's server address can differ from the
 * one a given build was compiled against. Read once at module load, same as the build-time value
 * always was; changing it takes a reload to apply (`setApiUrlOverride` below reloads the page),
 * simpler than threading a reactive base URL through every consumer of the `apiBaseUrl` constant.
 */
function readApiUrlOverride(): string | null {
  if (import.meta.env.SSR) return null;
  try {
    return window.localStorage.getItem(apiUrlOverrideKey);
  } catch {
    return null;
  }
}

/**
 * `VITE_API_URL=same-origin` is what the container image is built with (apps/web/Dockerfile):
 * nginx serves the bundle and proxies `/api`, `/media` and `/openapi.json` to the API, so the
 * app talks to whatever origin it was loaded from and one image serves every server address.
 * Meaningless for the desktop shell (its origin is the bundled app) — that build keeps a real URL.
 */
const sameOrigin = "same-origin";

function resolveApiBaseUrl() {
  const configured =
    readApiUrlOverride() || import.meta.env.VITE_API_URL || "http://127.0.0.1:23101";
  if (import.meta.env.SSR) return configured === sameOrigin ? "" : configured;
  if (configured === sameOrigin) return window.location.origin;

  const url = new URL(configured);
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (loopbackHosts.has(url.hostname) && loopbackHosts.has(window.location.hostname)) {
    url.hostname = window.location.hostname;
  }
  return url.origin;
}

export const apiBaseUrl = resolveApiBaseUrl();

/** The build-time default, for a settings UI to show what "reset" would fall back to. */
export const apiBaseUrlDefault =
  import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== sameOrigin
    ? import.meta.env.VITE_API_URL
    : "http://127.0.0.1:23101";

/**
 * Persists (or, given `null`, clears) the API URL override and reloads the page so every
 * already-initialized consumer of `apiBaseUrl` picks it up.
 *
 * Deliberately a page reload rather than `@tauri-apps/plugin-process`'s `relaunch()`, which this
 * used to call: `relaunch()` restarts the *app binary*, and under `tauri dev` the CLI treats the
 * app exiting as the end of the session and tears down the vite dev server it spawned — so the
 * relaunched window loads `devUrl` with nothing listening behind it and dies on "Connection
 * refused". A reload re-executes the module graph in the same process, which is all that's
 * actually needed here, since `apiBaseUrl` is resolved once at module load from `localStorage`.
 */
export async function setApiUrlOverride(url: string | null) {
  if (url) {
    if (!URL.canParse(url)) throw new TypeError(`Invalid URL: ${url}`);
    window.localStorage.setItem(apiUrlOverrideKey, url);
  } else {
    window.localStorage.removeItem(apiUrlOverrideKey);
  }
  window.location.reload();
}

/**
 * Media (posters/banners/logos/profile photos) is served by the API from a directory outside the
 * web build (see `apps/api/src/media-storage.ts`) rather than shipped inside `apps/web/public` —
 * the API returns root-relative paths like `/media/uploads/...`, exactly as before, but a
 * root-relative path only resolves correctly when the current page's own origin is the API's
 * origin. That's true for a browser tab hitting the API directly, but never true inside the Tauri
 * desktop app (its webview's origin is the bundled app, not the API), so media path fields are
 * rewritten to an absolute `${apiBaseUrl}` URL right here, the one place every API response
 * already passes through — no render call site anywhere else needs to know this changed.
 *
 * Most catalog projections call the field `imagePath`, `posterPath`, etc. The media library's
 * canonical asset record deliberately calls it just `path`, however, so that field must follow
 * the same rule. Missing it made every media-library and existing-asset-picker thumbnail request
 * the web origin after media moved out of the web build.
 */
/** A parsed JSON value — every API response body is one of these before it's cast to its
 *  contract type, which is exactly the shape `rewriteMediaUrls` needs to walk recursively. */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function isJsonRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRewritableMediaPath(key: string, value: JsonValue): value is string {
  return (
    (key.endsWith("Path") || key === "path") &&
    typeof value === "string" &&
    value.startsWith("/media/")
  );
}

function rewriteMediaPaths(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map((item) => rewriteMediaPaths(item));
  if (isJsonRecord(value)) {
    const result: { [key: string]: JsonValue } = {};
    for (const [key, entryValue] of Object.entries(value)) {
      result[key] = isRewritableMediaPath(key, entryValue)
        ? `${apiBaseUrl}${entryValue}`
        : rewriteMediaPaths(entryValue);
    }
    return result;
  }
  return value;
}

export function rewriteMediaUrls<T>(value: T): T {
  // SAFETY: every call site passes a value decoded from an API response body (or a piece of
  // one), which is always JSON — a string/number/boolean/null, or an array/object built from
  // those — so it always fits `JsonValue`.
  const rewritten = rewriteMediaPaths(value as JsonValue);
  // SAFETY: `rewriteMediaPaths` preserves every key and array position, changing only string
  // leaves that satisfy `isRewritableMediaPath`, so the result still fits the same `T` shape
  // `value` had.
  return rewritten as T;
}

/**
 * The desktop app's session token, kept alongside the API URL override it depends on.
 *
 * The session cookie the API sets is unusable from the desktop shell: its page origin
 * (`http://tauri.localhost`, or `http://127.0.0.1:23100` under `tauri dev`) is a different *site*
 * from the server's LAN address, so a `SameSite=Lax` cookie is accepted and then never sent back.
 * `SameSite=None` would require `Secure`, and a LAN server has no certificate. Better Auth's
 * bearer plugin (see the API's `auth.ts`) hands back the same session in a header instead, which
 * no same-site rule applies to — so the token is what actually keeps the family logged in.
 */
const sessionTokenKey = "arcadia:sessionToken";

export function readSessionToken(): string | null {
  try {
    return globalThis.localStorage?.getItem(sessionTokenKey) ?? null;
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null) {
  try {
    if (token) globalThis.localStorage?.setItem(sessionTokenKey, token);
    else globalThis.localStorage?.removeItem(sessionTokenKey);
  } catch {
    // A webview with storage disabled still works for one session; it just won't stay signed in.
  }
}

/**
 * Checks whether an address actually answers as an Arcadia server, and reports *why* it didn't.
 * Shared by the login screen's recovery panel and the settings page, which are the two places the
 * family can be pointed at the wrong machine — "it didn't work" is not enough to act on there: a
 * refused connection (wrong address or port), a timeout (a firewall dropping packets), and a
 * server that answers with the wrong status all need different fixes.
 */
export async function pingServer(
  url: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const origin = new URL(url).origin;
    const response = await fetch(`${origin}/api/v1/health`, {
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) return { ok: false, reason: `الخادم ردّ برمز ${response.status}` };
    return { ok: true };
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      return { ok: false, reason: "انتهت المهلة دون رد — غالبًا جدار حماية يحجب المنفذ." };
    }
    return { ok: false, reason: cause instanceof Error ? cause.message : "خطأ غير معروف" };
  }
}

/** Adds the bearer token when there is one, leaving cookie auth untouched when there isn't. */
function withSessionToken(init?: HeadersInit) {
  const headers = new Headers(init);
  const token = readSessionToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

/** `fetch` with the session cookie *and* the desktop bearer token — for the few raw-bytes
 *  responses (subtitle files) that cannot go through `apiFetch`'s JSON path. */
export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: withSessionToken(init?.headers),
  });
}

const client = createClient<paths>({ baseUrl: apiBaseUrl, fetch: authenticatedFetch });

/** A single Zod validation issue, as the API returns it (see `adminErrorSchema` in contracts). */
export interface ApiErrorIssue {
  path: Array<string | number>;
  message: string;
}

/**
 * Thrown by `apiFetch` on any non-OK response. Carries the HTTP status and, when the API
 * returned structured Zod issues (most 400s from admin write routes), the per-field breakdown —
 * previously discarded here, leaving callers with only one flat message no matter how many
 * fields actually failed validation. `error instanceof Error` still holds for existing callers
 * that only check that.
 *
 * `code` is the machine-readable discriminant some routes send alongside `message` (playback
 * source discovery is the first). Callers branch on it rather than matching on Arabic prose.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly issues: ApiErrorIssue[] | undefined;
  readonly code: string | undefined;

  constructor(message: string, status: number, issues?: ApiErrorIssue[], code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
    this.code = code;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: withSessionToken({ "Content-Type": "application/json", ...init?.headers }),
  });
  if (!response.ok) {
    // SAFETY: the shape below is only ever read through optional chaining (`body?.message`,
    // `body?.issues`, `body?.code`) with a fallback for each, so a body that doesn't actually
    // match — a non-JSON error page, a differently shaped payload — degrades to the fallback
    // message below rather than throwing.
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      issues?: ApiErrorIssue[];
      code?: string;
    } | null;
    throw new ApiError(
      body?.message ?? `Arcadia API request failed (${response.status})`,
      response.status,
      Array.isArray(body?.issues) ? body.issues : undefined,
      body?.code,
    );
  }
  // SAFETY: `T` is the type the caller declares for this specific `path`; the API validates its
  // own response bodies against the OpenAPI contract those types are generated from.
  return rewriteMediaUrls((await response.json()) as T);
}

export async function browseTitles(query: Record<string, string | number> = {}) {
  const { data, error } = await client.GET("/api/v1/titles", { params: { query } });
  if (error || !data) throw new Error("تعذّر تحميل الأرشيف من واجهة Arcadia.");
  // SAFETY: `client` is generated from the same OpenAPI document `BrowseResponse` is generated
  // from, so a successful `/api/v1/titles` response always matches it.
  return rewriteMediaUrls(data as BrowseResponse);
}

/**
 * A genuinely unreachable server (no network, or the family server itself is down) falls back to
 * whatever this title's own "save for offline" copy holds (see
 * `features/library/offline-store.ts`) rather than surfacing an error — exactly the point of that
 * feature. A *reachable* server answering with a real error (404, 500, a validation failure)
 * still throws normally; only `fetch` itself throwing (offline, DNS failure, connection refused)
 * counts as "unreachable" here.
 */
async function fetchTitleOrThrow(titleId: string) {
  return client.GET("/api/v1/titles/{titleId}", { params: { path: { titleId } } });
}

export async function getTitle(titleId: string) {
  let result: Awaited<ReturnType<typeof fetchTitleOrThrow>>;
  try {
    result = await fetchTitleOrThrow(titleId);
  } catch (cause) {
    // fetch itself threw — offline, DNS failure, connection refused. A reachable server
    // answering with a real error (404, 500, a validation failure) never reaches this branch.
    const { getOfflineTitle } = await import("@/features/library/offline-store");
    const offline = await getOfflineTitle(titleId);
    if (offline) return offline;
    throw cause;
  }
  if (result.response.status === 404) return null;
  if (result.error || !result.data) throw new Error("تعذّر تحميل تفاصيل العنوان.");
  // SAFETY: `client` is generated from the same OpenAPI document `TitleDetail` is generated
  // from, so a successful `/api/v1/titles/{titleId}` response always matches it.
  return rewriteMediaUrls(result.data as TitleDetail);
}

export async function getPlanets() {
  const { data, error } = await client.GET("/api/v1/planets");
  if (error || !data) throw new Error("تعذّر تحميل الكواكب.");
  // SAFETY: `client` is generated from the same OpenAPI document, so a successful
  // `/api/v1/planets` response always has exactly these fields.
  return data as Array<{
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string | null;
    icon: string;
    description: string;
    primaryColor: string;
    secondaryColor: string;
  }>;
}
