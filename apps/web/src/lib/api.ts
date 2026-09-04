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
 * always was; changing it takes a restart to apply (`setApiUrlOverride` below relaunches the app),
 * simpler than threading a reactive base URL through every consumer of the `apiBaseUrl` constant.
 */
function readApiUrlOverride(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(apiUrlOverrideKey);
  } catch {
    return null;
  }
}

function resolveApiBaseUrl() {
  const configured =
    readApiUrlOverride() || import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";
  if (typeof window === "undefined") return configured;

  const url = new URL(configured);
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (loopbackHosts.has(url.hostname) && loopbackHosts.has(window.location.hostname)) {
    url.hostname = window.location.hostname;
  }
  return url.origin;
}

export const apiBaseUrl = resolveApiBaseUrl();

/** The build-time default, for a settings UI to show what "reset" would fall back to. */
export const apiBaseUrlDefault = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

/**
 * Persists (or, given `null`, clears) the API URL override and restarts the app so every
 * already-initialized consumer of `apiBaseUrl` picks it up — reachable only from the desktop
 * shell's settings UI, guarded by `isDesktopShell()` the same way every other Tauri-only entry
 * point in this codebase is.
 *
 * **Known limitation:** the packaged app's CSP (`connect-src`/`media-src`/`img-src`) is widened
 * for exactly one origin at *build* time (`release.yml`, from the `ARCADIA_API_URL` repo
 * variable) — plus loopback, always allowed for local dev. Overriding to that same origin (or to
 * loopback) works; overriding to a genuinely different, not-yet-authorized origin will still get
 * silently CSP-blocked, because a webview's CSP can't be loosened at runtime. This setting is for
 * "the server's address changed, same deployment" (a new LAN IP, a typo) — pointing a build at a
 * *different family's* server still needs that server's origin baked in at release time.
 */
export async function setApiUrlOverride(url: string | null) {
  if (url) {
    new URL(url); // throws on garbage input before it ever reaches localStorage
    window.localStorage.setItem(apiUrlOverrideKey, url);
  } else {
    window.localStorage.removeItem(apiUrlOverrideKey);
  }
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

/**
 * Media (posters/banners/logos/profile photos) is served by the API from a directory outside the
 * web build (see `apps/api/src/media-storage.ts`) rather than shipped inside `apps/web/public` —
 * the API returns root-relative paths like `/media/uploads/...`, exactly as before, but a
 * root-relative path only resolves correctly when the current page's own origin is the API's
 * origin. That's true for a browser tab hitting the API directly, but never true inside the Tauri
 * desktop app (its webview's origin is the bundled app, not the API), so every `*Path` field is
 * rewritten to an absolute `${apiBaseUrl}` URL right here, the one place every API response
 * already passes through — no render call site anywhere else needs to know this changed.
 */
export function rewriteMediaUrls<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => rewriteMediaUrls(item)) as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] =
        key.endsWith("Path") && typeof entryValue === "string" && entryValue.startsWith("/media/")
          ? `${apiBaseUrl}${entryValue}`
          : rewriteMediaUrls(entryValue);
    }
    return result as T;
  }
  return value;
}

async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: new Headers(init?.headers),
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
    headers: new Headers({ "Content-Type": "application/json", ...init?.headers }),
  });
  if (!response.ok) {
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
  return rewriteMediaUrls((await response.json()) as T);
}

export async function browseTitles(query: Record<string, string | number> = {}) {
  const { data, error } = await client.GET("/api/v1/titles", { params: { query } });
  if (error || !data) throw new Error("تعذّر تحميل الأرشيف من واجهة Arcadia.");
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
  return rewriteMediaUrls(result.data as TitleDetail);
}

export async function getPlanets() {
  const { data, error } = await client.GET("/api/v1/planets");
  if (error || !data) throw new Error("تعذّر تحميل الكواكب.");
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
